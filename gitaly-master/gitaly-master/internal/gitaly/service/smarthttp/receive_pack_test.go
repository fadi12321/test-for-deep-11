//go:build !gitaly_test_sha256

package smarthttp

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/backchannel"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/pktline"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	gitalyhook "gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/hook"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitlab"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/text"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata/featureflag"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testserver"
	"gitlab.com/gitlab-org/gitaly/v15/internal/transaction/txinfo"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"gitlab.com/gitlab-org/gitaly/v15/streamio"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	uploadPackCapabilities = "report-status side-band-64k agent=git/2.12.0"
)

func TestPostReceivePack_successful(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	cfg.GitlabShell.Dir = "/foo/bar/gitlab-shell"
	gitCmdFactory, hookOutputFile := gittest.CaptureHookEnv(t, cfg)

	server := startSmartHTTPServerWithOptions(t, cfg, nil, []testserver.GitalyServerOpt{
		testserver.WithGitCommandFactory(gitCmdFactory),
	})
	cfg.SocketPath = server.Address()

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})
	repo.GlProjectPath = "project/path"

	client, conn := newSmartHTTPClient(t, server.Address(), cfg.Auth.Token)
	defer conn.Close()

	// Below, we test whether extracting the hooks payload leads to the expected
	// results. Part of this payload are feature flags, so we need to get them into a
	// deterministic state such that we can compare them properly. While we wouldn't
	// need to inject them in "normal" Gitaly tests, Praefect will inject all unset
	// feature flags and set them to `false` -- as a result, we have a mismatch between
	// the context's feature flags we see here and the context's metadata as it would
	// arrive on the proxied Gitaly. To fix this, we thus inject all feature flags
	// explicitly here.
	for _, ff := range featureflag.DefinedFlags() {
		ctx = featureflag.OutgoingCtxWithFeatureFlag(ctx, ff, true)
		ctx = featureflag.IncomingCtxWithFeatureFlag(ctx, ff, true)
	}

	stream, err := client.PostReceivePack(ctx)
	require.NoError(t, err)

	_, newCommitID, request := createPushRequest(t, cfg)
	response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
		Repository:   repo,
		GlUsername:   "user",
		GlId:         "123",
		GlRepository: "project-456",
	}, request)

	requireSideband(t, []string{
		"0049\x01000eunpack ok\n0019ok refs/heads/master\n0019ok refs/heads/branch\n0000",
	}, response)

	// The fact that this command succeeds means that we got the commit correctly, no further
	// checks should be needed.
	gittest.Exec(t, cfg, "-C", repoPath, "show", newCommitID.String())

	envData := testhelper.MustReadFile(t, hookOutputFile)
	payload, err := git.HooksPayloadFromEnv(strings.Split(string(envData), "\n"))
	require.NoError(t, err)

	// Compare the repository up front so that we can use require.Equal for
	// the remaining values.
	testhelper.ProtoEqual(t, gittest.RewrittenRepository(t, ctx, cfg, repo), payload.Repo)
	payload.Repo = nil

	// If running tests with Praefect, then the transaction would be set, but we have no way of
	// figuring out their actual contents. So let's just remove it, too.
	payload.Transaction = nil

	var expectedFeatureFlags []git.FeatureFlagWithValue
	for feature, enabled := range featureflag.FromContext(ctx) {
		expectedFeatureFlags = append(expectedFeatureFlags, git.FeatureFlagWithValue{
			Flag: feature, Enabled: enabled,
		})
	}

	// Compare here without paying attention to the order given that flags aren't sorted and
	// unset the struct member afterwards.
	require.ElementsMatch(t, expectedFeatureFlags, payload.FeatureFlagsWithValue)
	payload.FeatureFlagsWithValue = nil

	require.Equal(t, git.HooksPayload{
		RuntimeDir:          cfg.RuntimeDir,
		InternalSocket:      cfg.InternalSocketPath(),
		InternalSocketToken: cfg.Auth.Token,
		UserDetails: &git.UserDetails{
			UserID:   "123",
			Username: "user",
			Protocol: "http",
		},
		RequestedHooks: git.ReceivePackHooks,
	}, payload)
}

