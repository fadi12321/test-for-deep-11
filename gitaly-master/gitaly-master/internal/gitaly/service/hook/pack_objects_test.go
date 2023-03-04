//go:build !gitaly_test_sha256

package hook

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"runtime"
	"strings"
	"sync"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/sirupsen/logrus"
	"github.com/sirupsen/logrus/hooks/test"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/pktline"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	hookPkg "gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/hook"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata/featureflag"
	"gitlab.com/gitlab-org/gitaly/v15/internal/middleware/limithandler"
	"gitlab.com/gitlab-org/gitaly/v15/internal/streamcache"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testserver"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func runTestsWithRuntimeDir(t *testing.T, testFunc func(*testing.T, context.Context, string)) func(*testing.T, context.Context) {
	t.Helper()

	return func(t *testing.T, ctx context.Context) {
		t.Run("no runtime dir", func(t *testing.T) {
			testFunc(t, ctx, "")
		})

		t.Run("with runtime dir", func(t *testing.T) {
			testFunc(t, ctx, testhelper.TempDir(t))
		})
	}
}

func cfgWithCache(t *testing.T) config.Cfg {
	cfg := testcfg.Build(t)
	cfg.PackObjectsCache.Enabled = true
	cfg.PackObjectsCache.Dir = testhelper.TempDir(t)
	return cfg
}

func TestParsePackObjectsArgs(t *testing.T) {
	testCases := []struct {
		desc string
		args []string
		out  *packObjectsArgs
		err  error
	}{
		{desc: "no args", args: []string{"pack-objects", "--stdout"}, out: &packObjectsArgs{}},
		{desc: "no args shallow", args: []string{"--shallow-file", "", "pack-objects", "--stdout"}, out: &packObjectsArgs{shallowFile: true}},
		{desc: "with args", args: []string{"pack-objects", "--foo", "-x", "--stdout"}, out: &packObjectsArgs{flags: []string{"--foo", "-x"}}},
		{desc: "with args shallow", args: []string{"--shallow-file", "", "pack-objects", "--foo", "--stdout", "-x"}, out: &packObjectsArgs{shallowFile: true, flags: []string{"--foo", "-x"}}},
		{desc: "missing stdout", args: []string{"pack-objects"}, err: errNoStdout},
		{desc: "no pack objects", args: []string{"zpack-objects"}, err: errNoPackObjects},
		{desc: "non empty shallow", args: []string{"--shallow-file", "z", "pack-objects"}, err: errNoPackObjects},
		{desc: "bad global", args: []string{"-c", "foo=bar", "pack-objects"}, err: errNoPackObjects},
		{desc: "non flag arg", args: []string{"pack-objects", "--foo", "x"}, err: errNonFlagArg},
		{desc: "non flag arg shallow", args: []string{"--shallow-file", "", "pack-objects", "--foo", "x"}, err: errNonFlagArg},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			args, err := parsePackObjectsArgs(tc.args)
			require.Equal(t, tc.out, args)
			require.Equal(t, tc.err, err)
		})
	}
}

func TestServer_PackObjectsHook_separateContext(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(
		featureflag.PackObjectsLimitingUser,
		featureflag.PackObjectsLimitingRepo,
	).Run(t, runTestsWithRuntimeDir(
		t,
		testServerPackObjectsHookSeparateContextWithRuntimeDir,
	))
}

