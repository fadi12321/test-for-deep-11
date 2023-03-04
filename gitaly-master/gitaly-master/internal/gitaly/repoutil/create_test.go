package repoutil

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/transaction"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/perm"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/text"
	"gitlab.com/gitlab-org/gitaly/v15/internal/safe"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/internal/transaction/txinfo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/transaction/voting"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc/peer"
)

func TestCreate(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)

	txManager := &transaction.MockManager{}
	locator := config.NewLocator(cfg)
	gitCmdFactory := gittest.NewCommandFactory(t, cfg)

	var votesByPhase map[voting.Phase]int

	for _, tc := range []struct {
		desc   string
		opts   []CreateOption
		setup  func(t *testing.T, repo *gitalypb.Repository, repoPath string)
		seed   func(t *testing.T, repo *gitalypb.Repository, repoPath string) error
		verify func(
			t *testing.T,
			tempRepo *gitalypb.Repository,
			tempRepoPath string,
			realRepo *gitalypb.Repository,
			realRepoPath string,
		)
		transactional bool
		expectedErr   error
	}{
		{
			desc: "no seeding",
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				// Assert that the temporary repository does not exist anymore.
				require.NoDirExists(t, tempRepoPath)

				// But the new repository must exist.
				isBareRepo := gittest.Exec(t, cfg, "-C", realRepoPath, "rev-parse", "--is-bare-repository")
				require.Equal(t, "true", text.ChompBytes(isBareRepo))
			},
		},
		{
			desc: "seeding",
			seed: func(t *testing.T, repo *gitalypb.Repository, _ string) error {
				// We're using the command factory on purpose here to assert that we
				// can execute regular Git commands on the temporary repository.
				cmd, err := gitCmdFactory.New(ctx, repo, git.Command{
					Name: "config",
					Args: []string{"custom.key", "value"},
				})
				require.NoError(t, err)
				require.NoError(t, cmd.Wait())
				return nil
			},
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				value := gittest.Exec(t, cfg, "-C", realRepoPath, "config", "custom.key")
				require.Equal(t, "value", text.ChompBytes(value))
			},
		},
		{
			desc: "error while seeding",
			seed: func(t *testing.T, repo *gitalypb.Repository, _ string) error {
				return errors.New("some error")
			},
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				require.NoDirExists(t, realRepoPath)
				require.NoDirExists(t, tempRepoPath)
			},
			expectedErr: errors.New("some error"),
		},
		{
			desc: "preexisting directory",
			setup: func(t *testing.T, repo *gitalypb.Repository, repoPath string) {
				require.NoError(t, os.MkdirAll(repoPath, perm.PublicDir))
			},
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				require.NoDirExists(t, tempRepoPath)

				require.DirExists(t, realRepoPath)
				dirEntries, err := os.ReadDir(realRepoPath)
				require.NoError(t, err)
				require.Empty(t, dirEntries, "directory should not have been modified")
			},
			expectedErr: structerr.NewAlreadyExists("repository exists already"),
		},
		{
			desc: "locked",
			setup: func(t *testing.T, repo *gitalypb.Repository, repoPath string) {
				require.NoError(t, os.MkdirAll(filepath.Dir(repoPath), perm.PublicDir))

				// Lock the target repository such that we must fail.
				lock, err := os.Create(repoPath + ".lock")
				require.NoError(t, err)
				require.NoError(t, lock.Close())
			},
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				require.NoDirExists(t, tempRepoPath)
				require.NoDirExists(t, realRepoPath)
				require.FileExists(t, realRepoPath+".lock")
			},
			expectedErr: fmt.Errorf("locking repository: %w", safe.ErrFileAlreadyLocked),
		},
		{
			desc:          "successful transaction",
			transactional: true,
			setup: func(t *testing.T, repo *gitalypb.Repository, repoPath string) {
				votesByPhase = map[voting.Phase]int{}
				txManager.VoteFn = func(_ context.Context, _ txinfo.Transaction, _ voting.Vote, phase voting.Phase) error {
					votesByPhase[phase]++
					return nil
				}
			},
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				require.Equal(t, map[voting.Phase]int{
					voting.Prepared:  1,
					voting.Committed: 1,
				}, votesByPhase)
			},
		},
		{
			desc:          "failing preparatory vote",
			transactional: true,
			setup: func(t *testing.T, repo *gitalypb.Repository, repoPath string) {
				txManager.VoteFn = func(context.Context, txinfo.Transaction, voting.Vote, voting.Phase) error {
					return errors.New("vote failed")
				}
			},
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				require.NoDirExists(t, tempRepoPath)
				require.NoDirExists(t, realRepoPath)
			},
			expectedErr: structerr.NewFailedPrecondition("preparatory vote: %w", errors.New("vote failed")),
		},
		{
			desc:          "failing post-commit vote",
			transactional: true,
			setup: func(t *testing.T, repo *gitalypb.Repository, repoPath string) {
				txManager.VoteFn = func(_ context.Context, _ txinfo.Transaction, _ voting.Vote, phase voting.Phase) error {
					if phase == voting.Prepared {
						return nil
					}
					return errors.New("vote failed")
				}
			},
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				require.NoDirExists(t, tempRepoPath)

				// The second vote is only a confirming vote that the node did the
				// change. So if the second vote fails, then the change must have
				// been performed and thus we'd see the repository.
				require.DirExists(t, realRepoPath)
			},
			expectedErr: structerr.NewFailedPrecondition("committing vote: %w", errors.New("vote failed")),
		},
		{
			desc:          "voting happens after lock",
			transactional: true,
			setup: func(t *testing.T, repo *gitalypb.Repository, repoPath string) {
				// We both set up transactions and create the lock. Given that we
				// should try locking the repository before casting any votes, we do
				// not expect to see a voting error.

				require.NoError(t, os.MkdirAll(filepath.Dir(repoPath), perm.PublicDir))
				lock, err := os.Create(repoPath + ".lock")
				require.NoError(t, err)
				require.NoError(t, lock.Close())

				txManager.VoteFn = func(context.Context, txinfo.Transaction, voting.Vote, voting.Phase) error {
					require.FailNow(t, "no votes should have happened")
					return nil
				}
			},
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				require.NoDirExists(t, tempRepoPath)
				require.NoDirExists(t, realRepoPath)
			},
			expectedErr: fmt.Errorf("locking repository: %w", errors.New("file already locked")),
		},
		{
			desc:          "vote is deterministic",
			transactional: true,
			setup: func(t *testing.T, repo *gitalypb.Repository, repoPath string) {
				txManager.VoteFn = func(_ context.Context, _ txinfo.Transaction, vote voting.Vote, _ voting.Phase) error {
					require.Equal(t, voting.VoteFromData([]byte("headcfgfoo")), vote)
					return nil
				}
			},
			seed: func(t *testing.T, repo *gitalypb.Repository, repoPath string) error {
				// Remove the repository first so we can start from a clean state.
				require.NoError(t, os.RemoveAll(repoPath))
				require.NoError(t, os.Mkdir(repoPath, perm.PublicDir))

				// Objects and FETCH_HEAD should both be ignored. They may contain
				// indeterministic data that's different across replicas and would
				// thus cause us to not reach quorum.
				require.NoError(t, os.Mkdir(filepath.Join(repoPath, "objects"), perm.PublicDir))
				require.NoError(t, os.WriteFile(filepath.Join(repoPath, "objects", "object"), []byte("object"), perm.PublicFile))
				require.NoError(t, os.WriteFile(filepath.Join(repoPath, "FETCH_HEAD"), []byte("fetch-head"), perm.PublicFile))

				// All the other files should be hashed though.
				require.NoError(t, os.WriteFile(filepath.Join(repoPath, "HEAD"), []byte("head"), perm.PublicFile))
				require.NoError(t, os.WriteFile(filepath.Join(repoPath, "config"), []byte("cfg"), perm.PublicFile))
				require.NoError(t, os.MkdirAll(filepath.Join(repoPath, "refs", "heads"), perm.PublicDir))
				require.NoError(t, os.WriteFile(filepath.Join(repoPath, "refs", "heads", "foo"), []byte("foo"), perm.PublicFile))

				return nil
			},
			verify: func(t *testing.T, _ *gitalypb.Repository, tempRepoPath string, _ *gitalypb.Repository, realRepoPath string) {
				require.NoDirExists(t, tempRepoPath)
				require.DirExists(t, realRepoPath)

				// Even though a subset of data wasn't voted on, it should still be
				// part of the final repository.
				for expectedPath, expectedContents := range map[string]string{
					filepath.Join(realRepoPath, "objects", "object"):    "object",
					filepath.Join(realRepoPath, "HEAD"):                 "head",
					filepath.Join(realRepoPath, "FETCH_HEAD"):           "fetch-head",
					filepath.Join(realRepoPath, "config"):               "cfg",
					filepath.Join(realRepoPath, "refs", "heads", "foo"): "foo",
				} {
					require.Equal(t, expectedContents, string(testhelper.MustReadFile(t, expectedPath)))
				}
			},
		},
		{
			desc: "override branch",
			opts: []CreateOption{
				WithBranchName("default"),
			},
			verify: func(t *testing.T, _ *gitalypb.Repository, _ string, _ *gitalypb.Repository, realRepoPath string) {
				defaultBranch := text.ChompBytes(gittest.Exec(t, cfg, "-C", realRepoPath, "symbolic-ref", "HEAD"))
				require.Equal(t, "refs/heads/default", defaultBranch)
			},
		},
		{
			desc: "override hash",
			opts: []CreateOption{
				WithObjectHash(git.ObjectHashSHA256),
			},
			verify: func(t *testing.T, _ *gitalypb.Repository, _ string, _ *gitalypb.Repository, realRepoPath string) {
				objectFormat := text.ChompBytes(gittest.Exec(t, cfg, "-C", realRepoPath, "rev-parse", "--show-object-format"))
				require.Equal(t, "sha256", objectFormat)
			},
		},
		{
			desc: "skip initialization",
			opts: []CreateOption{
				WithSkipInit(),
			},
			seed: func(t *testing.T, repo *gitalypb.Repository, repoPath string) error {
				require.NoDirExists(t, repoPath)
				gittest.Exec(t, cfg, "init", "--bare", repoPath)
				return nil
			},
			verify: func(t *testing.T, tempRepo *gitalypb.Repository, tempRepoPath string, realRepo *gitalypb.Repository, realRepoPath string) {
				require.NoDirExists(t, tempRepoPath)

				// But the new repository must exist.
				isBareRepo := gittest.Exec(t, cfg, "-C", realRepoPath, "rev-parse", "--is-bare-repository")
				require.Equal(t, "true", text.ChompBytes(isBareRepo))
			},
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			// Make sure that we don't leak either the context or the mocked transaction
			// manager's data.
			ctx := ctx
			*txManager = transaction.MockManager{}

			repo := &gitalypb.Repository{
				StorageName:  cfg.Storages[0].Name,
				RelativePath: gittest.NewRepositoryName(t),
			}

			if tc.transactional {
				var err error
				ctx, err = txinfo.InjectTransaction(ctx, 1, "node", true)
				require.NoError(t, err)
				ctx = peer.NewContext(ctx, &peer.Peer{})
			}

			repoPath, err := locator.GetPath(repo)
			require.NoError(t, err)

			if tc.setup != nil {
				tc.setup(t, repo, repoPath)
			}

			var tempRepo *gitalypb.Repository
			require.Equal(t, tc.expectedErr, Create(ctx, locator, gitCmdFactory, txManager, repo, func(tr *gitalypb.Repository) error {
				tempRepo = tr

				// The temporary repository must have been created in Gitaly's
				// temporary storage path.
				require.Equal(t, repo.StorageName, tempRepo.StorageName)
				require.True(t, strings.HasPrefix(tempRepo.RelativePath, "+gitaly/tmp/repo"))

				tempRepoPath, err := locator.GetPath(tempRepo)
				require.NoError(t, err)

				if tc.seed != nil {
					return tc.seed(t, tempRepo, tempRepoPath)
				}

				// Verify that the repository exists now and is a real repository.
				isBareRepo := gittest.Exec(t, cfg, "-C", tempRepoPath, "rev-parse", "--is-bare-repository")
				require.Equal(t, "true", text.ChompBytes(isBareRepo))

				return nil
			}, tc.opts...))

			var tempRepoPath string
			if tempRepo != nil {
				tempRepoPath, err = locator.GetPath(tempRepo)
				require.NoError(t, err)
			}

			require.NotNil(t, tc.verify, "test must verify results")
			tc.verify(t, tempRepo, tempRepoPath, repo, repoPath)
		})
	}
}