func TestPostReceivePack_hiddenRefs(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	cfg.SocketPath = runSmartHTTPServer(t, cfg)

	repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})
	repoProto.GlProjectPath = "project/path"

	testcfg.BuildGitalyHooks(t, cfg)

	repo := localrepo.NewTestRepo(t, cfg, repoProto)
	oldHead, err := repo.ResolveRevision(ctx, "HEAD~")
	require.NoError(t, err)
	newHead, err := repo.ResolveRevision(ctx, "HEAD")
	require.NoError(t, err)

	client, conn := newSmartHTTPClient(t, cfg.SocketPath, cfg.Auth.Token)
	defer conn.Close()

	for _, ref := range []string{
		"refs/environments/1",
		"refs/merge-requests/1/head",
		"refs/merge-requests/1/merge",
		"refs/pipelines/1",
	} {
		t.Run(ref, func(t *testing.T) {
			var request bytes.Buffer
			gittest.WritePktlinef(t, &request, "%s %s %s\x00 %s", oldHead, newHead, ref, uploadPackCapabilities)
			gittest.WritePktlineFlush(t, &request)

			// The options passed are the same ones used when doing an actual push.
			revisions := strings.NewReader(fmt.Sprintf("^%s\n%s\n", oldHead, newHead))
			gittest.ExecOpts(t, cfg, gittest.ExecConfig{Stdin: revisions, Stdout: &request},
				"-C", repoPath, "pack-objects", "--stdout", "--revs", "--thin", "--delta-base-offset", "-q",
			)

			stream, err := client.PostReceivePack(ctx)
			require.NoError(t, err)

			response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
				Repository:   repoProto,
				GlUsername:   "user",
				GlId:         "123",
				GlRepository: "project-456",
			}, &request)

			require.Contains(t, response, fmt.Sprintf("%s deny updating a hidden ref", ref))
		})
	}
}

func TestPostReceivePack_protocolV2(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	testcfg.BuildGitalyHooks(t, cfg)

	protocolDetectingFactory := gittest.NewProtocolDetectingCommandFactory(t, ctx, cfg)

	server := startSmartHTTPServerWithOptions(t, cfg, nil, []testserver.GitalyServerOpt{
		testserver.WithGitCommandFactory(protocolDetectingFactory),
	})
	cfg.SocketPath = server.Address()

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	client, conn := newSmartHTTPClient(t, server.Address(), cfg.Auth.Token)
	defer conn.Close()

	stream, err := client.PostReceivePack(ctx)
	require.NoError(t, err)

	_, newCommitID, request := createPushRequest(t, cfg)
	performPush(t, stream, &gitalypb.PostReceivePackRequest{
		Repository:   repo,
		GlId:         "user-123",
		GlRepository: "project-123",
		GitProtocol:  git.ProtocolV2,
	}, request)

	envData := protocolDetectingFactory.ReadProtocol(t)
	require.Equal(t, fmt.Sprintf("GIT_PROTOCOL=%s\n", git.ProtocolV2), envData)

	// The fact that this command succeeds means that we got the commit correctly, no further checks should be needed.
	gittest.Exec(t, cfg, "-C", repoPath, "show", newCommitID.String())
}

func TestPostReceivePack_packfiles(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	cfg.SocketPath = startSmartHTTPServer(t, cfg).Address()
	testcfg.BuildGitalyHooks(t, cfg)

	client, conn := newSmartHTTPClient(t, cfg.SocketPath, cfg.Auth.Token)
	defer conn.Close()

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	stream, err := client.PostReceivePack(ctx)
	require.NoError(t, err)

	// Verify the before-state of the repository. It should have a single packfile, ...
	packfiles, err := filepath.Glob(filepath.Join(repoPath, "objects", "pack", "*.pack"))
	require.NoError(t, err)
	require.Len(t, packfiles, 1)

	// ... but no reverse index. `gittest.CreateRepository()` uses `CreateRepositoryFromURL()`
	// with a file path that doesn't use `file://` as prefix. As a result, Git uses the local
	// transport and just copies objects over without generating a reverse index. This is thus
	// expected as we don't want to perform a "real" clone, which would be a lot more expensive.
	reverseIndices, err := filepath.Glob(filepath.Join(repoPath, "objects", "pack", "*.rev"))
	require.NoError(t, err)
	require.Empty(t, reverseIndices)

	_, _, request := createPushRequest(t, cfg)
	performPush(t, stream, &gitalypb.PostReceivePackRequest{
		Repository:   repo,
		GlId:         "user-123",
		GlRepository: "project-123",
		GitProtocol:  git.ProtocolV2,
		// By default, Git would unpack the received packfile if it has less than
		// 100 objects. Decrease this limit so that we indeed end up with another
		// new packfile even though we only push a small set of objects.
		GitConfigOptions: []string{
			"receive.unpackLimit=0",
		},
	}, request)

	// We now should have two packfiles, ...
	packfiles, err = filepath.Glob(filepath.Join(repoPath, "objects", "pack", "*.pack"))
	require.NoError(t, err)
	require.Len(t, packfiles, 2)

	// ... and one reverse index for the newly added packfile.
	reverseIndices, err = filepath.Glob(filepath.Join(repoPath, "objects", "pack", "*.rev"))
	require.NoError(t, err)
	require.Len(t, reverseIndices, 1)
}

