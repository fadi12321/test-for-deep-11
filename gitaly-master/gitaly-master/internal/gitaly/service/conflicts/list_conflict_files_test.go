//go:build !gitaly_test_sha256

package conflicts

import (
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type conflictFile struct {
	Header  *gitalypb.ConflictFileHeader
	Content []byte
}

func TestSuccessfulListConflictFilesRequest(t *testing.T) {
	ctx := testhelper.Context(t)

	_, repo, _, client := setupConflictsService(t, ctx, nil)

	ourCommitOid := "1a35b5a77cf6af7edf6703f88e82f6aff613666f"
	theirCommitOid := "8309e68585b28d61eb85b7e2834849dda6bf1733"

	conflictContent1 := `<<<<<<< encoding/codagé
Content is not important, file name is
=======
Content can be important, but here, file name is of utmost importance
>>>>>>> encoding/codagé
`
	conflictContent2 := `<<<<<<< files/ruby/feature.rb
class Feature
  def foo
    puts 'bar'
  end
=======
# This file was changed in feature branch
# We put different code here to make merge conflict
class Conflict
>>>>>>> files/ruby/feature.rb
end
`

	request := &gitalypb.ListConflictFilesRequest{
		Repository:     repo,
		OurCommitOid:   ourCommitOid,
		TheirCommitOid: theirCommitOid,
	}

	c, err := client.ListConflictFiles(ctx, request)
	require.NoError(t, err)

	expectedFiles := []*conflictFile{
		{
			Header: &gitalypb.ConflictFileHeader{
				CommitOid: ourCommitOid,
				OurMode:   int32(0o100644),
				OurPath:   []byte("encoding/codagé"),
				TheirPath: []byte("encoding/codagé"),
			},
			Content: []byte(conflictContent1),
		},
		{
			Header: &gitalypb.ConflictFileHeader{
				CommitOid: ourCommitOid,
				OurMode:   int32(0o100644),
				OurPath:   []byte("files/ruby/feature.rb"),
				TheirPath: []byte("files/ruby/feature.rb"),
			},
			Content: []byte(conflictContent2),
		},
	}

	testhelper.ProtoEqual(t, expectedFiles, getConflictFiles(t, c))
}

func TestSuccessfulListConflictFilesRequestWithAncestor(t *testing.T) {
	ctx := testhelper.Context(t)

	_, repo, _, client := setupConflictsService(t, ctx, nil)

	ourCommitOid := "824be604a34828eb682305f0d963056cfac87b2d"
	theirCommitOid := "1450cd639e0bc6721eb02800169e464f212cde06"

	request := &gitalypb.ListConflictFilesRequest{
		Repository:     repo,
		OurCommitOid:   ourCommitOid,
		TheirCommitOid: theirCommitOid,
	}

	c, err := client.ListConflictFiles(ctx, request)
	require.NoError(t, err)

	expectedFiles := []*conflictFile{
		{
			Header: &gitalypb.ConflictFileHeader{
				CommitOid:    ourCommitOid,
				OurMode:      int32(0o100644),
				OurPath:      []byte("files/ruby/popen.rb"),
				TheirPath:    []byte("files/ruby/popen.rb"),
				AncestorPath: []byte("files/ruby/popen.rb"),
			},
		},
		{
			Header: &gitalypb.ConflictFileHeader{
				CommitOid:    ourCommitOid,
				OurMode:      int32(0o100644),
				OurPath:      []byte("files/ruby/regex.rb"),
				TheirPath:    []byte("files/ruby/regex.rb"),
				AncestorPath: []byte("files/ruby/regex.rb"),
			},
		},
	}

	receivedFiles := getConflictFiles(t, c)
	require.Len(t, receivedFiles, len(expectedFiles))

	for i := 0; i < len(expectedFiles); i++ {
		testhelper.ProtoEqual(t, receivedFiles[i].Header, expectedFiles[i].Header)
	}
}

func TestListConflictFilesHugeDiff(t *testing.T) {
	ctx := testhelper.Context(t)

	cfg, repo, repoPath, client := setupConflictsService(t, ctx, nil)

	ourCommitID := gittest.WriteCommit(t, cfg, repoPath, gittest.WithTreeEntries(
		gittest.TreeEntry{Path: "a", Mode: "100644", Content: strings.Repeat("a\n", 128*1024)},
		gittest.TreeEntry{Path: "b", Mode: "100644", Content: strings.Repeat("b\n", 128*1024)},
	))
	theirCommitID := gittest.WriteCommit(t, cfg, repoPath, gittest.WithTreeEntries(
		gittest.TreeEntry{Path: "a", Mode: "100644", Content: strings.Repeat("x\n", 128*1024)},
		gittest.TreeEntry{Path: "b", Mode: "100644", Content: strings.Repeat("y\n", 128*1024)},
	))

	request := &gitalypb.ListConflictFilesRequest{
		Repository:     repo,
		OurCommitOid:   ourCommitID.String(),
		TheirCommitOid: theirCommitID.String(),
	}

	c, err := client.ListConflictFiles(ctx, request)
	require.NoError(t, err)

	receivedFiles := getConflictFiles(t, c)
	testhelper.ProtoEqual(t, &gitalypb.ConflictFileHeader{
		CommitOid: ourCommitID.String(),
		OurMode:   int32(0o100644),
		OurPath:   []byte("a"),
		TheirPath: []byte("a"),
	}, receivedFiles[0].Header)

	testhelper.ProtoEqual(t, &gitalypb.ConflictFileHeader{
		CommitOid: ourCommitID.String(),
		OurMode:   int32(0o100644),
		OurPath:   []byte("b"),
		TheirPath: []byte("b"),
	}, receivedFiles[1].Header)
}

func TestListConflictFilesFailedPrecondition(t *testing.T) {
	ctx := testhelper.Context(t)

	_, repo, _, client := setupConflictsService(t, ctx, nil)

	testCases := []struct {
		desc           string
		ourCommitOid   string
		theirCommitOid string
	}{
		{
			desc:           "conflict side missing",
			ourCommitOid:   "eb227b3e214624708c474bdab7bde7afc17cefcc",
			theirCommitOid: "824be604a34828eb682305f0d963056cfac87b2d",
		},
		{
			// These commits have a conflict on the 'VERSION' file in the test repo.
			// The conflict is expected to raise an encoding error.
			desc:           "encoding error",
			ourCommitOid:   "bd493d44ae3c4dd84ce89cb75be78c4708cbd548",
			theirCommitOid: "7df99c9ad5b8c9bfc5ae4fb7a91cc87adcce02ef",
		},
		{
			desc:           "submodule object lookup error",
			ourCommitOid:   "de78448b0b504f3f60093727bddfda1ceee42345",
			theirCommitOid: "2f61d70f862c6a4f782ef7933e020a118282db29",
		},
		{
			desc:           "invalid commit id on 'our' side",
			ourCommitOid:   "abcdef0000000000000000000000000000000000",
			theirCommitOid: "1a35b5a77cf6af7edf6703f88e82f6aff613666f",
		},
		{
			desc:           "invalid commit id on 'their' side",
			ourCommitOid:   "1a35b5a77cf6af7edf6703f88e82f6aff613666f",
			theirCommitOid: "abcdef0000000000000000000000000000000000",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			request := &gitalypb.ListConflictFilesRequest{
				Repository:     repo,
				OurCommitOid:   tc.ourCommitOid,
				TheirCommitOid: tc.theirCommitOid,
			}

			c, err := client.ListConflictFiles(ctx, request)
			if err == nil {
				err = drainListConflictFilesResponse(c)
			}

			testhelper.RequireGrpcCode(t, err, codes.FailedPrecondition)
		})
	}
}

