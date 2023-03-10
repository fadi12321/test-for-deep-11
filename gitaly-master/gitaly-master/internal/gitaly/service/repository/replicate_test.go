//go:build !gitaly_test_sha256

package repository

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/client"
	"gitlab.com/gitlab-org/gitaly/v15/internal/backchannel"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	gitalyhook "gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/hook"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/storage"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/transaction"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/perm"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/text"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata/featureflag"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testserver"
	"gitlab.com/gitlab-org/gitaly/v15/internal/transaction/txinfo"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/proto"
)

func TestReplicateRepository_success(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(featureflag.ReplicateRepositoryHooks).
		Run(t, testReplicateRepositorySuccess)
}

func testReplicateRepositorySuccess(t *testing.T, ctx context.Context) {
	cfgBuilder := testcfg.NewGitalyCfgBuilder(testcfg.WithStorages("default", "replica"))
	cfg := cfgBuilder.Build(t)

	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	client, serverSocketPath := runRepositoryService(t, cfg, nil)
	cfg.SocketPath = serverSocketPath

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	// create a loose object to ensure snapshot replication is used
	blobData, err := text.RandomHex(10)
	require.NoError(t, err)
	blobID := text.ChompBytes(gittest.ExecOpts(t, cfg, gittest.ExecConfig{Stdin: bytes.NewBuffer([]byte(blobData))},
		"-C", repoPath, "hash-object", "-w", "--stdin",
	))

	// write info attributes
	attrFilePath := filepath.Join(repoPath, "info", "attributes")
	require.NoError(t, os.MkdirAll(filepath.Dir(attrFilePath), perm.SharedDir))
	attrData := []byte("*.pbxproj binary\n")
	require.NoError(t, os.WriteFile(attrFilePath, attrData, perm.SharedFile))

	// Write a modified gitconfig
	gittest.Exec(t, cfg, "-C", repoPath, "config", "please.replicate", "me")
	configData := testhelper.MustReadFile(t, filepath.Join(repoPath, "config"))
	require.Contains(t, string(configData), "[please]\n\treplicate = me\n")

	targetRepo := proto.Clone(repo).(*gitalypb.Repository)
	targetRepo.StorageName = cfg.Storages[1].Name

	ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

	_, err = client.ReplicateRepository(ctx, &gitalypb.ReplicateRepositoryRequest{
		Repository: targetRepo,
		Source:     repo,
	})

	require.NoError(t, err)

	targetRepoPath := filepath.Join(cfg.Storages[1].Path, gittest.GetReplicaPath(t, ctx, cfg, targetRepo))
	gittest.Exec(t, cfg, "-C", targetRepoPath, "fsck")

	replicatedAttrFilePath := filepath.Join(targetRepoPath, "info", "attributes")
	replicatedAttrData := testhelper.MustReadFile(t, replicatedAttrFilePath)
	require.Equal(t, string(attrData), string(replicatedAttrData), "info/attributes files must match")

	replicatedConfigPath := filepath.Join(targetRepoPath, "config")
	replicatedConfigData := testhelper.MustReadFile(t, replicatedConfigPath)
	require.Equal(t, string(configData), string(replicatedConfigData), "config files must match")

	// create another branch
	gittest.WriteCommit(t, cfg, repoPath, gittest.WithBranch("branch"))
	_, err = client.ReplicateRepository(ctx, &gitalypb.ReplicateRepositoryRequest{
		Repository: targetRepo,
		Source:     repo,
	})
	require.NoError(t, err)
	require.Equal(t,
		gittest.Exec(t, cfg, "-C", repoPath, "show-ref", "--hash", "--verify", "refs/heads/branch"),
		gittest.Exec(t, cfg, "-C", targetRepoPath, "show-ref", "--hash", "--verify", "refs/heads/branch"),
	)

	// if an unreachable object has been replicated, that means snapshot replication was used
	gittest.Exec(t, cfg, "-C", targetRepoPath, "cat-file", "-p", blobID)
}

func TestReplicateRepository_hiddenRefs(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(featureflag.ReplicateRepositoryHooks).
		Run(t, testReplicateRepositoryHiddenRefs)
}