func testServerPackObjectsHookSeparateContextWithRuntimeDir(t *testing.T, ctx context.Context, runtimeDir string) {
	cfg := cfgWithCache(t)
	cfg.SocketPath = runHooksServer(t, cfg, nil)

	ctx1, cancel := context.WithCancel(ctx)
	defer cancel()
	repo, repoPath := gittest.CreateRepository(t, ctx1, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	req := &gitalypb.PackObjectsHookWithSidechannelRequest{
		Repository: repo,
		Args:       []string{"pack-objects", "--revs", "--thin", "--stdout", "--progress", "--delta-base-offset"},
	}
	const stdin = "3dd08961455abf80ef9115f4afdc1c6f968b503c\n--not\n\n"

	start1 := make(chan struct{})
	start2 := make(chan struct{})
	wg := &sync.WaitGroup{}
	wg.Add(2)

	// Call 1: sends a valid request but hangs up without reading response.
	// This should not break call 2.
	client1, conn1 := newHooksClient(t, cfg.SocketPath)
	defer conn1.Close()

	ctx1, wt1, err := hookPkg.SetupSidechannel(
		ctx1,
		git.HooksPayload{
			RuntimeDir: runtimeDir,
		},
		func(c *net.UnixConn) error {
			defer close(start2)
			<-start1
			if _, err := io.WriteString(c, stdin); err != nil {
				return err
			}
			if err := c.CloseWrite(); err != nil {
				return err
			}

			// Read one byte of the response to ensure that this call got handled
			// before the next one.
			buf := make([]byte, 1)
			_, err := io.ReadFull(c, buf)
			return err
		},
	)
	require.NoError(t, err)
	defer testhelper.MustClose(t, wt1)

	go func() {
		defer wg.Done()
		_, err := client1.PackObjectsHookWithSidechannel(ctx1, req)

		if runtime.GOOS == "darwin" {
			assert.Contains(t, []codes.Code{codes.Canceled, codes.Internal}, status.Code(err))

			if status.Code(err) == codes.Internal {
				assert.Contains(t, err.Error(), "write: socket is not connected")
			}
		} else {
			testhelper.AssertGrpcCode(t, err, codes.Canceled)
		}

		assert.NoError(t, wt1.Wait())
	}()

	// Call 2: this is a normal call with the same request as call 1
	client2, conn2 := newHooksClient(t, cfg.SocketPath)
	defer conn2.Close()

	ctx2, cancel := context.WithCancel(ctx)
	defer cancel()

	var stdout2 []byte
	ctx2, wt2, err := hookPkg.SetupSidechannel(
		ctx2,
		git.HooksPayload{
			RuntimeDir: runtimeDir,
		},
		func(c *net.UnixConn) error {
			<-start2
			if _, err := io.WriteString(c, stdin); err != nil {
				return err
			}
			if err := c.CloseWrite(); err != nil {
				return err
			}

			return pktline.EachSidebandPacket(c, func(band byte, data []byte) error {
				if band == 1 {
					stdout2 = append(stdout2, data...)
				}
				return nil
			})
		},
	)
	require.NoError(t, err)
	defer testhelper.MustClose(t, wt2)

	go func() {
		defer wg.Done()
		_, err := client2.PackObjectsHookWithSidechannel(ctx2, req)
		assert.NoError(t, err)
		assert.NoError(t, wt2.Wait())
	}()

	close(start1)
	wg.Wait()

	// Sanity check: second call received valid response
	gittest.ExecOpts(
		t,
		cfg,
		gittest.ExecConfig{Stdin: bytes.NewReader(stdout2)},
		"-C", repoPath, "index-pack", "--stdin", "--fix-thin",
	)
}

func TestServer_PackObjectsHook_usesCache(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(
		featureflag.PackObjectsLimitingUser,
		featureflag.PackObjectsLimitingRepo,
	).Run(t, runTestsWithRuntimeDir(
		t,
		testServerPackObjectsHookUsesCache,
	))
}

func testServerPackObjectsHookUsesCache(t *testing.T, ctx context.Context, runtimeDir string) {
	cfg := cfgWithCache(t)

	tlc := &streamcache.TestLoggingCache{}
	cfg.SocketPath = runHooksServer(t, cfg, []serverOption{func(s *server) {
		tlc.Cache = s.packObjectsCache
		s.packObjectsCache = tlc
	}})

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	doRequest := func() {
		var stdout []byte
		ctx, wt, err := hookPkg.SetupSidechannel(
			ctx,
			git.HooksPayload{
				RuntimeDir: runtimeDir,
			},
			func(c *net.UnixConn) error {
				if _, err := io.WriteString(c, "3dd08961455abf80ef9115f4afdc1c6f968b503c\n--not\n\n"); err != nil {
					return err
				}
				if err := c.CloseWrite(); err != nil {
					return err
				}

				return pktline.EachSidebandPacket(c, func(band byte, data []byte) error {
					if band == 1 {
						stdout = append(stdout, data...)
					}
					return nil
				})
			},
		)
		require.NoError(t, err)
		defer testhelper.MustClose(t, wt)

		client, conn := newHooksClient(t, cfg.SocketPath)
		defer conn.Close()

		_, err = client.PackObjectsHookWithSidechannel(ctx, &gitalypb.PackObjectsHookWithSidechannelRequest{
			Repository: repo,
			Args:       []string{"pack-objects", "--revs", "--thin", "--stdout", "--progress", "--delta-base-offset"},
		})
		require.NoError(t, err)
		require.NoError(t, wt.Wait())

		gittest.ExecOpts(
			t,
			cfg,
			gittest.ExecConfig{Stdin: bytes.NewReader(stdout)},
			"-C", repoPath, "index-pack", "--stdin", "--fix-thin",
		)
	}

	const N = 5
	for i := 0; i < N; i++ {
		doRequest()
	}

	entries := tlc.Entries()
	require.Len(t, entries, N)
	first := entries[0]
	require.NotEmpty(t, first.Key)
	require.True(t, first.Created)
	require.NoError(t, first.Err)

	for i := 1; i < N; i++ {
		require.Equal(t, first.Key, entries[i].Key, "all requests had the same cache key")
		require.False(t, entries[i].Created, "all requests except the first were cache hits")
		require.NoError(t, entries[i].Err)
	}
}

func TestServer_PackObjectsHookWithSidechannel(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(
		featureflag.PackObjectsLimitingUser,
		featureflag.PackObjectsLimitingRepo,
	).Run(t, runTestsWithRuntimeDir(
		t,
		testServerPackObjectsHookWithSidechannelWithRuntimeDir,
	))
}

func testServerPackObjectsHookWithSidechannelWithRuntimeDir(t *testing.T, ctx context.Context, runtimeDir string) {
	testCases := []struct {
		desc  string
		stdin string
		args  []string
	}{
		{
			desc:  "clone 1 branch",
			stdin: "3dd08961455abf80ef9115f4afdc1c6f968b503c\n--not\n\n",
			args:  []string{"pack-objects", "--revs", "--thin", "--stdout", "--progress", "--delta-base-offset"},
		},
		{
			desc:  "shallow clone 1 branch",
			stdin: "--shallow 1e292f8fedd741b75372e19097c76d327140c312\n1e292f8fedd741b75372e19097c76d327140c312\n--not\n\n",
			args:  []string{"--shallow-file", "", "pack-objects", "--revs", "--thin", "--stdout", "--shallow", "--progress", "--delta-base-offset", "--include-tag"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			cfg := cfgWithCache(t)

			logger, hook := test.NewNullLogger()
			concurrencyTracker := hookPkg.NewConcurrencyTracker()

			cfg.SocketPath = runHooksServer(
				t,
				cfg,
				nil,
				testserver.WithLogger(logger),
				testserver.WithConcurrencyTracker(concurrencyTracker),
			)
			repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
				Seed: gittest.SeedGitLabTest,
			})

			var packets []string
			ctx, wt, err := hookPkg.SetupSidechannel(
				ctx,
				git.HooksPayload{
					RuntimeDir: runtimeDir,
				},
				func(c *net.UnixConn) error {
					if _, err := io.WriteString(c, tc.stdin); err != nil {
						return err
					}
					if err := c.CloseWrite(); err != nil {
						return err
					}

					scanner := pktline.NewScanner(c)
					for scanner.Scan() {
						packets = append(packets, scanner.Text())
					}
					return scanner.Err()
				},
			)
			require.NoError(t, err)
			defer testhelper.MustClose(t, wt)

			client, conn := newHooksClient(t, cfg.SocketPath)
			defer conn.Close()

			_, err = client.PackObjectsHookWithSidechannel(ctx, &gitalypb.PackObjectsHookWithSidechannelRequest{
				Repository: repo,
				Args:       tc.args,
			})
			require.NoError(t, err)

			require.NoError(t, wt.Wait())
			require.NotEmpty(t, packets)

			var packdata []byte
			for _, pkt := range packets {
				require.Greater(t, len(pkt), 4)

				switch band := pkt[4]; band {
				case 1:
					packdata = append(packdata, pkt[5:]...)
				case 2:
				default:
					t.Fatalf("unexpected band: %d", band)
				}
			}

			gittest.ExecOpts(
				t,
				cfg,
				gittest.ExecConfig{Stdin: bytes.NewReader(packdata)},
				"-C", repoPath, "index-pack", "--stdin", "--fix-thin",
			)

			for _, msg := range []string{"served bytes", "generated bytes"} {
				t.Run(msg, func(t *testing.T) {
					var entry *logrus.Entry
					for _, e := range hook.AllEntries() {
						if e.Message == msg {
							entry = e
						}
					}

					require.NotNil(t, entry)
					require.NotEmpty(t, entry.Data["cache_key"])
					require.Greater(t, entry.Data["bytes"], int64(0))
				})
			}

			t.Run("pack file compression statistic", func(t *testing.T) {
				var entry *logrus.Entry
				for _, e := range hook.AllEntries() {
					if e.Message == "pack file compression statistic" {
						entry = e
					}
				}

				require.NotNil(t, entry)
				total := entry.Data["pack.stat"].(string)
				require.True(t, strings.HasPrefix(total, "Total "))
				require.False(t, strings.Contains(total, "\n"))
			})

			expectedMetrics := `# HELP gitaly_pack_objects_concurrent_processes Number of concurrent processes
# TYPE gitaly_pack_objects_concurrent_processes histogram
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="0"} 0
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="5"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="10"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="15"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="20"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="25"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="30"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="35"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="40"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="45"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="50"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="55"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="60"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="65"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="70"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="75"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="80"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="85"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="90"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="95"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="repository",le="+Inf"} 1
gitaly_pack_objects_concurrent_processes_sum{segment="repository"} 1
gitaly_pack_objects_concurrent_processes_count{segment="repository"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="0"} 0
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="5"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="10"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="15"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="20"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="25"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="30"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="35"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="40"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="45"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="50"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="55"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="60"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="65"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="70"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="75"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="80"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="85"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="90"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="95"} 1
gitaly_pack_objects_concurrent_processes_bucket{segment="user_id",le="+Inf"} 1
gitaly_pack_objects_concurrent_processes_sum{segment="user_id"} 1
gitaly_pack_objects_concurrent_processes_count{segment="user_id"} 1
# HELP gitaly_pack_objects_process_active_callers Number of unique callers that have an active pack objects processes
# TYPE gitaly_pack_objects_process_active_callers gauge
gitaly_pack_objects_process_active_callers{segment="repository"} 0
gitaly_pack_objects_process_active_callers{segment="user_id"} 0
# HELP gitaly_pack_objects_process_active_callers_total Total unique callers that have initiated a pack objects processes
# TYPE gitaly_pack_objects_process_active_callers_total counter
gitaly_pack_objects_process_active_callers_total{segment="repository"} 1
gitaly_pack_objects_process_active_callers_total{segment="user_id"} 1
`
			require.NoError(t, testutil.CollectAndCompare(
				concurrencyTracker,
				bytes.NewBufferString(expectedMetrics),
			))
		})
	}
}