func TestPostReceivePack_rejectViaGitConfigOptions(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	cfg.SocketPath = runSmartHTTPServer(t, cfg)

	repo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	client, conn := newSmartHTTPClient(t, cfg.SocketPath, cfg.Auth.Token)
	defer conn.Close()

	stream, err := client.PostReceivePack(ctx)
	require.NoError(t, err)

	_, _, request := createPushRequest(t, cfg)
	response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
		Repository:       repo,
		GlId:             "user-123",
		GlRepository:     "project-123",
		GitConfigOptions: []string{"receive.MaxInputSize=1"},
	}, request)

	requireSideband(t, []string{
		"002e\x02fatal: pack exceeds maximum allowed size\n",
		"0081\x010028unpack unpack-objects abnormal exit\n0028ng refs/heads/master unpacker error\n0028ng refs/heads/branch unpacker error\n0000",
	}, response)
}

func TestPostReceivePack_rejectViaHooks(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	gitCmdFactory := gittest.NewCommandFactory(t, cfg, git.WithHooksPath(testhelper.TempDir(t)))

	testhelper.WriteExecutable(t, filepath.Join(gitCmdFactory.HooksPath(ctx), "pre-receive"), []byte("#!/bin/sh\nexit 1"))

	server := startSmartHTTPServerWithOptions(t, cfg, nil, []testserver.GitalyServerOpt{
		testserver.WithGitCommandFactory(gitCmdFactory),
	})
	cfg.SocketPath = server.Address()

	repo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	client, conn := newSmartHTTPClient(t, server.Address(), cfg.Auth.Token)
	defer conn.Close()

	stream, err := client.PostReceivePack(ctx)
	require.NoError(t, err)

	_, _, request := createPushRequest(t, cfg)
	response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
		Repository:   repo,
		GlId:         "user-123",
		GlRepository: "project-123",
	}, request)

	requireSideband(t, []string{
		"007d\x01000eunpack ok\n0033ng refs/heads/master pre-receive hook declined\n0033ng refs/heads/branch pre-receive hook declined\n0000",
	}, response)
}

func TestPostReceivePack_requestValidation(t *testing.T) {
	t.Parallel()

	cfg := testcfg.Build(t)

	serverSocketPath := runSmartHTTPServer(t, cfg)

	client, conn := newSmartHTTPClient(t, serverSocketPath, cfg.Auth.Token)
	defer conn.Close()

	for _, tc := range []struct {
		desc        string
		request     *gitalypb.PostReceivePackRequest
		expectedErr error
	}{
		{
			desc: "Repository doesn't exist",
			request: &gitalypb.PostReceivePackRequest{
				Repository: &gitalypb.Repository{
					StorageName:  "fake",
					RelativePath: "path",
				},
				GlId: "user-123",
			},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				`GetStorageByName: no such storage: "fake"`,
				"repo scoped: invalid Repository",
			)),
		},
		{
			desc:    "Repository is nil",
			request: &gitalypb.PostReceivePackRequest{Repository: nil, GlId: "user-123"},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			desc: "Empty GlId",
			request: &gitalypb.PostReceivePackRequest{
				Repository: &gitalypb.Repository{
					StorageName:  cfg.Storages[0].Name,
					RelativePath: "path/to/repo",
				},
				GlId: "",
			},
			expectedErr: func() error {
				if testhelper.IsPraefectEnabled() {
					return structerr.NewNotFound("mutator call: route repository mutator: get repository id: repository %q/%q not found", cfg.Storages[0].Name, "path/to/repo")
				}

				return structerr.NewInvalidArgument("empty GlId")
			}(),
		},
		{
			desc: "Data exists on first request",
			request: &gitalypb.PostReceivePackRequest{
				Repository: &gitalypb.Repository{
					StorageName:  cfg.Storages[0].Name,
					RelativePath: "path/to/repo",
				},
				GlId: "user-123",
				Data: []byte("Fail"),
			},
			expectedErr: func() error {
				if testhelper.IsPraefectEnabled() {
					return structerr.NewNotFound("mutator call: route repository mutator: get repository id: repository %q/%q not found", cfg.Storages[0].Name, "path/to/repo")
				}

				return structerr.NewInvalidArgument("non-empty Data")
			}(),
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			ctx := testhelper.Context(t)
			stream, err := client.PostReceivePack(ctx)
			require.NoError(t, err)

			require.NoError(t, stream.Send(tc.request))
			require.NoError(t, stream.CloseSend())

			err = drainPostReceivePackResponse(stream)
			testhelper.RequireGrpcError(t, tc.expectedErr, err)
		})
	}
}