func TestListConflictFilesAllowTreeConflicts(t *testing.T) {
	ctx := testhelper.Context(t)

	_, repo, _, client := setupConflictsService(t, ctx, nil)

	ourCommitOid := "eb227b3e214624708c474bdab7bde7afc17cefcc"
	theirCommitOid := "824be604a34828eb682305f0d963056cfac87b2d"

	request := &gitalypb.ListConflictFilesRequest{
		Repository:         repo,
		OurCommitOid:       ourCommitOid,
		TheirCommitOid:     theirCommitOid,
		AllowTreeConflicts: true,
	}

	c, err := client.ListConflictFiles(ctx, request)
	require.NoError(t, err)

	conflictContent := `<<<<<<< files/ruby/version_info.rb
module Gitlab
  class VersionInfo
    include Comparable

    attr_reader :major, :minor, :patch

    def self.parse(str)
      if str && m = str.match(%r{(\d+)\.(\d+)\.(\d+)})
        VersionInfo.new(m[1].to_i, m[2].to_i, m[3].to_i)
      else
        VersionInfo.new
      end
    end

    def initialize(major = 0, minor = 0, patch = 0)
      @major = major
      @minor = minor
      @patch = patch
    end

    def <=>(other)
      return unless other.is_a? VersionInfo
      return unless valid? && other.valid?

      if other.major < @major
        1
      elsif @major < other.major
        -1
      elsif other.minor < @minor
        1
      elsif @minor < other.minor
        -1
      elsif other.patch < @patch
        1
      elsif @patch < other.patch
        25
      else
        0
      end
    end

    def to_s
      if valid?
        "%d.%d.%d" % [@major, @minor, @patch]
      else
        "Unknown"
      end
    end

    def valid?
      @major >= 0 && @minor >= 0 && @patch >= 0 && @major + @minor + @patch > 0
    end
  end
end
=======
>>>>>>> 
`

	expectedFiles := []*conflictFile{
		{
			Header: &gitalypb.ConflictFileHeader{
				AncestorPath: []byte("files/ruby/version_info.rb"),
				CommitOid:    ourCommitOid,
				OurMode:      int32(0o100644),
				OurPath:      []byte("files/ruby/version_info.rb"),
			},
			Content: []byte(conflictContent),
		},
	}

	testhelper.ProtoEqual(t, expectedFiles, getConflictFiles(t, c))
}

