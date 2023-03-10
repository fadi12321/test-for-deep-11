//go:build !gitaly_test_sha256

package commit

import (
	"fmt"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/text"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestCommitIsAncestorFailure(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg, repo, _, client := setupCommitServiceWithRepo(t, ctx)

	queries := []struct {
		Request     *gitalypb.CommitIsAncestorRequest
		expectedErr error
	}{
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: nil,
				AncestorId: "b83d6e391c22777fca1ed3012fce84f633d7fed0",
				ChildId:    "8a0f2ee90d940bfb0ba1e14e8214b0649056e4ab",
			},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: "",
				ChildId:    "8a0f2ee90d940bfb0ba1e14e8214b0649056e4ab",
			},
			expectedErr: status.Error(codes.InvalidArgument, "empty ancestor sha"),
		},
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: "b83d6e391c22777fca1ed3012fce84f633d7fed0",
				ChildId:    "",
			},
			expectedErr: status.Error(codes.InvalidArgument, "empty child sha"),
		},
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: &gitalypb.Repository{StorageName: "default", RelativePath: "fake-path"},
				AncestorId: "b83d6e391c22777fca1ed3012fce84f633d7fed0",
				ChildId:    "8a0f2ee90d940bfb0ba1e14e8214b0649056e4ab",
			},
			expectedErr: status.Error(codes.NotFound, testhelper.GitalyOrPraefect(
				`GetRepoPath: not a git repository: "`+cfg.Storages[0].Path+`/fake-path"`,
				`accessor call: route repository accessor: consistent storages: repository "default"/"fake-path" not found`,
			)),
		},
	}

	for _, v := range queries {
		t.Run(fmt.Sprintf("%v", v.Request), func(t *testing.T) {
			_, err := client.CommitIsAncestor(ctx, v.Request)
			testhelper.RequireGrpcError(t, v.expectedErr, err)
		})
	}
}

func TestCommitIsAncestorSuccess(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	_, repo, _, client := setupCommitServiceWithRepo(t, ctx)

	queries := []struct {
		Request  *gitalypb.CommitIsAncestorRequest
		Response bool
		ErrMsg   string
	}{
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: "8a0f2ee90d940bfb0ba1e14e8214b0649056e4ab",
				ChildId:    "372ab6950519549b14d220271ee2322caa44d4eb",
			},
			Response: true,
			ErrMsg:   "Expected commit to be ancestor",
		},
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: "b83d6e391c22777fca1ed3012fce84f633d7fed0",
				ChildId:    "38008cb17ce1466d8fec2dfa6f6ab8dcfe5cf49e",
			},
			Response: false,
			ErrMsg:   "Expected commit not to be ancestor",
		},
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: "1234123412341234123412341234123412341234",
				ChildId:    "b83d6e391c22777fca1ed3012fce84f633d7fed0",
			},
			Response: false,
			ErrMsg:   "Expected invalid commit to not be ancestor",
		},
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: "b83d6e391c22777fca1ed3012fce84f633d7fed0",
				ChildId:    "gitaly-stuff",
			},
			Response: true,
			ErrMsg:   "Expected `b83d6e391c22777fca1ed3012fce84f633d7fed0` to be ancestor of `gitaly-stuff`",
		},
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: "gitaly-stuff",
				ChildId:    "master",
			},
			Response: false,
			ErrMsg:   "Expected branch `gitaly-stuff` not to be ancestor of `master`",
		},
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: "refs/tags/v1.0.0",
				ChildId:    "refs/tags/v1.1.0",
			},
			Response: true,
			ErrMsg:   "Expected tag `v1.0.0` to be ancestor of `v1.1.0`",
		},
		{
			Request: &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: "refs/tags/v1.1.0",
				ChildId:    "refs/tags/v1.0.0",
			},
			Response: false,
			ErrMsg:   "Expected branch `v1.1.0` not to be ancestor of `v1.0.0`",
		},
	}

	for _, v := range queries {
		t.Run(fmt.Sprintf("%v", v.Request), func(t *testing.T) {
			c, err := client.CommitIsAncestor(ctx, v.Request)
			require.NoError(t, err)

			response := c.GetValue()
			require.Equal(t, v.Response, response, v.ErrMsg)
		})
	}
}

func TestSuccessfulIsAncestorRequestWithAltGitObjectDirs(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg, repo, repoPath, client := setupCommitServiceWithRepo(t, ctx)

	parentCommitID := git.ObjectID(text.ChompBytes(gittest.Exec(t, cfg, "-C", repoPath, "rev-parse", "--verify", "HEAD")))

	altObjectsDir := "./alt-objects"
	commitID := gittest.WriteCommit(t, cfg, repoPath,
		gittest.WithParents(parentCommitID),
		gittest.WithAlternateObjectDirectory(filepath.Join(repoPath, altObjectsDir)),
	)

	testCases := []struct {
		desc    string
		altDirs []string
		result  bool
	}{
		{
			desc:    "present GIT_ALTERNATE_OBJECT_DIRECTORIES",
			altDirs: []string{altObjectsDir},
			result:  true,
		},
		{
			desc:    "empty GIT_ALTERNATE_OBJECT_DIRECTORIES",
			altDirs: []string{},
			result:  false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.desc, func(t *testing.T) {
			repo.GitAlternateObjectDirectories = testCase.altDirs
			request := &gitalypb.CommitIsAncestorRequest{
				Repository: repo,
				AncestorId: string(parentCommitID),
				ChildId:    commitID.String(),
			}
			response, err := client.CommitIsAncestor(ctx, request)
			require.NoError(t, err)

			require.Equal(t, testCase.result, response.Value)
		})
	}
}
