//go:build !gitaly_test_sha256

package repository

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	gitalyauth "gitlab.com/gitlab-org/gitaly/v15/auth"
	"gitlab.com/gitlab-org/gitaly/v15/client"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/perm"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/text"
	"gitlab.com/gitlab-org/gitaly/v15/internal/praefect/praefectutil"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	gitalyx509 "gitlab.com/gitlab-org/gitaly/v15/internal/x509"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"
)

func TestCreateFork_successful(t *testing.T) {
	// We need to inject this once across all tests given that crypto/x509 only initializes
	// certificates once. Changing injected certs during our tests is thus not going to fly well
	// and would cause failure. We should eventually address this and provide better testing
	// utilities around this, but now's not the time.
	certPool, tlsConfig := injectCustomCATestCerts(t)
	ctx := testhelper.Context(t)

	for _, tt := range []struct {
		name   string
		secure bool
	}{
		{
			name:   "secure",
			secure: true,
		},
		{
			name: "insecure",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cfg := testcfg.Build(t)

			testcfg.BuildGitalyHooks(t, cfg)
			testcfg.BuildGitalySSH(t, cfg)

			createRepoConfig := gittest.CreateRepositoryConfig{
				Seed: gittest.SeedGitLabTest,
			}
			getReplicaPathConfig := gittest.GetReplicaPathConfig{}

			var client gitalypb.RepositoryServiceClient
			if tt.secure {
				cfg.TLS = tlsConfig
				cfg.TLSListenAddr = "localhost:0"

				_, addr := runRepositoryService(t, cfg, nil)
				cfg.TLSListenAddr = addr

				var conn *grpc.ClientConn
				client, conn = newSecureRepoClient(t, cfg.TLSListenAddr, cfg.Auth.Token, certPool)
				t.Cleanup(func() { conn.Close() })

				createRepoConfig.ClientConn = conn
				getReplicaPathConfig.ClientConn = conn
			} else {
				client, cfg.SocketPath = runRepositoryService(t, cfg, nil)
			}

			repo, _ := gittest.CreateRepository(t, ctx, cfg, createRepoConfig)

			ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

			forkedRepo := &gitalypb.Repository{
				RelativePath: gittest.NewRepositoryName(t),
				StorageName:  repo.GetStorageName(),
			}

			_, err := client.CreateFork(ctx, &gitalypb.CreateForkRequest{
				Repository:       forkedRepo,
				SourceRepository: repo,
			})
			require.NoError(t, err)

			replicaPath := gittest.GetReplicaPath(t, ctx, cfg, forkedRepo, getReplicaPathConfig)
			forkedRepoPath := filepath.Join(cfg.Storages[0].Path, replicaPath)

			gittest.Exec(t, cfg, "-C", forkedRepoPath, "fsck")
			require.Empty(t, gittest.Exec(t, cfg, "-C", forkedRepoPath, "remote"))

			_, err = os.Lstat(filepath.Join(forkedRepoPath, "hooks"))
			require.True(t, os.IsNotExist(err), "hooks directory should not have been created")
		})
	}
}

func TestCreateFork_refs(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	client, socketPath := runRepositoryService(t, cfg, nil)
	cfg.SocketPath = socketPath

	sourceRepo, sourceRepoPath := gittest.CreateRepository(t, ctx, cfg)

	// Prepare the source repository with a bunch of refs and a non-default HEAD ref so we can
	// assert that the target repo gets created with the correct set of refs.
	commitID := gittest.WriteCommit(t, cfg, sourceRepoPath)
	for _, ref := range []string{
		"refs/environments/something",
		"refs/heads/something",
		"refs/remotes/origin/something",
		"refs/tags/something",
	} {
		gittest.Exec(t, cfg, "-C", sourceRepoPath, "update-ref", ref, commitID.String())
	}
	gittest.Exec(t, cfg, "-C", sourceRepoPath, "symbolic-ref", "HEAD", "refs/heads/something")

	ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

	targetRepo := &gitalypb.Repository{
		RelativePath: gittest.NewRepositoryName(t),
		StorageName:  sourceRepo.GetStorageName(),
	}

	_, err := client.CreateFork(ctx, &gitalypb.CreateForkRequest{
		Repository:       targetRepo,
		SourceRepository: sourceRepo,
	})
	require.NoError(t, err)

	storagePath, err := config.NewLocator(cfg).GetStorageByName(targetRepo.GetStorageName())
	require.NoError(t, err)

	targetRepoPath := filepath.Join(storagePath, gittest.GetReplicaPath(t, ctx, cfg, targetRepo))

	require.Equal(t,
		[]string{
			commitID.String() + " refs/heads/something",
			commitID.String() + " refs/tags/something",
		},
		strings.Split(text.ChompBytes(gittest.Exec(t, cfg, "-C", targetRepoPath, "show-ref")), "\n"),
	)

	require.Equal(t,
		string(gittest.Exec(t, cfg, "-C", sourceRepoPath, "symbolic-ref", "HEAD")),
		string(gittest.Exec(t, cfg, "-C", targetRepoPath, "symbolic-ref", "HEAD")),
	)
}

