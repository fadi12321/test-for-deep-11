//go:build !gitaly_test_sha256

package commit

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestSuccessfulCountCommitsRequest(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg, repo1, _, client := setupCommitServiceWithRepo(t, ctx)

	repo2, repo2Path := gittest.CreateRepository(t, ctx, cfg)

	commitOID := createCommits(t, cfg, repo2Path, "master", 5, "")
	createCommits(t, cfg, repo2Path, "another-branch", 3, commitOID)

	literalOptions := &gitalypb.GlobalOptions{LiteralPathspecs: true}

	testCases := []struct {
		repo                *gitalypb.Repository
		revision, path      []byte
		all                 bool
		options             *gitalypb.GlobalOptions
		before, after, desc string
		maxCount            int32
		count               int32
	}{
		{
			desc:     "revision only #1",
			repo:     repo1,
			revision: []byte("1a0b36b3cdad1d2ee32457c102a8c0b7056fa863"),
			count:    1,
		},
		{
			desc:     "revision only #2",
			repo:     repo1,
			revision: []byte("6d394385cf567f80a8fd85055db1ab4c5295806f"),
			count:    2,
		},
		{
			desc:     "revision only #3",
			repo:     repo1,
			revision: []byte("e63f41fe459e62e1228fcef60d7189127aeba95a"),
			count:    39,
		},
		{
			desc:     "revision + max-count",
			repo:     repo1,
			revision: []byte("e63f41fe459e62e1228fcef60d7189127aeba95a"),
			maxCount: 15,
			count:    15,
		},
		{
			desc:     "non-existing revision",
			repo:     repo1,
			revision: []byte("deadfacedeadfacedeadfacedeadfacedeadface"),
			count:    0,
		},
		{
			desc:     "revision + before",
			repo:     repo1,
			revision: []byte("e63f41fe459e62e1228fcef60d7189127aeba95a"),
			before:   "2015-12-07T11:54:28+01:00",
			count:    26,
		},
		{
			desc:     "revision + before + after",
			repo:     repo1,
			revision: []byte("e63f41fe459e62e1228fcef60d7189127aeba95a"),
			before:   "2015-12-07T11:54:28+01:00",
			after:    "2014-02-27T10:14:56+02:00",
			count:    23,
		},
		{
			desc:     "revision + before + after + path",
			repo:     repo1,
			revision: []byte("e63f41fe459e62e1228fcef60d7189127aeba95a"),
			before:   "2015-12-07T11:54:28+01:00",
			after:    "2014-02-27T10:14:56+02:00",
			path:     []byte("files"),
			count:    12,
		},
		{
			desc:     "revision + before + after + wildcard path",
			repo:     repo1,
			revision: []byte("e63f41fe459e62e1228fcef60d7189127aeba95a"),
			before:   "2015-12-07T11:54:28+01:00",
			after:    "2014-02-27T10:14:56+02:00",
			path:     []byte("files/*"),
			count:    12,
		},
		{
			desc:     "revision + before + after + non-existent literal pathspec",
			repo:     repo1,
			revision: []byte("e63f41fe459e62e1228fcef60d7189127aeba95a"),
			before:   "2015-12-07T11:54:28+01:00",
			after:    "2014-02-27T10:14:56+02:00",
			path:     []byte("files/*"),
			options:  literalOptions,
			count:    0,
		},
		{
			desc:  "all refs #1",
			repo:  repo2,
			all:   true,
			count: 8,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.desc, func(t *testing.T) {
			request := &gitalypb.CountCommitsRequest{Repository: testCase.repo, GlobalOptions: testCase.options}

			if testCase.all {
				request.All = true
			} else {
				request.Revision = testCase.revision
			}

			if testCase.before != "" {
				before, err := time.Parse(time.RFC3339, testCase.before)
				require.NoError(t, err)
				request.Before = &timestamppb.Timestamp{Seconds: before.Unix()}
			}

			if testCase.after != "" {
				after, err := time.Parse(time.RFC3339, testCase.after)
				require.NoError(t, err)
				request.After = &timestamppb.Timestamp{Seconds: after.Unix()}
			}

			if testCase.maxCount != 0 {
				request.MaxCount = testCase.maxCount
			}

			if testCase.path != nil {
				request.Path = testCase.path
			}

			response, err := client.CountCommits(ctx, request)
			require.NoError(t, err)
			require.Equal(t, response.Count, testCase.count)
		})
	}
}

func TestFailedCountCommitsRequestDueToValidationError(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	_, repo, _, client := setupCommitServiceWithRepo(t, ctx)

	revision := []byte("d42783470dc29fde2cf459eb3199ee1d7e3f3a72")

	for _, tc := range []struct {
		desc        string
		req         *gitalypb.CountCommitsRequest
		expectedErr error
	}{
		{
			desc: "Repository doesn't exist",
			req:  &gitalypb.CountCommitsRequest{Repository: &gitalypb.Repository{StorageName: "fake", RelativePath: "path"}, Revision: revision},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				`cmd: GetStorageByName: no such storage: "fake"`,
				"repo scoped: invalid Repository",
			)),
		},
		{
			desc: "Repository is nil",
			req:  &gitalypb.CountCommitsRequest{Repository: nil, Revision: revision},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			desc:        "Revision is empty and All is false",
			req:         &gitalypb.CountCommitsRequest{Repository: repo, Revision: nil, All: false},
			expectedErr: status.Error(codes.InvalidArgument, "empty Revision and false All"),
		},
		{
			desc:        "Revision is invalid",
			req:         &gitalypb.CountCommitsRequest{Repository: repo, Revision: []byte("--output=/meow"), All: false},
			expectedErr: status.Error(codes.InvalidArgument, "revision can't start with '-'"),
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			_, err := client.CountCommits(ctx, tc.req)
			testhelper.RequireGrpcError(t, tc.expectedErr, err)
		})
	}
}
