package conflicts

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/conflict"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/quarantine"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/remoterepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/repository"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git2go"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

func (s *server) ResolveConflicts(stream gitalypb.ConflictsService_ResolveConflictsServer) error {
	firstRequest, err := stream.Recv()
	if err != nil {
		return err
	}

	header := firstRequest.GetHeader()
	if header == nil {
		return structerr.NewInvalidArgument("empty ResolveConflictsRequestHeader")
	}

	if err = validateResolveConflictsHeader(header); err != nil {
		return structerr.NewInvalidArgument("%w", err)
	}

	err = s.resolveConflicts(header, stream)
	return handleResolveConflictsErr(err, stream)
}

func handleResolveConflictsErr(err error, stream gitalypb.ConflictsService_ResolveConflictsServer) error {
	var errStr string // normalized error message
	if err != nil {
		errStr = strings.TrimPrefix(err.Error(), "resolve: ") // remove subcommand artifact
		errStr = strings.TrimSpace(errStr)                    // remove newline artifacts

		// only send back resolution errors that match expected pattern
		for _, p := range []string{
			"Missing resolution for section ID:",
			"Resolved content has no changes for file",
			"Missing resolutions for the following files:",
		} {
			if strings.HasPrefix(errStr, p) {
				// log the error since the interceptor won't catch this
				// error due to the unique way the RPC is defined to
				// handle resolution errors
				ctxlogrus.
					Extract(stream.Context()).
					WithError(err).
					Error("ResolveConflicts: unable to resolve conflict")
				return stream.SendAndClose(&gitalypb.ResolveConflictsResponse{
					ResolutionError: errStr,
				})
			}
		}

		return err
	}
	return stream.SendAndClose(&gitalypb.ResolveConflictsResponse{})
}

func validateResolveConflictsHeader(header *gitalypb.ResolveConflictsRequestHeader) error {
	if header.GetOurCommitOid() == "" {
		return errors.New("empty OurCommitOid")
	}
	if err := service.ValidateRepository(header.GetRepository()); err != nil {
		return err
	}
	if header.GetTargetRepository() == nil {
		return errors.New("empty TargetRepository")
	}
	if header.GetTheirCommitOid() == "" {
		return errors.New("empty TheirCommitOid")
	}
	if header.GetSourceBranch() == nil {
		return errors.New("empty SourceBranch")
	}
	if header.GetTargetBranch() == nil {
		return errors.New("empty TargetBranch")
	}
	if header.GetCommitMessage() == nil {
		return errors.New("empty CommitMessage")
	}
	if header.GetUser() == nil {
		return errors.New("empty User")
	}

	return nil
}

