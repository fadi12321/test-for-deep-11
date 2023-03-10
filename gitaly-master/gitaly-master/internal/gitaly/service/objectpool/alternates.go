package objectpool

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	"gitlab.com/gitlab-org/gitaly/v15/internal/command"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/perm"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/text"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata/featureflag"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

// DisconnectGitAlternates is a slightly dangerous RPC. It optimistically
// hard-links all alternate objects we might need, and then temporarily
// removes (renames) objects/info/alternates and runs 'git fsck'. If we
// are unlucky that leaves the repository in a broken state during 'git
// fsck'. If we are very unlucky and Gitaly crashes, the repository stays
// in a broken state until an administrator intervenes and restores the
// backed-up copy of objects/info/alternates.
func (s *server) DisconnectGitAlternates(ctx context.Context, req *gitalypb.DisconnectGitAlternatesRequest) (*gitalypb.DisconnectGitAlternatesResponse, error) {
	repository := req.GetRepository()
	if err := service.ValidateRepository(repository); err != nil {
		return nil, structerr.NewInvalidArgument("%w", err)
	}

	repo := s.localrepo(repository)

	if err := s.disconnectAlternates(ctx, repo); err != nil {
		return nil, structerr.NewInternal("%w", err)
	}

	return &gitalypb.DisconnectGitAlternatesResponse{}, nil
}

func (s *server) disconnectAlternates(ctx context.Context, repo *localrepo.Repo) error {
	repoPath, err := repo.Path()
	if err != nil {
		return err
	}

	altFile, err := repo.InfoAlternatesPath()
	if err != nil {
		return err
	}

	altContents, err := os.ReadFile(altFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}

		return err
	}

	altDir := strings.TrimSpace(string(altContents))
	if strings.Contains(altDir, "\n") {
		return &invalidAlternatesError{altContents: altContents}
	}

	if !filepath.IsAbs(altDir) {
		altDir = filepath.Join(repoPath, "objects", altDir)
	}

	stat, err := os.Stat(altDir)
	if err != nil {
		return err
	}

	if !stat.IsDir() {
		return &invalidAlternatesError{altContents: altContents}
	}

	objectFiles, err := findObjectFiles(altDir)
	if err != nil {
		return err
	}

	for _, path := range objectFiles {
		source := filepath.Join(altDir, path)
		target := filepath.Join(repoPath, "objects", path)

		if err := os.MkdirAll(filepath.Dir(target), perm.SharedDir); err != nil {
			return err
		}

		if err := os.Link(source, target); err != nil {
			if os.IsExist(err) {
				continue
			}

			return err
		}
	}

	backupFile, err := newBackupFile(altFile)
	if err != nil {
		return err
	}

	return s.removeAlternatesIfOk(ctx, repo, altFile, backupFile)
}

func newBackupFile(altFile string) (string, error) {
	randSuffix, err := text.RandomHex(6)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s.%d.%s", altFile, time.Now().Unix(), randSuffix), nil
}

func findObjectFiles(altDir string) ([]string, error) {
	var objectFiles []string
	if walkErr := filepath.Walk(altDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(altDir, path)
		if err != nil {
			return err
		}

		if strings.HasPrefix(rel, "info/") {
			return nil
		}

		if info.IsDir() {
			return nil
		}

		objectFiles = append(objectFiles, rel)

		return nil
	}); walkErr != nil {
		return nil, walkErr
	}

	sort.Sort(objectPaths(objectFiles))

	return objectFiles, nil
}

type connectivityError struct{ error }

func (fe *connectivityError) Error() string {
	return fmt.Sprintf("git fsck error while disconnected: %v", fe.error)
}

type invalidAlternatesError struct {
	altContents []byte
}

func (e *invalidAlternatesError) Error() string {
	return fmt.Sprintf("invalid content in objects/info/alternates: %q", e.altContents)
}

// removeAlternatesIfOk is dangerous. We optimistically temporarily
// rename objects/info/alternates, and run `git fsck` to see if the
// resulting repo is connected. If this fails we restore
// objects/info/alternates. If the repo is not connected for whatever
// reason, then until this function returns, probably **all concurrent
// RPC calls to the repo will fail**. Also, if Gitaly crashes in the
// middle of this function, the repo is left in a broken state. We do
// take care to leave a copy of the alternates file, so that it can be
// manually restored by an administrator if needed.
func (s *server) removeAlternatesIfOk(ctx context.Context, repo *localrepo.Repo, altFile, backupFile string) error {
	if err := os.Rename(altFile, backupFile); err != nil {
		return err
	}

	rollback := true
	defer func() {
		if !rollback {
			return
		}

		logger := ctxlogrus.Extract(ctx)

		// If we would do a os.Rename, and then someone else comes and clobbers
		// our file, it's gone forever. This trick with os.Link and os.Rename
		// is equivalent to "cp $backupFile $altFile", meaning backupFile is
		// preserved for possible forensic use.
		tmp := backupFile + ".2"

		if err := os.Link(backupFile, tmp); err != nil {
			logger.WithError(err).Error("copy backup alternates file")
			return
		}

		if err := os.Rename(tmp, altFile); err != nil {
			logger.WithError(err).Error("restore backup alternates file")
		}
	}()

	var err error
	var cmd *command.Command

	if featureflag.RevlistForConnectivity.IsEnabled(ctx) {
		// The choice here of git rev-list is for performance reasons.
		// git fsck --connectivity-only performed badly for large
		// repositories. The reasons are detailed in https://lore.kernel.org/git/9304B938-4A59-456B-B091-DBBCAA1823B2@gmail.com/
		cmd, err = repo.Exec(ctx, git.Command{
			Name: "rev-list",
			Flags: []git.Option{
				git.Flag{Name: "--objects"},
				git.Flag{Name: "--all"},
				git.Flag{Name: "--quiet"},
			},
		})
	} else {
		cmd, err = repo.Exec(ctx, git.Command{
			Name:  "fsck",
			Flags: []git.Option{git.Flag{Name: "--connectivity-only"}},
		}, git.WithConfig(git.ConfigPair{
			// Starting with Git's f30e4d854b (fsck: verify commit graph when implicitly
			// enabled, 2021-10-15), git-fsck(1) will check the commit graph for consistency
			// even if `core.commitGraph` is not enabled explicitly. We do not want to verify
			// whether the commit graph is consistent though, but only care about connectivity,
			// so we now explicitly disable usage of the commit graph.
			Key: "core.commitGraph", Value: "false",
		}))
	}

	if err != nil {
		return err
	}

	if err := cmd.Wait(); err != nil {
		return &connectivityError{error: err}
	}

	rollback = false
	return nil
}

type objectPaths []string

func (o objectPaths) Len() int      { return len(o) }
func (o objectPaths) Swap(i, j int) { o[i], o[j] = o[j], o[i] }

func (o objectPaths) Less(i, j int) bool {
	return objectPriority(o[i]) <= objectPriority(o[j])
}

// Based on pack_copy_priority in git/tmp-objdir.c
func objectPriority(name string) int {
	if !strings.HasPrefix(name, "pack") {
		return 0
	}
	if strings.HasSuffix(name, ".keep") {
		return 1
	}
	if strings.HasSuffix(name, ".pack") {
		return 2
	}
	if strings.HasSuffix(name, ".idx") {
		return 3
	}
	return 4
}
