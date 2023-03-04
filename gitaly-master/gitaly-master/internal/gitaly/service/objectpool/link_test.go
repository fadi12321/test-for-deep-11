//go:build !gitaly_test_sha256

package objectpool

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/perm"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testserver"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

func TestLink(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg, repo, _, _, client := setup(t, ctx, testserver.WithDisablePraefect())

	localRepo := localrepo.NewTestRepo(t, cfg, repo)
	poolProto, _, poolPath := createObjectPool(t, ctx, cfg, client, repo)

	// Mock object in the pool, which should be available to the pool members
	// after linking
	poolCommitID := gittest.WriteCommit(t, cfg, poolPath,
		gittest.WithBranch("pool-test-branch"))

	for _, tc := range []struct {
		desc        string
		request     *gitalypb.LinkRepositoryToObjectPoolRequest
		expectedErr error
	}{
		{
			desc: "unset repository",
			request: &gitalypb.LinkRepositoryToObjectPoolRequest{
				Repository: nil,
				ObjectPool: poolProto,
			},
			expectedErr: structerr.NewInvalidArgument("empty Repository"),
		},
		{
			desc: "unset object pool",
			request: &gitalypb.LinkRepositoryToObjectPoolRequest{
				Repository: repo,
				ObjectPool: nil,
			},
			expectedErr: structerr.NewInvalidArgument("GetStorageByName: no such storage: %q", ""),
		},
		{
			desc: "successful",
			request: &gitalypb.LinkRepositoryToObjectPoolRequest{
				Repository: repo,
				ObjectPool: poolProto,
			},
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			_, err := client.LinkRepositoryToObjectPool(ctx, tc.request)
			testhelper.RequireGrpcError(t, tc.expectedErr, err)
			if tc.expectedErr != nil {
				return
			}

			commit, err := localRepo.ReadCommit(ctx, git.Revision(poolCommitID))
			require.NoError(t, err)
			require.NotNil(t, commit)
			require.Equal(t, poolCommitID.String(), commit.Id)
		})
	}
}

func TestLink_idempotent(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg, repoProto, _, _, client := setup(t, ctx)

	poolProto, _, _ := createObjectPool(t, ctx, cfg, client, repoProto)

	request := &gitalypb.LinkRepositoryToObjectPoolRequest{
		Repository: repoProto,
		ObjectPool: poolProto,
	}

	_, err := client.LinkRepositoryToObjectPool(ctx, request)
	require.NoError(t, err)

	_, err = client.LinkRepositoryToObjectPool(ctx, request)
	require.NoError(t, err)
}

func TestLink_noClobber(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg, repoProto, repoPath, _, client := setup(t, ctx)
	poolProto, _, _ := createObjectPool(t, ctx, cfg, client, repoProto)

	alternatesFile := filepath.Join(repoPath, "objects/info/alternates")
	require.NoFileExists(t, alternatesFile)

	contentBefore := "mock/objects\n"
	require.NoError(t, os.WriteFile(alternatesFile, []byte(contentBefore), perm.SharedFile))

	request := &gitalypb.LinkRepositoryToObjectPoolRequest{
		Repository: repoProto,
		ObjectPool: poolProto,
	}

	_, err := client.LinkRepositoryToObjectPool(ctx, request)
	testhelper.RequireGrpcError(t, structerr.NewInternal("unexpected alternates content: %q", "mock/objects"), err)

	contentAfter := testhelper.MustReadFile(t, alternatesFile)
	require.Equal(t, contentBefore, string(contentAfter), "contents of existing alternates file should not have changed")
}

func TestLink_noPool(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg, repo, _, _, client := setup(t, ctx)

	poolRelativePath := gittest.NewObjectPoolName(t)

	_, err := client.LinkRepositoryToObjectPool(ctx, &gitalypb.LinkRepositoryToObjectPoolRequest{
		Repository: repo,
		ObjectPool: &gitalypb.ObjectPool{
			Repository: &gitalypb.Repository{
				StorageName:  cfg.Storages[0].Name,
				RelativePath: poolRelativePath,
			},
		},
	})
	testhelper.RequireGrpcError(t, testhelper.GitalyOrPraefect(
		structerr.NewFailedPrecondition("object pool is not a valid git repository"),
		structerr.NewNotFound(
			"mutator call: route repository mutator: resolve additional replica path: get additional repository id: repository %q/%q not found",
			cfg.Storages[0].Name,
			poolRelativePath,
		),
	), err)
}
