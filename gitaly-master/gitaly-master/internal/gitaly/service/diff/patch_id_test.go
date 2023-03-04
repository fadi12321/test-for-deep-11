package diff

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

func TestGetPatchID(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg, client := setupDiffServiceWithoutRepo(t)

	gitVersion, err := gittest.NewCommandFactory(t, cfg).GitVersion(ctx)
	require.NoError(t, err)

	type setupData struct {
		request          *gitalypb.GetPatchIDRequest
		expectedResponse *gitalypb.GetPatchIDResponse
		expectedErr      error
	}

	testCases := []struct {
		desc  string
		setup func(t *testing.T) setupData
	}{
		{
			desc: "retruns patch-id successfully",
			setup: func(t *testing.T) setupData {
				repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg)

				oldCommit := gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "file", Mode: "100644", Content: "old"},
					),
				)
				gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithBranch("main"),
					gittest.WithParents(oldCommit),
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "file", Mode: "100644", Content: "new"},
					),
				)

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						OldRevision: []byte("main~"),
						NewRevision: []byte("main"),
					},
					expectedResponse: &gitalypb.GetPatchIDResponse{
						PatchId: "a79c7e9df0094ee44fa7a2a9ae27e914e6b7e00b",
					},
				}
			},
		},
		{
			desc: "returns patch-id successfully with commit ids",
			setup: func(t *testing.T) setupData {
				repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg)

				oldCommit := gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "file", Mode: "100644", Content: "old"},
					),
				)
				newCommit := gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "file", Mode: "100644", Content: "new"},
					),
				)

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						OldRevision: []byte(oldCommit),
						NewRevision: []byte(newCommit),
					},
					expectedResponse: &gitalypb.GetPatchIDResponse{
						PatchId: "a79c7e9df0094ee44fa7a2a9ae27e914e6b7e00b",
					},
				}
			},
		},
		{
			desc: "returns patch-id successfully for a specific file",
			setup: func(t *testing.T) setupData {
				repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg)

				oldCommit := gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "file", Mode: "100644", Content: "old"},
					),
				)
				newCommit := gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "file", Mode: "100644", Content: "new"},
					),
				)

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						OldRevision: []byte(fmt.Sprintf("%s:file", oldCommit)),
						NewRevision: []byte(fmt.Sprintf("%s:file", newCommit)),
					},
					expectedResponse: &gitalypb.GetPatchIDResponse{
						PatchId: "a79c7e9df0094ee44fa7a2a9ae27e914e6b7e00b",
					},
				}
			},
		},
		{
			desc: "returns patch-id with binary file",
			setup: func(t *testing.T) setupData {
				repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg)

				oldCommit := gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "binary", Mode: "100644", Content: "\000old"},
					),
				)
				newCommit := gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "binary", Mode: "100644", Content: "\000new"},
					),
				)

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						OldRevision: []byte(oldCommit),
						NewRevision: []byte(newCommit),
					},
					expectedResponse: &gitalypb.GetPatchIDResponse{
						PatchId: func() string {
							// Before Git v2.39.0, git-patch-id(1) would skip over any
							// lines that have an "index " prefix. This causes issues
							// with diffs of binaries though: we don't generate the diff
							// with `--binary`, so the "index" line that contains the
							// pre- and post-image blob IDs of the binary is the only
							// bit of information we have that something changed. But
							// because Git used to skip over it we wouldn't actually
							// take into account the contents of the changed blob at
							// all.
							//
							// This was fixed in Git v2.39.0 so that "index" lines will
							// now be hashed to correctly account for binary changes. As
							// a result, the patch ID has changed.
							if gitVersion.PatchIDRespectsBinaries() {
								switch gittest.DefaultObjectHash.Format {
								case "sha1":
									return "13e4e9b9cd44ec511bac24fdbdeab9b74ba3000b"
								case "sha256":
									return "32f6beb9a210ac89a3e15e44dcd174c87c904e9d"
								default:
									require.FailNow(t, "unsupported object hash")
									return ""
								}
							}

							return "715883c1b90a5b4450072e22fefec769ad346266"
						}(),
					},
				}
			},
		},
		{
			// This test is essentially the same test set up as the preceding one, but
			// with different binary contents. This is done to ensure that we indeed
			// generate different patch IDs as expected.
			desc: "different binary diff has different patch ID",
			setup: func(t *testing.T) setupData {
				repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg)

				oldCommit := gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "binary", Mode: "100644", Content: "\000old2"},
					),
				)
				newCommit := gittest.WriteCommit(t, cfg, repoPath,
					gittest.WithTreeEntries(
						gittest.TreeEntry{Path: "binary", Mode: "100644", Content: "\000new2"},
					),
				)

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						OldRevision: []byte(oldCommit),
						NewRevision: []byte(newCommit),
					},
					expectedResponse: &gitalypb.GetPatchIDResponse{
						PatchId: func() string {
							if gitVersion.PatchIDRespectsBinaries() {
								// When respecting binary diffs we indeed have a
								// different patch ID compared to the preceding
								// testcase.
								switch gittest.DefaultObjectHash.Format {
								case "sha1":
									return "f678855867b112ac2c5466260b3b3a5e75fca875"
								case "sha256":
									return "10443cf318b577ea41526825ba034aaaedfeaa4b"
								default:
									require.FailNow(t, "unsupported object hash")
									return ""
								}
							}

							// But when git-patch-id(1) is not paying respect to binary
							// diffs we incorrectly return the same patch ID. This is
							// nothing we can easily fix though.
							return "715883c1b90a5b4450072e22fefec769ad346266"
						}(),
					},
				}
			},
		},
		{
			desc: "file didn't exist in the old revision",
			setup: func(t *testing.T) setupData {
				repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg)

				oldCommit := gittest.WriteCommit(t, cfg, repoPath)
				newCommit := gittest.WriteCommit(t, cfg, repoPath, gittest.WithTreeEntries(
					gittest.TreeEntry{Path: "file", Mode: "100644", Content: "new"},
				))

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						OldRevision: []byte(fmt.Sprintf("%s:file", oldCommit)),
						NewRevision: []byte(fmt.Sprintf("%s:file", newCommit)),
					},
					expectedErr: structerr.New("waiting for git-diff: exit status 128").
						WithInterceptedMetadata("stderr", fmt.Sprintf("fatal: path 'file' does not exist in '%s'\n", oldCommit)),
				}
			},
		},
		{
			desc: "unknown revisions",
			setup: func(t *testing.T) setupData {
				repoProto, _ := gittest.CreateRepository(t, ctx, cfg)

				newRevision := strings.Replace(string(gittest.DefaultObjectHash.ZeroOID), "0", "1", -1)

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						OldRevision: []byte(gittest.DefaultObjectHash.ZeroOID),
						NewRevision: []byte(newRevision),
					},
					expectedErr: structerr.New("waiting for git-diff: exit status 128").
						WithInterceptedMetadata("stderr", fmt.Sprintf("fatal: bad object %s\n", gittest.DefaultObjectHash.ZeroOID)),
				}
			},
		},
		{
			desc: "no diff from the given revisions",
			setup: func(t *testing.T) setupData {
				repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg)

				commit := gittest.WriteCommit(t, cfg, repoPath)

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						OldRevision: []byte(commit),
						NewRevision: []byte(commit),
					},
					expectedErr: structerr.NewFailedPrecondition("no difference between old and new revision"),
				}
			},
		},
		{
			desc: "empty repository",
			setup: func(t *testing.T) setupData {
				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  nil,
						OldRevision: []byte("HEAD~1"),
						NewRevision: []byte("HEAD"),
					},
					expectedErr: structerr.NewInvalidArgument(testhelper.GitalyOrPraefect(
						"empty Repository",
						"repo scoped: empty Repository",
					)),
				}
			},
		},
		{
			desc: "empty old revision",
			setup: func(t *testing.T) setupData {
				repoProto, _ := gittest.CreateRepository(t, ctx, cfg)

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						NewRevision: []byte("HEAD"),
					},
					expectedErr: structerr.NewInvalidArgument("empty OldRevision"),
				}
			},
		},
		{
			desc: "empty new revision",
			setup: func(t *testing.T) setupData {
				repoProto, _ := gittest.CreateRepository(t, ctx, cfg)

				return setupData{
					request: &gitalypb.GetPatchIDRequest{
						Repository:  repoProto,
						OldRevision: []byte("HEAD~1"),
					},
					expectedErr: structerr.NewInvalidArgument("empty NewRevision"),
				}
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.desc, func(t *testing.T) {
			t.Parallel()

			setupData := tc.setup(t)
			response, err := client.GetPatchID(ctx, setupData.request)

			testhelper.RequireGrpcError(t, setupData.expectedErr, err)
			testhelper.ProtoEqual(t, setupData.expectedResponse, response)
		})
	}
}
