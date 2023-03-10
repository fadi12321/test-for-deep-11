//go:build !gitaly_test_sha256

package repository

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestSuccessfulFindFindMergeBaseRequest(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	_, repo, _, client := setupRepositoryService(t, ctx)

	testCases := []struct {
		desc      string
		revisions [][]byte
		base      string
	}{
		{
			desc: "oid revisions",
			revisions: [][]byte{
				[]byte("372ab6950519549b14d220271ee2322caa44d4eb"),
				[]byte("8a0f2ee90d940bfb0ba1e14e8214b0649056e4ab"),
			},
			base: "8a0f2ee90d940bfb0ba1e14e8214b0649056e4ab",
		},
		{
			desc: "branch revisions",
			revisions: [][]byte{
				[]byte("master"),
				[]byte("gitaly-stuff"),
			},
			base: "b83d6e391c22777fca1ed3012fce84f633d7fed0",
		},
		{
			desc: "non-existent merge base",
			revisions: [][]byte{
				[]byte("master"),
				[]byte("orphaned-branch"),
			},
			base: "",
		},
		{
			desc: "non-existent branch",
			revisions: [][]byte{
				[]byte("master"),
				[]byte("a-branch-that-does-not-exist"),
			},
			base: "",
		},
		{
			desc: "2+ revisions",
			revisions: [][]byte{
				[]byte("few-commits"),
				[]byte("master"),
				[]byte("570e7b2abdd848b95f2f578043fc23bd6f6fd24d"),
			},
			base: "1a0b36b3cdad1d2ee32457c102a8c0b7056fa863",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.desc, func(t *testing.T) {
			request := &gitalypb.FindMergeBaseRequest{
				Repository: repo,
				Revisions:  testCase.revisions,
			}

			response, err := client.FindMergeBase(ctx, request)
			require.NoError(t, err)

			require.Equal(t, testCase.base, response.Base)
		})
	}
}

func TestFailedFindMergeBaseRequestDueToValidations(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)
	_, repo, _, client := setupRepositoryService(t, ctx)
	for _, tc := range []struct {
		desc        string
		req         *gitalypb.FindMergeBaseRequest
		expectedErr error
	}{
		{
			desc: "no repository provided",
			req:  &gitalypb.FindMergeBaseRequest{Repository: nil},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			desc: "no enough revisions",
			req: &gitalypb.FindMergeBaseRequest{
				Repository: repo,
				Revisions:  [][]byte{[]byte("372ab6950519549b14d220271ee2322caa44d4eb")},
			},
			expectedErr: status.Error(codes.InvalidArgument, "at least 2 revisions are required"),
		},
	} {
		_, err := client.FindMergeBase(ctx, tc.req)
		testhelper.RequireGrpcError(t, tc.expectedErr, err)
	}
}
