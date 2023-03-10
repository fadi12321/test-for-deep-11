//go:build !gitaly_test_sha256

package commit

import (
	"bytes"
	"fmt"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

type treeEntry struct {
	oid        string
	objectType gitalypb.TreeEntryResponse_ObjectType
	data       []byte
	mode       int32
	size       int64
}

func TestSuccessfulTreeEntry(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	_, repo, _, client := setupCommitServiceWithRepo(t, ctx)

	testCases := []struct {
		revision          []byte
		path              []byte
		limit             int64
		maxSize           int64
		expectedTreeEntry treeEntry
	}{
		{
			revision: []byte("913c66a37b4a45b9769037c55c2d238bd0942d2e"),
			path:     []byte("MAINTENANCE.md"),
			expectedTreeEntry: treeEntry{
				objectType: gitalypb.TreeEntryResponse_BLOB,
				oid:        "95d9f0a5e7bb054e9dd3975589b8dfc689e20e88",
				size:       1367,
				mode:       0o100644,
				data:       testhelper.MustReadFile(t, "testdata/maintenance-md-blob.txt"),
			},
		},
		{
			revision: []byte("913c66a37b4a45b9769037c55c2d238bd0942d2e"),
			path:     []byte("MAINTENANCE.md"),
			limit:    40 * 1024,
			expectedTreeEntry: treeEntry{
				objectType: gitalypb.TreeEntryResponse_BLOB,
				oid:        "95d9f0a5e7bb054e9dd3975589b8dfc689e20e88",
				size:       1367,
				mode:       0o100644,
				data:       testhelper.MustReadFile(t, "testdata/maintenance-md-blob.txt"),
			},
		},
		{
			revision: []byte("913c66a37b4a45b9769037c55c2d238bd0942d2e"),
			path:     []byte("MAINTENANCE.md"),
			maxSize:  40 * 1024,
			expectedTreeEntry: treeEntry{
				objectType: gitalypb.TreeEntryResponse_BLOB,
				oid:        "95d9f0a5e7bb054e9dd3975589b8dfc689e20e88",
				size:       1367,
				mode:       0o100644,
				data:       testhelper.MustReadFile(t, "testdata/maintenance-md-blob.txt"),
			},
		},
		{
			revision: []byte("38008cb17ce1466d8fec2dfa6f6ab8dcfe5cf49e"),
			path:     []byte("with space/README.md"),
			expectedTreeEntry: treeEntry{
				objectType: gitalypb.TreeEntryResponse_BLOB,
				oid:        "8c3014aceae45386c3c026a7ea4a1f68660d51d6",
				size:       36,
				mode:       0o100644,
				data:       testhelper.MustReadFile(t, "testdata/with-space-readme-md-blob.txt"),
			},
		},
		{
			revision: []byte("372ab6950519549b14d220271ee2322caa44d4eb"),
			path:     []byte("gitaly/file-with-multiple-chunks"),
			limit:    30 * 1024,
			expectedTreeEntry: treeEntry{
				objectType: gitalypb.TreeEntryResponse_BLOB,
				oid:        "1c69c4d2a65ad05c24ac3b6780b5748b97ffd3aa",
				size:       42220,
				mode:       0o100644,
				data:       testhelper.MustReadFile(t, "testdata/file-with-multiple-chunks-truncated-blob.txt"),
			},
		},
		{
			revision: []byte("e63f41fe459e62e1228fcef60d7189127aeba95a"),
			path:     []byte("gitlab-grack"),
			expectedTreeEntry: treeEntry{
				objectType: gitalypb.TreeEntryResponse_COMMIT,
				oid:        "645f6c4c82fd3f5e06f67134450a570b795e55a6",
				mode:       0o160000,
			},
		},
		{
			revision: []byte("c347ca2e140aa667b968e51ed0ffe055501fe4f4"),
			path:     []byte("files/js"),
			expectedTreeEntry: treeEntry{
				objectType: gitalypb.TreeEntryResponse_TREE,
				oid:        "31405c5ddef582c5a9b7a85230413ff90e2fe720",
				size:       83,
				mode:       0o40000,
			},
		},
		{
			revision: []byte("c347ca2e140aa667b968e51ed0ffe055501fe4f4"),
			path:     []byte("files/js/"),
			expectedTreeEntry: treeEntry{
				objectType: gitalypb.TreeEntryResponse_TREE,
				oid:        "31405c5ddef582c5a9b7a85230413ff90e2fe720",
				size:       83,
				mode:       0o40000,
			},
		},
		{
			revision: []byte("b83d6e391c22777fca1ed3012fce84f633d7fed0"),
			path:     []byte("foo/bar/.gitkeep"),
			expectedTreeEntry: treeEntry{
				objectType: gitalypb.TreeEntryResponse_BLOB,
				oid:        "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
				size:       0,
				mode:       0o100644,
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(fmt.Sprintf("test case: revision=%q path=%q", testCase.revision, testCase.path), func(t *testing.T) {
			request := &gitalypb.TreeEntryRequest{
				Repository: repo,
				Revision:   testCase.revision,
				Path:       testCase.path,
				Limit:      testCase.limit,
				MaxSize:    testCase.maxSize,
			}
			c, err := client.TreeEntry(ctx, request)
			require.NoError(t, err)

			assertExactReceivedTreeEntry(t, c, &testCase.expectedTreeEntry)
		})
	}
}

func TestFailedTreeEntry(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	_, repo, _, client := setupCommitServiceWithRepo(t, ctx)

	revision := []byte("d42783470dc29fde2cf459eb3199ee1d7e3f3a72")
	path := []byte("a/b/c")

	for _, tc := range []struct {
		name        string
		req         *gitalypb.TreeEntryRequest
		expectedErr error
	}{
		{
			name: "Repository doesn't exist",
			req:  &gitalypb.TreeEntryRequest{Repository: &gitalypb.Repository{StorageName: "fake", RelativePath: "path"}, Revision: revision, Path: path},
			expectedErr: structerr.NewInvalidArgument(testhelper.GitalyOrPraefect(
				"GetStorageByName: no such storage: \"fake\"",
				"repo scoped: invalid Repository",
			)),
		},
		{
			name: "Repository is nil",
			req:  &gitalypb.TreeEntryRequest{Repository: nil, Revision: revision, Path: path},
			expectedErr: structerr.NewInvalidArgument(testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			name:        "Revision is empty",
			req:         &gitalypb.TreeEntryRequest{Repository: repo, Revision: nil, Path: path},
			expectedErr: structerr.NewInvalidArgument("empty revision"),
		},
		{
			name:        "Path is empty",
			req:         &gitalypb.TreeEntryRequest{Repository: repo, Revision: revision},
			expectedErr: structerr.NewInvalidArgument("empty Path"),
		},
		{
			name:        "Revision is invalid",
			req:         &gitalypb.TreeEntryRequest{Repository: repo, Revision: []byte("--output=/meow"), Path: path},
			expectedErr: structerr.NewInvalidArgument("revision can't start with '-'"),
		},
		{
			name:        "Limit is negative",
			req:         &gitalypb.TreeEntryRequest{Repository: repo, Revision: revision, Path: path, Limit: -1},
			expectedErr: structerr.NewInvalidArgument("negative Limit"),
		},
		{
			name:        "MaximumSize is negative",
			req:         &gitalypb.TreeEntryRequest{Repository: repo, Revision: revision, Path: path, MaxSize: -1},
			expectedErr: structerr.NewInvalidArgument("negative MaxSize"),
		},
		{
			name:        "Object bigger than MaxSize",
			req:         &gitalypb.TreeEntryRequest{Repository: repo, Revision: []byte("913c66a37b4a45b9769037c55c2d238bd0942d2e"), Path: []byte("MAINTENANCE.md"), MaxSize: 10},
			expectedErr: structerr.NewFailedPrecondition("object size (1367) is bigger than the maximum allowed size (10)"),
		},
		{
			name:        "Path is outside of repository",
			req:         &gitalypb.TreeEntryRequest{Repository: repo, Revision: []byte("913c66a37b4a45b9769037c55c2d238bd0942d2e"), Path: []byte("../bar/.gitkeep")}, // Git blows up on paths like this
			expectedErr: structerr.NewNotFound("tree entry not found").WithInterceptedMetadata("path", "../bar/.gitkeep"),
		},
		{
			name:        "Missing file with space in path",
			req:         &gitalypb.TreeEntryRequest{Repository: repo, Revision: []byte("deadfacedeadfacedeadfacedeadfacedeadface"), Path: []byte("with space/README.md")},
			expectedErr: structerr.NewNotFound("tree entry not found").WithInterceptedMetadata("path", "with space/README.md"),
		},
		{
			name:        "Missing file",
			req:         &gitalypb.TreeEntryRequest{Repository: repo, Revision: []byte("e63f41fe459e62e1228fcef60d7189127aeba95a"), Path: []byte("missing.rb")},
			expectedErr: structerr.NewNotFound("tree entry not found").WithInterceptedMetadata("path", "missing.rb"),
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, err := client.TreeEntry(ctx, tc.req)
			require.NoError(t, err)

			err = drainTreeEntryResponse(c)
			testhelper.RequireGrpcError(t, tc.expectedErr, err)
		})
	}
}

func getTreeEntryFromTreeEntryClient(t *testing.T, client gitalypb.CommitService_TreeEntryClient) *treeEntry {
	t.Helper()

	fetchedTreeEntry := &treeEntry{}
	firstResponseReceived := false

	for {
		resp, err := client.Recv()
		if err == io.EOF {
			break
		}
		require.NoError(t, err)

		if !firstResponseReceived {
			firstResponseReceived = true
			fetchedTreeEntry.oid = resp.GetOid()
			fetchedTreeEntry.size = resp.GetSize()
			fetchedTreeEntry.mode = resp.GetMode()
			fetchedTreeEntry.objectType = resp.GetType()
		}
		fetchedTreeEntry.data = append(fetchedTreeEntry.data, resp.GetData()...)
	}

	return fetchedTreeEntry
}

func assertExactReceivedTreeEntry(t *testing.T, client gitalypb.CommitService_TreeEntryClient, expectedTreeEntry *treeEntry) {
	fetchedTreeEntry := getTreeEntryFromTreeEntryClient(t, client)

	if fetchedTreeEntry.oid != expectedTreeEntry.oid {
		t.Errorf("Expected tree entry OID to be %q, got %q", expectedTreeEntry.oid, fetchedTreeEntry.oid)
	}

	if fetchedTreeEntry.objectType != expectedTreeEntry.objectType {
		t.Errorf("Expected tree entry object type to be %d, got %d", expectedTreeEntry.objectType, fetchedTreeEntry.objectType)
	}

	if !bytes.Equal(fetchedTreeEntry.data, expectedTreeEntry.data) {
		t.Errorf("Expected tree entry data to be %q, got %q", expectedTreeEntry.data, fetchedTreeEntry.data)
	}

	if fetchedTreeEntry.size != expectedTreeEntry.size {
		t.Errorf("Expected tree entry size to be %d, got %d", expectedTreeEntry.size, fetchedTreeEntry.size)
	}

	if fetchedTreeEntry.mode != expectedTreeEntry.mode {
		t.Errorf("Expected tree entry mode to be %o, got %o", expectedTreeEntry.mode, fetchedTreeEntry.mode)
	}
}

func drainTreeEntryResponse(c gitalypb.CommitService_TreeEntryClient) error {
	var err error
	for err == nil {
		_, err = c.Recv()
	}
	return err
}