func TestPostReceivePack_invalidObjects(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)

	gitCmdFactory, _ := gittest.CaptureHookEnv(t, cfg)
	server := startSmartHTTPServerWithOptions(t, cfg, nil, []testserver.GitalyServerOpt{
		testserver.WithGitCommandFactory(gitCmdFactory),
	})
	cfg.SocketPath = server.Address()

	repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	repo := localrepo.NewTestRepo(t, cfg, repoProto)
	_, localRepoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	client, conn := newSmartHTTPClient(t, server.Address(), cfg.Auth.Token)
	defer conn.Close()

	head := text.ChompBytes(gittest.Exec(t, cfg, "-C", localRepoPath, "rev-parse", "HEAD"))
	tree := text.ChompBytes(gittest.Exec(t, cfg, "-C", localRepoPath, "rev-parse", "HEAD^{tree}"))

	for _, tc := range []struct {
		desc             string
		prepareCommit    func(t *testing.T, repoPath string) bytes.Buffer
		expectedSideband []string
		expectObject     bool
	}{
		{
			desc: "invalid timezone",
			prepareCommit: func(t *testing.T, repoPath string) bytes.Buffer {
				var buf bytes.Buffer
				buf.WriteString("tree " + tree + "\n")
				buf.WriteString("parent " + head + "\n")
				buf.WriteString("author Au Thor <author@example.com> 1313584730 +051800\n")
				buf.WriteString("committer Au Thor <author@example.com> 1313584730 +051800\n")
				buf.WriteString("\n")
				buf.WriteString("Commit message\n")
				return buf
			},
			expectedSideband: []string{
				"0030\x01000eunpack ok\n0019ok refs/heads/master\n0000",
			},
			expectObject: true,
		},
		{
			desc: "missing author and committer date",
			prepareCommit: func(t *testing.T, repoPath string) bytes.Buffer {
				var buf bytes.Buffer
				buf.WriteString("tree " + tree + "\n")
				buf.WriteString("parent " + head + "\n")
				buf.WriteString("author Au Thor <author@example.com>\n")
				buf.WriteString("committer Au Thor <author@example.com>\n")
				buf.WriteString("\n")
				buf.WriteString("Commit message\n")
				return buf
			},
			expectedSideband: []string{
				"0030\x01000eunpack ok\n0019ok refs/heads/master\n0000",
			},
			expectObject: true,
		},
		{
			desc: "zero-padded file mode",
			prepareCommit: func(t *testing.T, repoPath string) bytes.Buffer {
				subtree := gittest.WriteTree(t, cfg, repoPath, []gittest.TreeEntry{
					{Mode: "100644", Path: "file", Content: "content"},
				})

				brokenTree := gittest.WriteTree(t, cfg, repoPath, []gittest.TreeEntry{
					{Path: "subdir", Mode: "040000", OID: subtree},
				})

				var buf bytes.Buffer
				buf.WriteString("tree " + brokenTree.String() + "\n")
				buf.WriteString("parent " + head + "\n")
				buf.WriteString("author Au Thor <author@example.com>\n")
				buf.WriteString("committer Au Thor <author@example.com>\n")
				buf.WriteString("\n")
				buf.WriteString("Commit message\n")
				return buf
			},
			expectedSideband: []string{
				"0030\x01000eunpack ok\n0019ok refs/heads/master\n0000",
			},
			expectObject: true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			commitBuffer := tc.prepareCommit(t, localRepoPath)
			commitID := text.ChompBytes(gittest.ExecOpts(t, cfg, gittest.ExecConfig{Stdin: &commitBuffer},
				"-C", localRepoPath, "hash-object", "--literally", "-t", "commit", "--stdin", "-w",
			))

			currentHead := text.ChompBytes(gittest.Exec(t, cfg, "-C", repoPath, "rev-parse", "HEAD"))

			stdin := strings.NewReader(fmt.Sprintf("^%s\n%s\n", currentHead, commitID))
			pack := gittest.ExecOpts(t, cfg, gittest.ExecConfig{Stdin: stdin},
				"-C", localRepoPath, "pack-objects", "--stdout", "--revs", "--thin", "--delta-base-offset", "-q",
			)

			pkt := fmt.Sprintf("%s %s refs/heads/master\x00 %s", currentHead, commitID, "report-status side-band-64k agent=git/2.12.0")
			body := &bytes.Buffer{}
			fmt.Fprintf(body, "%04x%s%s", len(pkt)+4, pkt, pktFlushStr)
			body.Write(pack)

			stream, err := client.PostReceivePack(ctx)
			require.NoError(t, err)
			response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
				Repository:   repoProto,
				GlId:         "user-123",
				GlRepository: "project-456",
			}, body)

			requireSideband(t, tc.expectedSideband, response)

			exists, err := repo.HasRevision(ctx, git.Revision(commitID+"^{commit}"))
			require.NoError(t, err)
			require.Equal(t, tc.expectObject, exists)
		})
	}
}