func (s *server) resolveConflicts(header *gitalypb.ResolveConflictsRequestHeader, stream gitalypb.ConflictsService_ResolveConflictsServer) error {
	b := bytes.NewBuffer(nil)
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		if _, err := b.Write(req.GetFilesJson()); err != nil {
			return err
		}
	}

	var checkKeys []map[string]interface{}
	if err := json.Unmarshal(b.Bytes(), &checkKeys); err != nil {
		return err
	}

	for _, ck := range checkKeys {
		_, sectionExists := ck["sections"]
		_, contentExists := ck["content"]
		if !sectionExists && !contentExists {
			return structerr.NewInvalidArgument("missing sections or content for a resolution")
		}
	}

	var resolutions []conflict.Resolution
	if err := json.Unmarshal(b.Bytes(), &resolutions); err != nil {
		return err
	}

	ctx := stream.Context()
	targetRepo, err := remoterepo.New(ctx, header.GetTargetRepository(), s.pool)
	if err != nil {
		return err
	}

	quarantineDir, err := quarantine.New(ctx, header.GetRepository(), s.locator)
	if err != nil {
		return structerr.NewInternal("creating object quarantine: %w", err)
	}
	quarantineRepo := s.localrepo(quarantineDir.QuarantinedRepo())

	if err := s.repoWithBranchCommit(ctx,
		quarantineRepo,
		targetRepo,
		header.TargetBranch,
	); err != nil {
		return err
	}

	repoPath, err := s.locator.GetRepoPath(quarantineRepo)
	if err != nil {
		return err
	}

	authorDate := time.Now()
	if header.Timestamp != nil {
		authorDate = header.Timestamp.AsTime()
	}

	if git.ObjectHashSHA1.ValidateHex(header.GetOurCommitOid()) != nil ||
		git.ObjectHashSHA1.ValidateHex(header.GetTheirCommitOid()) != nil {
		return errors.New("Rugged::InvalidError: unable to parse OID - contains invalid characters")
	}

	result, err := s.git2goExecutor.Resolve(ctx, quarantineRepo, git2go.ResolveCommand{
		MergeCommand: git2go.MergeCommand{
			Repository: repoPath,
			AuthorName: string(header.User.Name),
			AuthorMail: string(header.User.Email),
			AuthorDate: authorDate,
			Message:    string(header.CommitMessage),
			Ours:       header.GetOurCommitOid(),
			Theirs:     header.GetTheirCommitOid(),
		},
		Resolutions: resolutions,
	})
	if err != nil {
		if errors.Is(err, git2go.ErrInvalidArgument) {
			return structerr.NewInvalidArgument("%w", err)
		}
		return err
	}

	commitOID, err := git.ObjectHashSHA1.FromHex(result.CommitID)
	if err != nil {
		return err
	}

	if err := s.updater.UpdateReference(
		ctx,
		header.Repository,
		header.User,
		quarantineDir,
		git.ReferenceName("refs/heads/"+string(header.GetSourceBranch())),
		commitOID,
		git.ObjectID(header.OurCommitOid),
	); err != nil {
		return err
	}

	return nil
}

func sameRepo(left, right repository.GitRepo) bool {
	lgaod := left.GetGitAlternateObjectDirectories()
	rgaod := right.GetGitAlternateObjectDirectories()
	if len(lgaod) != len(rgaod) {
		return false
	}
	sort.Strings(lgaod)
	sort.Strings(rgaod)
	for i := 0; i < len(lgaod); i++ {
		if lgaod[i] != rgaod[i] {
			return false
		}
	}
	if left.GetGitObjectDirectory() != right.GetGitObjectDirectory() {
		return false
	}
	if left.GetRelativePath() != right.GetRelativePath() {
		return false
	}
	if left.GetStorageName() != right.GetStorageName() {
		return false
	}
	return true
}

// repoWithCommit ensures that the source repo contains the same commit we
// hope to merge with from the target branch, else it will be fetched from the
// target repo. This is necessary since all merge/resolve logic occurs on the
// same filesystem
func (s *server) repoWithBranchCommit(ctx context.Context, sourceRepo *localrepo.Repo, targetRepo *remoterepo.Repo, targetBranch []byte) error {
	const peelCommit = "^{commit}"

	targetRevision := "refs/heads/" + git.Revision(string(targetBranch)) + peelCommit

	if sameRepo(sourceRepo, targetRepo) {
		_, err := sourceRepo.ResolveRevision(ctx, targetRevision)
		return err
	}

	oid, err := targetRepo.ResolveRevision(ctx, targetRevision)
	if err != nil {
		return fmt.Errorf("could not resolve target revision %q: %w", targetRevision, err)
	}

	ok, err := sourceRepo.HasRevision(ctx, git.Revision(oid)+peelCommit)
	if err != nil {
		return err
	}
	if ok {
		// target branch commit already exists in source repo; nothing
		// to do
		return nil
	}

	if err := sourceRepo.FetchInternal(
		ctx,
		targetRepo.Repository,
		[]string{oid.String()},
		localrepo.FetchOpts{Tags: localrepo.FetchOptsTagsNone},
	); err != nil {
		return fmt.Errorf("could not fetch target commit: %w", err)
	}

	return nil
}