func TestCreateFork_fsck(t *testing.T) {
	t.Parallel()

	cfg := testcfg.Build(t)

	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	client, socketPath := runRepositoryService(t, cfg, nil)
	cfg.SocketPath = socketPath

	ctx := testhelper.Context(t)
	ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg)

	// Write a tree into the repository that's known-broken.
	treeID := gittest.WriteTree(t, cfg, repoPath, []gittest.TreeEntry{
		{Content: "content", Path: "dup", Mode: "100644"},
		{Content: "content", Path: "dup", Mode: "100644"},
	})

	gittest.WriteCommit(t, cfg, repoPath,
		gittest.WithParents(),
		gittest.WithBranch("main"),
		gittest.WithTree(treeID),
	)

	forkedRepo := &gitalypb.Repository{
		RelativePath: gittest.NewRepositoryName(t),
		StorageName:  repo.GetStorageName(),
	}

	// Create a fork from the repository with the broken tree. This should work alright: repos
	// with preexisting broken objects that we already have on our disk anyway should not be
	// subject to additional consistency checks. Otherwise we might end up in a situation where
	// we retroactively tighten consistency checks for repositories such that preexisting repos
	// wouldn't be forkable anymore.
	_, err := client.CreateFork(ctx, &gitalypb.CreateForkRequest{
		Repository:       forkedRepo,
		SourceRepository: repo,
	})
	require.NoError(t, err)

	forkedRepoPath := filepath.Join(cfg.Storages[0].Path, gittest.GetReplicaPath(t, ctx, cfg, forkedRepo))

	// Verify that the broken tree is indeed in the fork and that it is reported as broken by
	// git-fsck(1).
	var stderr bytes.Buffer
	fsckCmd := gittest.NewCommand(t, cfg, "-C", forkedRepoPath, "fsck")
	fsckCmd.Stderr = &stderr

	require.EqualError(t, fsckCmd.Run(), "exit status 4")
	require.Equal(t, fmt.Sprintf("error in tree %s: duplicateEntries: contains duplicate file entries\n", treeID), stderr.String())
}

func TestCreateFork_targetExists(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)

	for _, tc := range []struct {
		desc                          string
		seed                          func(t *testing.T, targetPath string)
		expectedErrWithAtomicCreation error
	}{
		{
			desc: "empty target directory",
			seed: func(t *testing.T, targetPath string) {
				require.NoError(t, os.MkdirAll(targetPath, perm.GroupPrivateDir))
			},
			expectedErrWithAtomicCreation: structerr.NewAlreadyExists("creating fork: repository exists already"),
		},
		{
			desc: "non-empty target directory",
			seed: func(t *testing.T, targetPath string) {
				require.NoError(t, os.MkdirAll(targetPath, perm.GroupPrivateDir))
				require.NoError(t, os.WriteFile(
					filepath.Join(targetPath, "config"),
					nil,
					perm.SharedFile,
				))
			},
			expectedErrWithAtomicCreation: structerr.NewAlreadyExists("creating fork: repository exists already"),
		},
		{
			desc: "target file",
			seed: func(t *testing.T, targetPath string) {
				require.NoError(t, os.MkdirAll(filepath.Dir(targetPath), perm.GroupPrivateDir))
				require.NoError(t, os.WriteFile(targetPath, nil, perm.SharedFile))
			},
			expectedErrWithAtomicCreation: structerr.NewAlreadyExists("creating fork: repository exists already"),
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			cfg, repo, _, client := setupRepositoryService(t, ctx)

			ctx = testhelper.MergeOutgoingMetadata(ctx, testcfg.GitalyServersMetadataFromCfg(t, cfg))

			forkedRepo := &gitalypb.Repository{
				// As this test can run with Praefect in front of it, we'll use the next replica path Praefect will
				// assign in order to ensure this repository creation conflicts even with Praefect in front of it.
				// As the source repository created in the setup is the first one, this would get the repository
				// ID 2.
				RelativePath: praefectutil.DeriveReplicaPath(2),
				StorageName:  repo.StorageName,
			}

			tc.seed(t, filepath.Join(cfg.Storages[0].Path, forkedRepo.GetRelativePath()))

			_, err := client.CreateFork(ctx, &gitalypb.CreateForkRequest{
				Repository:       forkedRepo,
				SourceRepository: repo,
			})
			testhelper.RequireGrpcError(t, tc.expectedErrWithAtomicCreation, err)
		})
	}
}

func TestCreateFork_validate(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)
	_, repo, _, cli := setupRepositoryService(t, ctx)
	for _, tc := range []struct {
		desc        string
		req         *gitalypb.CreateForkRequest
		expectedErr error
	}{
		{
			desc: "repository not provided",
			req:  &gitalypb.CreateForkRequest{Repository: nil, SourceRepository: repo},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			desc: "source repository not provided",
			req:  &gitalypb.CreateForkRequest{Repository: repo, SourceRepository: nil},
			expectedErr: func() error {
				if testhelper.IsPraefectEnabled() {
					return status.Error(codes.AlreadyExists, "route repository creation: reserve repository id: repository already exists")
				}
				return status.Error(codes.InvalidArgument, "empty SourceRepository")
			}(),
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			_, err := cli.CreateFork(ctx, tc.req)
			testhelper.RequireGrpcError(t, tc.expectedErr, err)
		})
	}
}

func injectCustomCATestCerts(t *testing.T) (*x509.CertPool, config.TLS) {
	certFile, keyFile := testhelper.GenerateCerts(t)
	t.Setenv(gitalyx509.SSLCertFile, certFile)

	caPEMBytes := testhelper.MustReadFile(t, certFile)
	pool := x509.NewCertPool()
	require.True(t, pool.AppendCertsFromPEM(caPEMBytes))

	return pool, config.TLS{CertPath: certFile, KeyPath: keyFile}
}

func newSecureRepoClient(tb testing.TB, addr, token string, pool *x509.CertPool) (gitalypb.RepositoryServiceClient, *grpc.ClientConn) {
	tb.Helper()

	connOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{
			RootCAs:    pool,
			MinVersion: tls.VersionTLS12,
		})),
		grpc.WithPerRPCCredentials(gitalyauth.RPCCredentialsV2(token)),
	}

	conn, err := client.Dial(addr, connOpts)
	require.NoError(tb, err)

	return gitalypb.NewRepositoryServiceClient(conn), conn
}