func TestPostReceivePack_fsck(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	cfg.SocketPath = runSmartHTTPServer(t, cfg)

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	testcfg.BuildGitalyHooks(t, cfg)

	head := text.ChompBytes(gittest.Exec(t, cfg, "-C", repoPath, "rev-parse", "HEAD"))

	// We're creating a new commit which has a root tree with duplicate entries. git-mktree(1)
	// allows us to create these trees just fine, but git-fsck(1) complains.
	commit := gittest.WriteCommit(t, cfg, repoPath,
		gittest.WithTreeEntries(
			gittest.TreeEntry{OID: "4b825dc642cb6eb9a060e54bf8d69288fbee4904", Path: "dup", Mode: "040000"},
			gittest.TreeEntry{OID: "4b825dc642cb6eb9a060e54bf8d69288fbee4904", Path: "dup", Mode: "040000"},
		),
	)

	var body bytes.Buffer
	gittest.WritePktlineString(t, &body, fmt.Sprintf("%s %s refs/heads/master\x00 %s", head, commit, "report-status side-band-64k agent=git/2.12.0"))
	gittest.WritePktlineFlush(t, &body)

	stdin := strings.NewReader(fmt.Sprintf("^%s\n%s\n", head, commit))
	gittest.ExecOpts(t, cfg, gittest.ExecConfig{Stdin: stdin, Stdout: &body},
		"-C", repoPath, "pack-objects", "--stdout", "--revs", "--thin", "--delta-base-offset", "-q",
	)

	client, conn := newSmartHTTPClient(t, cfg.SocketPath, cfg.Auth.Token)
	defer conn.Close()

	stream, err := client.PostReceivePack(ctx)
	require.NoError(t, err)

	response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
		Repository:   repo,
		GlId:         "user-123",
		GlRepository: "project-456",
	}, &body)

	require.Contains(t, response, "duplicateEntries: contains duplicate file entries")
}