func testReplicateRepositoryHiddenRefs(t *testing.T, ctx context.Context) {
	cfgBuilder := testcfg.NewGitalyCfgBuilder(testcfg.WithStorages("default", "replica"))
	cfg := cfgBuilder.Build(t)

	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	client, serverSocketPath := runRepositoryService(t, cfg, nil)
	cfg.SocketPath = serverSocketPath

	ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

	t.Run("initial seeding", func(t *testing.T) {
		sourceRepo, sourceRepoPath := gittest.CreateRepository(t, ctx, cfg)

		// Create a bunch of internal references, regardless of whether we classify them as hidden
		// or read-only. We should be able to replicate all of them.
		var expectedRefs []string
		for refPrefix := range git.InternalRefPrefixes {
			commitID := gittest.WriteCommit(t, cfg, sourceRepoPath, gittest.WithParents(), gittest.WithMessage(refPrefix))
			gittest.Exec(t, cfg, "-C", sourceRepoPath, "update-ref", refPrefix+"1", commitID.String())
			expectedRefs = append(expectedRefs, fmt.Sprintf("%s commit\t%s", commitID, refPrefix+"1"))
		}

		targetRepo := proto.Clone(sourceRepo).(*gitalypb.Repository)
		targetRepo.StorageName = cfg.Storages[1].Name

		_, err := client.ReplicateRepository(ctx, &gitalypb.ReplicateRepositoryRequest{
			Repository: targetRepo,
			Source:     sourceRepo,
		})
		require.NoError(t, err)

		targetRepoPath := filepath.Join(cfg.Storages[1].Path, gittest.GetReplicaPath(t, ctx, cfg, targetRepo))
		require.ElementsMatch(t, expectedRefs, strings.Split(text.ChompBytes(gittest.Exec(t, cfg, "-C", targetRepoPath, "for-each-ref")), "\n"))

		// Perform another sanity-check to verify that source and target repository have the
		// same references now.
		require.Equal(t,
			text.ChompBytes(gittest.Exec(t, cfg, "-C", sourceRepoPath, "for-each-ref")),
			text.ChompBytes(gittest.Exec(t, cfg, "-C", targetRepoPath, "for-each-ref")),
		)
	})

	t.Run("incremental replication", func(t *testing.T) {
		sourceRepo, sourceRepoPath := gittest.CreateRepository(t, ctx, cfg)
		targetRepo, targetRepoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
			RelativePath: sourceRepo.GetRelativePath(),
			Storage:      cfg.Storages[1],
		})

		// Create the same commit in both repositories so that they're in a known-good
		// state.
		sourceCommitID := gittest.WriteCommit(t, cfg, sourceRepoPath, gittest.WithParents(), gittest.WithMessage("base"), gittest.WithBranch("main"))
		targetCommitID := gittest.WriteCommit(t, cfg, targetRepoPath, gittest.WithParents(), gittest.WithMessage("base"), gittest.WithBranch("main"))
		require.Equal(t, sourceCommitID, targetCommitID)

		// Create the internal references now.
		for refPrefix := range git.InternalRefPrefixes {
			commitID := gittest.WriteCommit(t, cfg, sourceRepoPath, gittest.WithParents(), gittest.WithMessage(refPrefix))
			gittest.Exec(t, cfg, "-C", sourceRepoPath, "update-ref", refPrefix+"1", commitID.String())
		}

		// And now replicate the with the new internal references having been created.
		// Because the target repository exists already we'll do a fetch instead of
		// replicating via an archive.
		_, err := client.ReplicateRepository(ctx, &gitalypb.ReplicateRepositoryRequest{
			Repository: targetRepo,
			Source:     sourceRepo,
		})

		require.NoError(t, err)

		// Verify that the references for both repositories match.
		require.Equal(t,
			text.ChompBytes(gittest.Exec(t, cfg, "-C", sourceRepoPath, "for-each-ref")),
			text.ChompBytes(gittest.Exec(t, cfg, "-C", targetRepoPath, "for-each-ref")),
		)
	})
}

func TestReplicateRepository_transactional(t *testing.T) {
	t.Parallel()
	testhelper.NewFeatureSets(featureflag.ReplicateRepositoryHooks).
		Run(t, testReplicateRepositoryTransactional)
}

