//go:build !gitaly_test_sha256

package ref

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/updateref"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service"
	hookservice "gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service/hook"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service/repository"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/transaction"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata/featureflag"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testserver"
	"gitlab.com/gitlab-org/gitaly/v15/internal/transaction/txinfo"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestDeleteRefs_successful(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(featureflag.DeleteRefsStructuredErrors).Run(
		t,
		testDeleteRefSuccessful,
	)
}

func testDeleteRefSuccessful(t *testing.T, ctx context.Context) {
	t.Parallel()

	cfg, client := setupRefServiceWithoutRepo(t)

	testCases := []struct {
		desc    string
		request *gitalypb.DeleteRefsRequest
	}{
		{
			desc: "delete all except refs with certain prefixes",
			request: &gitalypb.DeleteRefsRequest{
				ExceptWithPrefix: [][]byte{[]byte("refs/keep"), []byte("refs/also-keep"), []byte("refs/heads/")},
			},
		},
		{
			desc: "delete certain refs",
			request: &gitalypb.DeleteRefsRequest{
				Refs: [][]byte{
					[]byte("refs/delete/a"),
					[]byte("refs/also-delete/b"),
					[]byte("refs/delete/symbolic-a"),
					[]byte("refs/delete/symbolic-c"),
				},
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.desc, func(t *testing.T) {
			repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
				Seed: gittest.SeedGitLabTest,
			})

			gittest.Exec(t, cfg, "-C", repoPath, "update-ref", "refs/delete/a", "b83d6e391c22777fca1ed3012fce84f633d7fed0")
			gittest.Exec(t, cfg, "-C", repoPath, "update-ref", "refs/also-delete/b", "1b12f15a11fc6e62177bef08f47bc7b5ce50b141")
			gittest.Exec(t, cfg, "-C", repoPath, "update-ref", "refs/keep/c", "498214de67004b1da3d820901307bed2a68a8ef6")
			gittest.Exec(t, cfg, "-C", repoPath, "update-ref", "refs/also-keep/d", "b83d6e391c22777fca1ed3012fce84f633d7fed0")
			gittest.Exec(t, cfg, "-C", repoPath, "symbolic-ref", "refs/delete/symbolic-a", "refs/delete/a")
			gittest.Exec(t, cfg, "-C", repoPath, "symbolic-ref", "refs/delete/symbolic-c", "refs/keep/c")

			testCase.request.Repository = repo
			_, err := client.DeleteRefs(ctx, testCase.request)
			require.NoError(t, err)

			// Ensure that the internal refs are gone, but the others still exist
			refs, err := localrepo.NewTestRepo(t, cfg, repo).GetReferences(ctx, "refs/")
			require.NoError(t, err)

			refNames := make([]string, len(refs))
			for i, branch := range refs {
				refNames[i] = branch.Name.String()
			}

			require.NotContains(t, refNames, "refs/delete/a")
			require.NotContains(t, refNames, "refs/also-delete/b")
			require.NotContains(t, refNames, "refs/delete/symbolic-a")
			require.NotContains(t, refNames, "refs/delete/symbolic-c")
			require.Contains(t, refNames, "refs/keep/c")
			require.Contains(t, refNames, "refs/also-keep/d")
			require.Contains(t, refNames, "refs/heads/master")
		})
	}
}

func TestDeleteRefs_transaction(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(featureflag.DeleteRefsStructuredErrors).Run(
		t,
		testDeleteRefsTransaction,
	)
}

func testDeleteRefsTransaction(t *testing.T, ctx context.Context) {
	t.Parallel()

	cfg := testcfg.Build(t)

	testcfg.BuildGitalyHooks(t, cfg)

	txManager := transaction.NewTrackingManager()

	addr := testserver.RunGitalyServer(t, cfg, nil, func(srv *grpc.Server, deps *service.Dependencies) {
		gitalypb.RegisterRefServiceServer(srv, NewServer(
			deps.GetLocator(),
			deps.GetGitCmdFactory(),
			deps.GetTxManager(),
			deps.GetCatfileCache(),
		))
		gitalypb.RegisterRepositoryServiceServer(srv, repository.NewServer(
			deps.GetCfg(),
			deps.GetRubyServer(),
			deps.GetLocator(),
			deps.GetTxManager(),
			deps.GetGitCmdFactory(),
			deps.GetCatfileCache(),
			deps.GetConnsPool(),
			deps.GetGit2goExecutor(),
			deps.GetHousekeepingManager(),
		))
		gitalypb.RegisterHookServiceServer(srv, hookservice.NewServer(deps.GetHookManager(), deps.GetGitCmdFactory(), deps.GetPackObjectsCache(), deps.GetPackObjectsConcurrencyTracker(), deps.GetPackObjectsLimiter()))
	}, testserver.WithTransactionManager(txManager))
	cfg.SocketPath = addr

	client, conn := newRefServiceClient(t, addr)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })

	ctx, err := txinfo.InjectTransaction(ctx, 1, "node", true)
	require.NoError(t, err)
	ctx = metadata.IncomingToOutgoing(ctx)

	for _, tc := range []struct {
		desc          string
		request       *gitalypb.DeleteRefsRequest
		expectedVotes int
	}{
		{
			desc: "delete nothing",
			request: &gitalypb.DeleteRefsRequest{
				ExceptWithPrefix: [][]byte{[]byte("refs/")},
			},
			expectedVotes: 2,
		},
		{
			desc: "delete all refs",
			request: &gitalypb.DeleteRefsRequest{
				ExceptWithPrefix: [][]byte{[]byte("nonexisting/prefix/")},
			},
			expectedVotes: 2,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			repo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
				Seed: gittest.SeedGitLabTest,
			})
			txManager.Reset()

			tc.request.Repository = repo

			response, err := client.DeleteRefs(ctx, tc.request)
			require.NoError(t, err)
			require.Empty(t, response.GitError)

			require.Equal(t, tc.expectedVotes, len(txManager.Votes()))
		})
	}
}