func TestPostReceivePack_hooks(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	cfg.SocketPath = runSmartHTTPServer(t, cfg)

	testcfg.BuildGitalyHooks(t, cfg)

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	const (
		secretToken  = "secret token"
		glRepository = "some_repo"
		glID         = "key-123"
	)

	cfg.GitlabShell.Dir = testhelper.TempDir(t)

	cfg.Auth.Token = "abc123"
	cfg.Gitlab.SecretFile = gitlab.WriteShellSecretFile(t, cfg.GitlabShell.Dir, secretToken)

	_, newCommitID, request := createPushRequest(t, cfg)
	oldHead := text.ChompBytes(gittest.Exec(t, cfg, "-C", repoPath, "rev-parse", "HEAD"))

	changes := fmt.Sprintf("%s %s refs/heads/master\n", oldHead, newCommitID)

	var cleanup func()
	cfg.Gitlab.URL, cleanup = gitlab.NewTestServer(t, gitlab.TestServerOptions{
		User:                        "",
		Password:                    "",
		SecretToken:                 secretToken,
		GLID:                        glID,
		GLRepository:                glRepository,
		Changes:                     changes,
		PostReceiveCounterDecreased: true,
		Protocol:                    "http",
	})
	defer cleanup()

	gittest.WriteCheckNewObjectExistsHook(t, repoPath)

	client, conn := newSmartHTTPClient(t, cfg.SocketPath, cfg.Auth.Token)
	defer conn.Close()

	stream, err := client.PostReceivePack(ctx)
	require.NoError(t, err)

	response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
		Repository:   repo,
		GlId:         glID,
		GlRepository: glRepository,
	}, request)

	requireSideband(t, []string{
		"0049\x01000eunpack ok\n0019ok refs/heads/master\n0019ok refs/heads/branch\n0000",
	}, response)
	require.Equal(t, io.EOF, drainPostReceivePackResponse(stream))
}

func TestPostReceivePack_transactionsViaPraefect(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	cfg.SocketPath = runSmartHTTPServer(t, cfg)

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	testcfg.BuildGitalyHooks(t, cfg)

	opts := gitlab.TestServerOptions{
		User:         "gitlab_user-1234",
		Password:     "gitlabsecret9887",
		SecretToken:  "secret token",
		GLID:         "key-1234",
		GLRepository: "some_repo",
		RepoPath:     repoPath,
	}

	serverURL, cleanup := gitlab.NewTestServer(t, opts)
	defer cleanup()

	cfg.GitlabShell.Dir = testhelper.TempDir(t)
	cfg.Gitlab.URL = serverURL
	cfg.Gitlab.HTTPSettings.User = opts.User
	cfg.Gitlab.HTTPSettings.Password = opts.Password
	cfg.Gitlab.SecretFile = filepath.Join(cfg.GitlabShell.Dir, ".gitlab_shell_secret")

	gitlab.WriteShellSecretFile(t, cfg.GitlabShell.Dir, opts.SecretToken)

	client, conn := newSmartHTTPClient(t, cfg.SocketPath, cfg.Auth.Token)
	defer conn.Close()

	stream, err := client.PostReceivePack(ctx)
	require.NoError(t, err)

	_, _, pushRequest := createPushRequest(t, cfg)
	response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
		Repository:   repo,
		GlId:         opts.GLID,
		GlRepository: opts.GLRepository,
	}, pushRequest)

	requireSideband(t, []string{
		"0049\x01000eunpack ok\n0019ok refs/heads/master\n0019ok refs/heads/branch\n0000",
	}, response)
}

type testTransactionServer struct {
	gitalypb.UnimplementedRefTransactionServer
	called int
}

func (t *testTransactionServer) VoteTransaction(ctx context.Context, in *gitalypb.VoteTransactionRequest) (*gitalypb.VoteTransactionResponse, error) {
	t.called++
	return &gitalypb.VoteTransactionResponse{
		State: gitalypb.VoteTransactionResponse_COMMIT,
	}, nil
}