func testReplicateRepositoryTransactional(t *testing.T, ctx context.Context) {
	cfgBuilder := testcfg.NewGitalyCfgBuilder(testcfg.WithStorages("default", "replica"))
	cfg := cfgBuilder.Build(t)

	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	_, serverSocketPath := runRepositoryService(t, cfg, nil, testserver.WithDisablePraefect())
	cfg.SocketPath = serverSocketPath

	sourceRepo, sourceRepoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	targetRepo := proto.Clone(sourceRepo).(*gitalypb.Repository)
	targetRepo.StorageName = cfg.Storages[1].Name

	var votes []string
	txServer := testTransactionServer{
		vote: func(request *gitalypb.VoteTransactionRequest) (*gitalypb.VoteTransactionResponse, error) {
			votes = append(votes, hex.EncodeToString(request.ReferenceUpdatesHash))
			return &gitalypb.VoteTransactionResponse{
				State: gitalypb.VoteTransactionResponse_COMMIT,
			}, nil
		},
	}

	ctx, err := txinfo.InjectTransaction(ctx, 1, "primary", true)
	require.NoError(t, err)
	ctx = metadata.IncomingToOutgoing(ctx)
	ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

	client := newMuxedRepositoryClient(t, ctx, cfg, serverSocketPath, backchannel.NewClientHandshaker(
		testhelper.NewDiscardingLogEntry(t),
		func() backchannel.Server {
			srv := grpc.NewServer()
			gitalypb.RegisterRefTransactionServer(srv, &txServer)
			return srv
		},
		backchannel.DefaultConfiguration(),
	))

	// The first invocation creates the repository via a snapshot given that it doesn't yet
	// exist.
	_, err = client.ReplicateRepository(ctx, &gitalypb.ReplicateRepositoryRequest{
		Repository: targetRepo,
		Source:     sourceRepo,
	})

	require.NoError(t, err)

	// There is no gitattributes file, so we vote on the empty contents of that file.
	gitattributesVote := sha1.Sum([]byte{})
	// There is a gitconfig though, so the vote should reflect its contents.
	gitconfigVote := sha1.Sum(testhelper.MustReadFile(t, filepath.Join(sourceRepoPath, "config")))

	noHooksVote := "fd69c38637bf443296edc19e2b2c649d0502f7c0"

	expectedVotes := []string{
		// We cannot easily derive these first two votes: they are based on the complete
		// hashed contents of the unpacked repository. We thus just only assert that they
		// are always the first two entries and that they are the same by simply taking the
		// first vote twice here.
		votes[0],
		votes[0],
		hex.EncodeToString(gitconfigVote[:]),
		hex.EncodeToString(gitconfigVote[:]),
		hex.EncodeToString(gitattributesVote[:]),
		hex.EncodeToString(gitattributesVote[:]),
	}

	if featureflag.ReplicateRepositoryHooks.IsEnabled(ctx) {
		expectedVotes = append(expectedVotes, noHooksVote, noHooksVote)
	}

	require.Equal(t, expectedVotes, votes)

	// We're about to change refs/heads/master, and thus the mirror-fetch will update it. The
	// vote should reflect that.
	oldOID := text.ChompBytes(gittest.Exec(t, cfg, "-C", sourceRepoPath, "rev-parse", "refs/heads/master"))
	newOID := text.ChompBytes(gittest.Exec(t, cfg, "-C", sourceRepoPath, "rev-parse", "refs/heads/master~"))
	replicationVote := sha1.Sum([]byte(fmt.Sprintf("%[1]s %[2]s refs/heads/master\n%[1]s %[2]s HEAD\n", oldOID, newOID)))

	// We're now changing a reference in the source repository such that we can observe changes
	// in the target repo.
	gittest.Exec(t, cfg, "-C", sourceRepoPath, "update-ref", "refs/heads/master", "refs/heads/master~")

	votes = nil

	// And the second invocation uses FetchInternalRemote.
	_, err = client.ReplicateRepository(ctx, &gitalypb.ReplicateRepositoryRequest{
		Repository: targetRepo,
		Source:     sourceRepo,
	})
	require.NoError(t, err)

	expectedVotes = []string{
		hex.EncodeToString(gitconfigVote[:]),
		hex.EncodeToString(gitconfigVote[:]),
		hex.EncodeToString(gitattributesVote[:]),
		hex.EncodeToString(gitattributesVote[:]),
		hex.EncodeToString(replicationVote[:]),
		hex.EncodeToString(replicationVote[:]),
	}

	if featureflag.ReplicateRepositoryHooks.IsEnabled(ctx) {
		expectedVotes = append(expectedVotes, noHooksVote, noHooksVote)
	}

	require.Equal(t, expectedVotes, votes)
}