func TestServer_PackObjectsHookWithSidechannel_invalidArgument(t *testing.T) {
	t.Parallel()

	cfg := testcfg.Build(t)
	cfg.SocketPath = runHooksServer(t, cfg, nil)
	ctx := testhelper.Context(t)

	repo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	testCases := []struct {
		desc        string
		req         *gitalypb.PackObjectsHookWithSidechannelRequest
		expectedErr error
	}{
		{
			desc:        "empty",
			req:         &gitalypb.PackObjectsHookWithSidechannelRequest{},
			expectedErr: status.Error(codes.InvalidArgument, "empty Repository"),
		},
		{
			desc:        "repo, no args",
			req:         &gitalypb.PackObjectsHookWithSidechannelRequest{Repository: repo},
			expectedErr: status.Error(codes.InvalidArgument, "invalid pack-objects command: []: missing pack-objects"),
		},
		{
			desc:        "repo, bad args",
			req:         &gitalypb.PackObjectsHookWithSidechannelRequest{Repository: repo, Args: []string{"rm", "-rf"}},
			expectedErr: status.Error(codes.InvalidArgument, "invalid pack-objects command: [rm -rf]: missing pack-objects"),
		},
		{
			desc:        "no side-channel address",
			req:         &gitalypb.PackObjectsHookWithSidechannelRequest{Repository: repo, Args: []string{"pack-objects", "--revs", "--stdout"}},
			expectedErr: status.Error(codes.InvalidArgument, `invalid side channel address: ""`),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			client, conn := newHooksClient(t, cfg.SocketPath)
			defer conn.Close()

			_, err := client.PackObjectsHookWithSidechannel(ctx, tc.req)
			testhelper.RequireGrpcError(t, tc.expectedErr, err)
		})
	}
}