func TestFailedListConflictFilesRequestDueToValidation(t *testing.T) {
	ctx := testhelper.Context(t)

	_, repo, _, client := setupConflictsService(t, ctx, nil)

	ourCommitOid := "0b4bc9a49b562e85de7cc9e834518ea6828729b9"
	theirCommitOid := "bb5206fee213d983da88c47f9cf4cc6caf9c66dc"

	testCases := []struct {
		desc        string
		request     *gitalypb.ListConflictFilesRequest
		expectedErr error
	}{
		{
			desc: "empty repo",
			request: &gitalypb.ListConflictFilesRequest{
				Repository:     nil,
				OurCommitOid:   ourCommitOid,
				TheirCommitOid: theirCommitOid,
			},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			desc: "empty OurCommitId field",
			request: &gitalypb.ListConflictFilesRequest{
				Repository:     repo,
				OurCommitOid:   "",
				TheirCommitOid: theirCommitOid,
			},
			expectedErr: status.Error(codes.InvalidArgument, "empty OurCommitOid"),
		},
		{
			desc: "empty TheirCommitId field",
			request: &gitalypb.ListConflictFilesRequest{
				Repository:     repo,
				OurCommitOid:   ourCommitOid,
				TheirCommitOid: "",
			},
			expectedErr: status.Error(codes.InvalidArgument, "empty TheirCommitOid"),
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.desc, func(t *testing.T) {
			c, _ := client.ListConflictFiles(ctx, testCase.request)
			testhelper.RequireGrpcError(t, testCase.expectedErr, drainListConflictFilesResponse(c))
		})
	}
}

func getConflictFiles(t *testing.T, c gitalypb.ConflictsService_ListConflictFilesClient) []*conflictFile {
	t.Helper()

	var files []*conflictFile
	var currentFile *conflictFile

	for {
		r, err := c.Recv()
		if err == io.EOF {
			break
		}
		require.NoError(t, err)

		for _, file := range r.GetFiles() {
			// If there's a header this is the beginning of a new file
			if header := file.GetHeader(); header != nil {
				if currentFile != nil {
					files = append(files, currentFile)
				}

				currentFile = &conflictFile{Header: header}
			} else {
				// Append to current file's content
				currentFile.Content = append(currentFile.Content, file.GetContent()...)
			}
		}
	}

	// Append leftover file
	files = append(files, currentFile)

	return files
}

func drainListConflictFilesResponse(c gitalypb.ConflictsService_ListConflictFilesClient) error {
	var err error
	for err == nil {
		_, err = c.Recv()
	}
	return err
}