func TestPostReceivePack_referenceTransactionHook(t *testing.T) {
	t.Parallel()

	ctxWithoutTransaction := testhelper.Context(t)

	cfg := testcfg.Build(t)
	testcfg.BuildGitalyHooks(t, cfg)

	refTransactionServer := &testTransactionServer{}

	server := startSmartHTTPServerWithOptions(t, cfg, nil, []testserver.GitalyServerOpt{
		testserver.WithDisablePraefect(),
	})
	cfg.SocketPath = server.Address()

	ctx, err := txinfo.InjectTransaction(ctxWithoutTransaction, 1234, "primary", true)
	require.NoError(t, err)
	ctx = metadata.IncomingToOutgoing(ctx)

	client := newMuxedSmartHTTPClient(t, ctx, server.Address(), cfg.Auth.Token, func() backchannel.Server {
		srv := grpc.NewServer()
		gitalypb.RegisterRefTransactionServer(srv, refTransactionServer)
		return srv
	})

	t.Run("update", func(t *testing.T) {
		stream, err := client.PostReceivePack(ctx)
		require.NoError(t, err)

		repo, _ := gittest.CreateRepository(t, ctxWithoutTransaction, cfg, gittest.CreateRepositoryConfig{
			Seed: gittest.SeedGitLabTest,
		})

		_, _, pushRequest := createPushRequest(t, cfg)
		response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
			Repository:   repo,
			GlId:         "key-1234",
			GlRepository: "some_repo",
		}, pushRequest)

		requireSideband(t, []string{
			"0049\x01000eunpack ok\n0019ok refs/heads/master\n0019ok refs/heads/branch\n0000",
		}, response)
		require.Equal(t, 5, refTransactionServer.called)
	})

	t.Run("delete", func(t *testing.T) {
		refTransactionServer.called = 0

		stream, err := client.PostReceivePack(ctx)
		require.NoError(t, err)

		repo, repoPath := gittest.CreateRepository(t, ctxWithoutTransaction, cfg,
			gittest.CreateRepositoryConfig{
				Seed: gittest.SeedGitLabTest,
			})

		// Create a new branch which we're about to delete. We also pack references because
		// this used to generate two transactions: one for the packed-refs file and one for
		// the loose ref. We only expect a single transaction though, given that the
		// packed-refs transaction should get filtered out.
		gittest.Exec(t, cfg, "-C", repoPath, "branch", "delete-me")
		gittest.Exec(t, cfg, "-C", repoPath, "pack-refs", "--all")
		branchOID := text.ChompBytes(gittest.Exec(t, cfg, "-C", repoPath, "rev-parse", "refs/heads/delete-me"))

		uploadPackData := &bytes.Buffer{}
		gittest.WritePktlineString(t, uploadPackData, fmt.Sprintf("%s %s refs/heads/delete-me\x00 %s", branchOID, git.ObjectHashSHA1.ZeroOID.String(), uploadPackCapabilities))
		gittest.WritePktlineFlush(t, uploadPackData)

		response := performPush(t, stream, &gitalypb.PostReceivePackRequest{
			Repository:   repo,
			GlId:         "key-1234",
			GlRepository: "some_repo",
		}, uploadPackData)

		requireSideband(t, []string{
			"0033\x01000eunpack ok\n001cok refs/heads/delete-me\n0000",
		}, response)
		require.Equal(t, 3, refTransactionServer.called)
	})
}