func TestReplicateRepositoryInvalidArguments(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)

	testCases := []struct {
		description   string
		input         *gitalypb.ReplicateRepositoryRequest
		expectedError string
	}{
		{
			description: "everything correct",
			input: &gitalypb.ReplicateRepositoryRequest{
				Repository: &gitalypb.Repository{
					StorageName:  "praefect-internal-0",
					RelativePath: "/ab/cd/abcdef1234",
				},
				Source: &gitalypb.Repository{
					StorageName:  "praefect-internal-1",
					RelativePath: "/ab/cd/abcdef1234",
				},
			},
			expectedError: "",
		},
		{
			description: "empty repository",
			input: &gitalypb.ReplicateRepositoryRequest{
				Repository: nil,
				Source: &gitalypb.Repository{
					StorageName:  "praefect-internal-1",
					RelativePath: "/ab/cd/abcdef1234",
				},
			},
			expectedError: "empty Repository",
		},
		{
			description: "empty source",
			input: &gitalypb.ReplicateRepositoryRequest{
				Repository: &gitalypb.Repository{
					StorageName:  "praefect-internal-0",
					RelativePath: "/ab/cd/abcdef1234",
				},
				Source: nil,
			},
			expectedError: testhelper.GitalyOrPraefect(
				"source repository cannot be empty",
				"repo scoped: invalid Repository",
			),
		},
		{
			description: "source and repository have the same storage",
			input: &gitalypb.ReplicateRepositoryRequest{
				Repository: &gitalypb.Repository{
					StorageName:  "praefect-internal-0",
					RelativePath: "/ab/cd/abcdef1234",
				},
				Source: &gitalypb.Repository{
					StorageName:  "praefect-internal-0",
					RelativePath: "/ab/cd/abcdef1234",
				},
			},
			expectedError: testhelper.GitalyOrPraefect(
				"repository and source have the same storage",
				"repo scoped: invalid Repository",
			),
		},
	}

	_, client := setupRepositoryServiceWithoutRepo(t)

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			_, err := client.ReplicateRepository(ctx, tc.input)
			testhelper.RequireGrpcCode(t, err, codes.InvalidArgument)
			require.Contains(t, err.Error(), tc.expectedError)
		})
	}
}

func TestReplicateRepository_BadRepository(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(featureflag.ReplicateRepositoryHooks).
		Run(t, testReplicateRepositoryBadRepository)
}

func testReplicateRepositoryBadRepository(t *testing.T, ctx context.Context) {
	for _, tc := range []struct {
		desc          string
		invalidSource bool
		invalidTarget bool
		error         func(testing.TB, error)
	}{
		{
			desc:          "target invalid",
			invalidTarget: true,
		},
		{
			desc:          "source invalid",
			invalidSource: true,
			error: func(tb testing.TB, actual error) {
				if testhelper.IsPraefectEnabled() {
					// ReplicateRepository uses RepositoryExists to check whether the source repository exists on the target
					// Gitaly. Gitaly returns NotFound if accessing a corrupt repository. Praefect relies on the metadata
					// and returns that the repository still exists, causing this test to hit a different code path and diverge
					// in behavior.
					require.ErrorContains(t, actual, "synchronizing gitattributes: GetRepoPath: not a git repository: ")
					return
				}

				testhelper.RequireGrpcError(tb, ErrInvalidSourceRepository, actual)
			},
		},
		{
			desc:          "both invalid",
			invalidSource: true,
			invalidTarget: true,
			error: func(tb testing.TB, actual error) {
				testhelper.RequireGrpcError(tb, ErrInvalidSourceRepository, actual)
			},
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			cfgBuilder := testcfg.NewGitalyCfgBuilder(testcfg.WithStorages("default", "target"))
			cfg := cfgBuilder.Build(t)

			testcfg.BuildGitalyHooks(t, cfg)
			testcfg.BuildGitalySSH(t, cfg)

			client, serverSocketPath := runRepositoryService(t, cfg, nil)
			cfg.SocketPath = serverSocketPath

			sourceRepo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
				Seed: gittest.SeedGitLabTest,
			})
			targetRepo, targetRepoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
				Storage:      cfg.Storages[1],
				RelativePath: sourceRepo.RelativePath,
			})

			var invalidRepos []*gitalypb.Repository
			if tc.invalidSource {
				invalidRepos = append(invalidRepos, sourceRepo)
			}
			if tc.invalidTarget {
				invalidRepos = append(invalidRepos, targetRepo)
			}

			locator := config.NewLocator(cfg)
			for _, invalidRepo := range invalidRepos {
				storagePath, err := locator.GetStorageByName(invalidRepo.StorageName)
				require.NoError(t, err)

				invalidRepoPath := filepath.Join(storagePath, gittest.GetReplicaPath(t, ctx, cfg, invalidRepo))
				// delete git data so make the repo invalid
				for _, path := range []string{"refs", "objects", "HEAD"} {
					require.NoError(t, os.RemoveAll(filepath.Join(invalidRepoPath, path)))
				}
			}

			ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

			_, err := client.ReplicateRepository(ctx, &gitalypb.ReplicateRepositoryRequest{
				Repository: targetRepo,
				Source:     sourceRepo,
			})
			if tc.error != nil {
				tc.error(t, err)
				return
			}

			require.NoError(t, err)
			gittest.Exec(t, cfg, "-C", targetRepoPath, "fsck")
		})
	}
}