func TestServer_PackObjectsHookWithSidechannel_Canceled(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(
		featureflag.PackObjectsLimitingUser,
		featureflag.PackObjectsLimitingRepo,
	).Run(t, runTestsWithRuntimeDir(
		t,
		testServerPackObjectsHookWithSidechannelCanceledWithRuntimeDir,
	))
}

func testServerPackObjectsHookWithSidechannelCanceledWithRuntimeDir(t *testing.T, ctx context.Context, runtimeDir string) {
	cfg := cfgWithCache(t)

	ctx, wt, err := hookPkg.SetupSidechannel(
		ctx,
		git.HooksPayload{
			RuntimeDir: runtimeDir,
		},
		func(c *net.UnixConn) error {
			// Simulate a client that successfully initiates a request, but hangs up
			// before fully consuming the response.
			_, err := io.WriteString(c, "3dd08961455abf80ef9115f4afdc1c6f968b503c\n--not\n\n")
			return err
		},
	)
	require.NoError(t, err)
	defer testhelper.MustClose(t, wt)

	cfg.SocketPath = runHooksServer(t, cfg, nil)
	repo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		Seed: gittest.SeedGitLabTest,
	})

	client, conn := newHooksClient(t, cfg.SocketPath)
	defer conn.Close()

	_, err = client.PackObjectsHookWithSidechannel(ctx, &gitalypb.PackObjectsHookWithSidechannelRequest{
		Repository: repo,
		Args:       []string{"pack-objects", "--revs", "--thin", "--stdout", "--progress", "--delta-base-offset"},
	})
	testhelper.RequireGrpcCode(t, err, codes.Canceled)

	require.NoError(t, wt.Wait())
}