func TestPostReceivePack_notAllowed(t *testing.T) {
	t.Parallel()

	cfg := testcfg.Build(t)

	testcfg.BuildGitalyHooks(t, cfg)

	refTransactionServer := &testTransactionServer{}

	hookManager := gitalyhook.NewMockManager(
		t,
		func(
			t *testing.T,
			ctx context.Context,
			repo *gitalypb.Repository,
			pushOptions, env []string,
			stdin io.Reader, stdout, stderr io.Writer,
		) error {
			return errors.New("not allowed")
		},
		gitalyhook.NopPostReceive,
		gitalyhook.NopUpdate,
		gitalyhook.NopReferenceTransaction,
	)

	server := startSmartHTTPServerWithOptions(t, cfg, nil, []testserver.GitalyServerOpt{
		testserver.WithDisablePraefect(), testserver.WithHookManager(hookManager),
	})
	cfg.SocketPath = server.Address()

	ctxWithoutTransaction := testhelper.Context(t)
	ctx, err := txinfo.InjectTransaction(ctxWithoutTransaction, 1234, "primary", true)
	require.NoError(t, err)
	ctx = metadata.IncomingToOutgoing(ctx)

	client := newMuxedSmartHTTPClient(t, ctx, server.Address(), cfg.Auth.Token, func() backchannel.Server {
		srv := grpc.NewServer()
		gitalypb.RegisterRefTransactionServer(srv, refTransactionServer)
		return srv
	})

	stream, err := client.PostReceivePack(ctx)
	require.NoError(t, err)

	repo, _ := gittest.CreateRepository(t, ctxWithoutTransaction, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	_, _, pushRequest := createPushRequest(t, cfg)
	request := &gitalypb.PostReceivePackRequest{Repository: repo, GlId: "key-1234", GlRepository: "some_repo"}
	performPush(t, stream, request, pushRequest)

	require.Equal(t, 1, refTransactionServer.called)
}

func createPushRequest(t *testing.T, cfg config.Cfg) (git.ObjectID, git.ObjectID, io.Reader) {
	ctx := testhelper.Context(t)

	_, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	oldCommitID := git.ObjectID(text.ChompBytes(gittest.Exec(t, cfg, "-C", repoPath, "rev-parse", "HEAD")))
	newCommitID := gittest.WriteCommit(t, cfg, repoPath, gittest.WithParents(oldCommitID))

	// ReceivePack request is a packet line followed by a packet flush, then the pack file of the objects we want to push.
	// This is explained a bit in https://git-scm.com/book/en/v2/Git-Internals-Transfer-Protocols#_uploading_data
	// We form the packet line the same way git executable does: https://github.com/git/git/blob/d1a13d3fcb252631361a961cb5e2bf10ed467cba/send-pack.c#L524-L527
	var request bytes.Buffer
	gittest.WritePktlinef(t, &request, "%s %s refs/heads/master\x00 %s", oldCommitID, newCommitID, uploadPackCapabilities)
	gittest.WritePktlinef(t, &request, "%s %s refs/heads/branch", git.ObjectHashSHA1.ZeroOID, newCommitID)
	gittest.WritePktlineFlush(t, &request)

	// We need to get a pack file containing the objects we want to push, so we use git pack-objects
	// which expects a list of revisions passed through standard input. The list format means
	// pack the objects needed if I have oldHead but not newHead (think of it from the perspective of the remote repo).
	// For more info, check the man pages of both `git-pack-objects` and `git-rev-list --objects`.
	stdin := strings.NewReader(fmt.Sprintf("^%s\n%s\n", oldCommitID, newCommitID))

	// The options passed are the same ones used when doing an actual push.
	gittest.ExecOpts(t, cfg, gittest.ExecConfig{Stdin: stdin, Stdout: &request},
		"-C", repoPath, "pack-objects", "--stdout", "--revs", "--thin", "--delta-base-offset", "-q",
	)

	return oldCommitID, newCommitID, &request
}

func performPush(t *testing.T, stream gitalypb.SmartHTTPService_PostReceivePackClient, firstRequest *gitalypb.PostReceivePackRequest, body io.Reader) string {
	require.NoError(t, stream.Send(firstRequest))

	sw := streamio.NewWriter(func(p []byte) error {
		return stream.Send(&gitalypb.PostReceivePackRequest{Data: p})
	})
	_, err := io.Copy(sw, body)
	require.NoError(t, err)
	require.NoError(t, stream.CloseSend())

	var response bytes.Buffer
	rr := streamio.NewReader(func() ([]byte, error) {
		resp, err := stream.Recv()
		return resp.GetData(), err
	})
	_, err = io.Copy(&response, rr)
	require.NoError(t, err)

	return response.String()
}

func drainPostReceivePackResponse(stream gitalypb.SmartHTTPService_PostReceivePackClient) error {
	var err error
	for err == nil {
		_, err = stream.Recv()
	}
	return err
}

// requireSideband compares the actual sideband data to expected sideband data. This function is
// required to filter out any keep-alive packets which Git may send over the sideband and which are
// kind of unpredictable for us.
func requireSideband(tb testing.TB, expectedSidebandMessages []string, actualInput string) {
	tb.Helper()

	scanner := pktline.NewScanner(strings.NewReader(actualInput))

	var actualSidebandMessages []string
	for scanner.Scan() {
		payload := scanner.Bytes()

		// Flush packets terminate the communication via side-channels, so we expect them to
		// come.
		if pktline.IsFlush(payload) {
			require.Equal(tb, expectedSidebandMessages, actualSidebandMessages)
			return
		}

		// git-receive-pack(1) by default sends keep-alive packets every 5 seconds after it
		// has received the full packfile. We must filter out these keep-alive packets to
		// not break tests on machines which are really slow to execute.
		if string(payload) == "0005\x01" {
			continue
		}

		actualSidebandMessages = append(actualSidebandMessages, string(payload))
	}

	require.FailNow(tb, "expected to receive a flush to terminate the protocol")
}