func TestReplicateRepository_FailedFetchInternalRemote(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t, testcfg.WithStorages("default", "replica"))
	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	client, socketPath := runRepositoryService(t, cfg, nil)
	cfg.SocketPath = socketPath

	targetRepo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Storage: cfg.Storages[1],
	})

	sourceRepo, sourceRepoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Storage: cfg.Storages[0],
	})

	// We corrupt the repository by writing garbage into HEAD.
	require.NoError(t, os.WriteFile(filepath.Join(sourceRepoPath, "HEAD"), []byte("garbage"), perm.PublicFile))

	ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

	_, err := client.ReplicateRepository(ctx, &gitalypb.ReplicateRepositoryRequest{
		Repository: targetRepo,
		Source:     sourceRepo,
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "fetch: exit status 128")
}

// gitalySSHParams contains parameters used to exec 'gitaly-ssh' binary.
type gitalySSHParams struct {
	arguments   []string
	environment []string
}

// listenGitalySSHCalls creates a script that intercepts 'gitaly-ssh' binary calls.
// It replaces 'gitaly-ssh' with a interceptor script that calls actual binary after flushing env var and
// arguments used for the binary invocation. That information will be returned back to the caller
// after invocation of the returned anonymous function.
func listenGitalySSHCalls(t *testing.T, conf config.Cfg) func() gitalySSHParams {
	t.Helper()

	require.NotEmpty(t, conf.BinDir)
	initialPath := conf.BinaryPath("gitaly-ssh")
	updatedPath := initialPath + "-actual"
	require.NoError(t, os.Rename(initialPath, updatedPath))

	tmpDir := testhelper.TempDir(t)

	script := fmt.Sprintf(`#!/usr/bin/env bash

		# To omit possible problem with parallel run and a race for the file creation with '>'
		# this option is used, please checkout https://mywiki.wooledge.org/NoClobber for more details.
		set -eo noclobber

		env >%[1]q/environment
		echo "$@" >%[1]q/arguments

		exec %[2]q "$@"`, tmpDir, updatedPath)
	require.NoError(t, os.WriteFile(initialPath, []byte(script), perm.SharedExecutable))

	return func() gitalySSHParams {
		arguments := testhelper.MustReadFile(t, filepath.Join(tmpDir, "arguments"))
		environment := testhelper.MustReadFile(t, filepath.Join(tmpDir, "environment"))
		return gitalySSHParams{
			arguments:   strings.Split(string(arguments), " "),
			environment: strings.Split(string(environment), "\n"),
		}
	}
}