func TestDeleteRefs_invalidRefFormat(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(featureflag.DeleteRefsStructuredErrors).Run(
		t,
		testDeleteRefsInvalidRefFormat,
	)
}

func testDeleteRefsInvalidRefFormat(t *testing.T, ctx context.Context) {
	t.Parallel()

	_, repo, _, client := setupRefService(t, ctx)

	request := &gitalypb.DeleteRefsRequest{
		Repository: repo,
		Refs:       [][]byte{[]byte(`refs invalid-ref-format`)},
	}

	response, err := client.DeleteRefs(ctx, request)

	if featureflag.DeleteRefsStructuredErrors.IsEnabled(ctx) {
		require.Nil(t, response)
		detailedErr := structerr.NewInvalidArgument("invalid references").WithDetail(
			&gitalypb.DeleteRefsError{
				Error: &gitalypb.DeleteRefsError_InvalidFormat{
					InvalidFormat: &gitalypb.InvalidRefFormatError{
						Refs: request.Refs,
					},
				},
			},
		)
		testhelper.RequireGrpcError(t, detailedErr, err)
	} else {
		require.NoError(t, err)
		require.Equal(t, response.GitError, `unable to delete refs: invalid reference format: "refs invalid-ref-format"`)
	}
}

func TestDeleteRefs_refLocked(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(featureflag.DeleteRefsStructuredErrors).Run(
		t,
		testDeleteRefsRefLocked,
	)
}

func testDeleteRefsRefLocked(t *testing.T, ctx context.Context) {
	t.Parallel()

	cfg, repoProto, _, client := setupRefService(t, ctx)

	request := &gitalypb.DeleteRefsRequest{
		Repository: repoProto,
		Refs:       [][]byte{[]byte("refs/heads/master")},
	}

	repo := localrepo.NewTestRepo(t, cfg, repoProto)
	oldValue, err := repo.ResolveRevision(ctx, git.Revision("refs/heads/master"))
	require.NoError(t, err)

	updater, err := updateref.New(ctx, repo)
	require.NoError(t, err)
	defer testhelper.MustClose(t, updater)

	require.NoError(t, updater.Start())
	require.NoError(t, updater.Update(
		git.ReferenceName("refs/heads/master"),
		"0b4bc9a49b562e85de7cc9e834518ea6828729b9",
		oldValue,
	))
	require.NoError(t, updater.Prepare())

	response, err := client.DeleteRefs(ctx, request)

	if featureflag.DeleteRefsStructuredErrors.IsEnabled(ctx) {
		require.Nil(t, response)
		detailedErr := structerr.NewFailedPrecondition("cannot lock references").WithDetail(
			&gitalypb.DeleteRefsError{
				Error: &gitalypb.DeleteRefsError_ReferencesLocked{
					ReferencesLocked: &gitalypb.ReferencesLockedError{
						Refs: [][]byte{[]byte("refs/heads/master")},
					},
				},
			},
		)
		testhelper.RequireGrpcError(t, detailedErr, err)
	} else {
		require.NoError(t, err)
		assert.Contains(t, response.GetGitError(), "reference is already locked")
	}
}

func TestDeleteRefs_validation(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)

	_, repo, _, client := setupRefService(t, ctx)

	testCases := []struct {
		desc        string
		request     *gitalypb.DeleteRefsRequest
		expectedErr error
	}{
		{
			desc:    "no repository provided",
			request: &gitalypb.DeleteRefsRequest{Repository: nil},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			desc: "Invalid repository",
			request: &gitalypb.DeleteRefsRequest{
				Repository:       &gitalypb.Repository{StorageName: "fake", RelativePath: "path"},
				ExceptWithPrefix: [][]byte{[]byte("exclude-this")},
			},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				`GetStorageByName: no such storage: "fake"`,
				"repo scoped: invalid Repository",
			)),
		},
		{
			desc: "Repository is nil",
			request: &gitalypb.DeleteRefsRequest{
				Repository:       nil,
				ExceptWithPrefix: [][]byte{[]byte("exclude-this")},
			},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			desc: "No prefixes nor refs",
			request: &gitalypb.DeleteRefsRequest{
				Repository: repo,
			},
			expectedErr: status.Error(codes.InvalidArgument, "empty ExceptWithPrefix and Refs"),
		},
		{
			desc: "prefixes with refs",
			request: &gitalypb.DeleteRefsRequest{
				Repository:       repo,
				ExceptWithPrefix: [][]byte{[]byte("exclude-this")},
				Refs:             [][]byte{[]byte("delete-this")},
			},
			expectedErr: status.Error(codes.InvalidArgument, "ExceptWithPrefix and Refs are mutually exclusive"),
		},
		{
			desc: "Empty prefix",
			request: &gitalypb.DeleteRefsRequest{
				Repository:       repo,
				ExceptWithPrefix: [][]byte{[]byte("exclude-this"), {}},
			},
			expectedErr: status.Error(codes.InvalidArgument, "empty prefix for exclusion"),
		},
		{
			desc: "Empty ref",
			request: &gitalypb.DeleteRefsRequest{
				Repository: repo,
				Refs:       [][]byte{[]byte("delete-this"), {}},
			},
			expectedErr: status.Error(codes.InvalidArgument, "empty ref"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			_, err := client.DeleteRefs(ctx, tc.request)
			testhelper.RequireGrpcError(t, tc.expectedErr, err)
		})
	}
}