func withRunPackObjectsFn(
	f func(
		context.Context,
		git.CommandFactory,
		io.Writer,
		*gitalypb.PackObjectsHookWithSidechannelRequest,
		*packObjectsArgs,
		io.Reader,
		string,
		*hookPkg.ConcurrencyTracker,
	) error,
) serverOption {
	return func(s *server) {
		s.runPackObjectsFn = f
	}
}

func setupSidechannel(t *testing.T, ctx context.Context, oid string) (context.Context, *hookPkg.SidechannelWaiter, error) {
	return hookPkg.SetupSidechannel(
		ctx,
		git.HooksPayload{
			RuntimeDir: testhelper.TempDir(t),
		},
		func(c *net.UnixConn) error {
			// Simulate a client that successfully initiates a request, but hangs up
			// before fully consuming the response.
			_, err := io.WriteString(c, fmt.Sprintf("%s\n--not\n\n", oid))
			return err
		},
	)
}

func TestPackObjects_concurrencyLimit(t *testing.T) {
	t.Parallel()

	testhelper.NewFeatureSets(
		featureflag.PackObjectsLimitingUser,
		featureflag.PackObjectsLimitingRepo,
	).Run(t, testPackObjectsConcurrency)
}

func testPackObjectsConcurrency(t *testing.T, ctx context.Context) {
	t.Parallel()

	cfg := cfgWithCache(t)

	var keyType string

	if featureflag.PackObjectsLimitingRepo.IsEnabled(ctx) {
		keyType = "repo"
	} else if featureflag.PackObjectsLimitingUser.IsEnabled(ctx) {
		keyType = "user"
	}

	ticker := helper.NewManualTicker()
	monitor := limithandler.NewPackObjectsConcurrencyMonitor(
		keyType,
		cfg.Prometheus.GRPCLatencyBuckets,
	)
	limiter := limithandler.NewConcurrencyLimiter(
		1,
		0,
		func() helper.Ticker { return ticker },
		monitor,
	)

	registry := prometheus.NewRegistry()
	registry.MustRegister(monitor)

	receivedCh, blockCh := make(chan struct{}), make(chan struct{})
	cfg.SocketPath = runHooksServer(t, cfg, []serverOption{
		withRunPackObjectsFn(func(
			context.Context,
			git.CommandFactory,
			io.Writer,
			*gitalypb.PackObjectsHookWithSidechannelRequest,
			*packObjectsArgs,
			io.Reader,
			string,
			*hookPkg.ConcurrencyTracker,
		) error {
			receivedCh <- struct{}{}
			<-blockCh
			return nil
		}),
	},
		testserver.WithPackObjectsLimiter(limiter),
	)

	ctx1, wt1, err := setupSidechannel(t, ctx, "1dd08961455abf80ef9115f4afdc1c6f968b503c")
	require.NoError(t, err)

	ctx2, wt2, err := setupSidechannel(t, ctx, "2dd08961455abf80ef9115f4afdc1c6f968b503")
	require.NoError(t, err)

	userID := "user-123"
	req1 := &gitalypb.PackObjectsHookWithSidechannelRequest{
		GlId: userID,
		Repository: &gitalypb.Repository{
			StorageName:  "storage-0",
			RelativePath: "a/b/c",
		},
		Args: []string{"pack-objects", "--revs", "--thin", "--stdout", "--progress", "--delta-base-offset"},
	}

	req2 := &gitalypb.PackObjectsHookWithSidechannelRequest{
		GlId: userID,
		Repository: &gitalypb.Repository{
			StorageName:  "storage-0",
			RelativePath: "a/b/c",
		},
		Args: []string{"pack-objects", "--revs", "--thin", "--stdout", "--progress", "--delta-base-offset"},
	}

	client, conn := newHooksClient(t, cfg.SocketPath)
	defer testhelper.MustClose(t, conn)

	var wg sync.WaitGroup
	wg.Add(2)

	errChan := make(chan error)

	// We fire off two requests. Since the concurrency limit is set at 1,
	// the first request will make it through the concurrency limiter and
	// get blocked in the function provide to withRunPackObjectsFn() above.
	// The second request will get concurrency limited and will be waiting
	// in the queue.
	// When we call Tick() on the max queue wait ticker, the second request
	// will return with an error.

	type call struct {
		ctx context.Context
		req *gitalypb.PackObjectsHookWithSidechannelRequest
	}

	for _, c := range []call{
		{ctx: ctx1, req: req1},
		{ctx: ctx2, req: req2},
	} {
		go func(c call) {
			defer wg.Done()
			_, err := client.PackObjectsHookWithSidechannel(c.ctx, c.req)
			if err != nil {
				errChan <- err
			}
		}(c)
	}

	if featureflag.PackObjectsLimitingRepo.IsEnabled(ctx) || featureflag.PackObjectsLimitingUser.IsEnabled(ctx) {
		<-receivedCh

		require.NoError(t,
			testutil.GatherAndCompare(registry,
				bytes.NewBufferString(fmt.Sprintf(`# HELP gitaly_pack_objects_in_progress Gauge of number of concurrent in-progress calls
# TYPE gitaly_pack_objects_in_progress gauge
gitaly_pack_objects_in_progress{type="%s"} 1
`, keyType)), "gitaly_pack_objects_in_progress"))

		ticker.Tick()

		err := <-errChan
		testhelper.RequireGrpcCode(
			t,
			err,
			codes.ResourceExhausted,
		)

		close(blockCh)

		expectedMetrics := bytes.NewBufferString(fmt.Sprintf(`# HELP gitaly_pack_objects_dropped_total Number of requests dropped from the queue
# TYPE gitaly_pack_objects_dropped_total counter
gitaly_pack_objects_dropped_total{reason="max_time", type="%s"} 1
# HELP gitaly_pack_objects_queued Gauge of number of queued calls
# TYPE gitaly_pack_objects_queued gauge
gitaly_pack_objects_queued{type="%s"} 0
`, keyType, keyType))

		require.NoError(t,
			testutil.GatherAndCompare(registry, expectedMetrics,
				"gitaly_pack_objects_dropped_total",
				"gitaly_pack_objects_queued",
			))

		acquiringSecondsCount, err := testutil.GatherAndCount(registry,
			"gitaly_pack_objects_acquiring_seconds")
		require.NoError(t, err)

		require.Equal(t, 1, acquiringSecondsCount)
	} else {
		close(blockCh)
		<-receivedCh
		<-receivedCh
	}

	wg.Wait()
	require.NoError(t, wt1.Wait())
	require.NoError(t, wt2.Wait())
}