func TestFetchInternalRemote_successful(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	remoteCfg := testcfg.Build(t)
	remoteRepo, remoteRepoPath := gittest.CreateRepository(t, ctx, remoteCfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
	})
	testcfg.BuildGitalyHooks(t, remoteCfg)
	gittest.WriteCommit(t, remoteCfg, remoteRepoPath, gittest.WithBranch("master"))

	_, remoteAddr := runRepositoryService(t, remoteCfg, nil, testserver.WithDisablePraefect())

	localCfg := testcfg.Build(t)
	localRepoProto, localRepoPath := gittest.CreateRepository(t, ctx, localCfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
	})
	localRepo := localrepo.NewTestRepo(t, localCfg, localRepoProto)
	testcfg.BuildGitalySSH(t, localCfg)
	testcfg.BuildGitalyHooks(t, localCfg)
	gittest.Exec(t, remoteCfg, "-C", localRepoPath, "symbolic-ref", "HEAD", "refs/heads/feature")

	referenceTransactionHookCalled := 0

	// We do not require the server's address, but it needs to be around regardless such that
	// `FetchInternalRemote` can reach the hook service which is injected via the config.
	runRepositoryService(t, localCfg, nil, testserver.WithHookManager(gitalyhook.NewMockManager(t, nil, nil, nil,
		func(t *testing.T, _ context.Context, _ gitalyhook.ReferenceTransactionState, _ []string, stdin io.Reader) error {
			// We need to discard stdin or otherwise the sending Goroutine may return an
			// EOF error and cause the test to fail.
			_, err := io.Copy(io.Discard, stdin)
			require.NoError(t, err)

			referenceTransactionHookCalled++
			return nil
		}),
	))

	ctx, err := storage.InjectGitalyServers(ctx, remoteRepo.GetStorageName(), remoteAddr, remoteCfg.Auth.Token)
	require.NoError(t, err)
	ctx = metadata.OutgoingToIncoming(ctx)

	getGitalySSHInvocationParams := listenGitalySSHCalls(t, localCfg)

	connsPool := client.NewPool()
	defer connsPool.Close()

	// Use the `assert` package such that we can get information about why hooks have failed via
	// the hook logs in case it did fail unexpectedly.
	assert.NoError(t, fetchInternalRemote(ctx, &transaction.MockManager{}, connsPool, localRepo, remoteRepo))

	hookLogs := filepath.Join(localCfg.Logging.Dir, "gitaly_hooks.log")
	require.FileExists(t, hookLogs)
	require.Equal(t, "", string(testhelper.MustReadFile(t, hookLogs)))

	require.Equal(t,
		string(gittest.Exec(t, remoteCfg, "-C", remoteRepoPath, "show-ref", "--head")),
		string(gittest.Exec(t, localCfg, "-C", localRepoPath, "show-ref", "--head")),
	)

	sshParams := getGitalySSHInvocationParams()
	require.Equal(t, []string{"upload-pack", "gitaly", "git-upload-pack", "'/internal.git'\n"}, sshParams.arguments)
	require.Subset(t,
		sshParams.environment,
		[]string{
			"GIT_TERMINAL_PROMPT=0",
			"GIT_SSH_VARIANT=simple",
			"LANG=en_US.UTF-8",
			"GITALY_ADDRESS=" + remoteAddr,
		},
	)

	require.Equal(t, 2, referenceTransactionHookCalled)
}

func TestFetchInternalRemote_failure(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t)

	repoProto, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
	})
	repo := localrepo.NewTestRepo(t, cfg, repoProto)

	ctx = testhelper.MergeIncomingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

	connsPool := client.NewPool()
	defer connsPool.Close()

	err := fetchInternalRemote(ctx, &transaction.MockManager{}, connsPool, repo, &gitalypb.Repository{
		StorageName:  repoProto.GetStorageName(),
		RelativePath: "does-not-exist.git",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "fatal: Could not read from remote repository")
}

func TestReplicateRepository_hooks(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(featureflag.ReplicateRepositoryHooks).
		Run(t, testReplicateRepositoryHooks)
}

func testReplicateRepositoryHooks(t *testing.T, ctx context.Context) {
	t.Parallel()

	cfgBuilder := testcfg.NewGitalyCfgBuilder(testcfg.WithStorages("default", "replica"))
	cfg := cfgBuilder.Build(t)

	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	service, serverSocketPath := runRepositoryService(t, cfg, nil, testserver.WithDisablePraefect())
	cfg.SocketPath = serverSocketPath

	sourceRepo, sourceRepoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{})

	// Add custom hooks to source repository.
	archivePath := mustCreateCustomHooksArchive(t, ctx, []testFile{
		{name: "pre-commit.sample", content: "foo", mode: 0o755},
		{name: "pre-push.sample", content: "bar", mode: 0o755},
	}, customHooksDir)

	hooks, err := os.Open(archivePath)
	require.NoError(t, err)

	err = extractHooks(ctx, hooks, sourceRepoPath)
	require.NoError(t, err)

	targetRepo := proto.Clone(sourceRepo).(*gitalypb.Repository)
	targetRepo.StorageName = cfg.Storages[1].Name

	ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

	_, err = service.ReplicateRepository(ctx, &gitalypb.ReplicateRepositoryRequest{
		Repository: targetRepo,
		Source:     sourceRepo,
	})
	require.NoError(t, err)

	targetRepoPath := filepath.Join(cfg.Storages[1].Path, gittest.GetReplicaPath(t, ctx, cfg, targetRepo))
	targetHooksPath := filepath.Join(targetRepoPath, customHooksDir)

	// Make sure target repo contains replicated custom hooks from source repository.
	if featureflag.ReplicateRepositoryHooks.IsEnabled(ctx) {
		require.FileExists(t, filepath.Join(targetHooksPath, "pre-push.sample"))
	} else {
		require.NoDirExists(t, targetHooksPath)
	}
}
