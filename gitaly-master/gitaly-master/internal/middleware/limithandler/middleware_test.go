package limithandler_test

import (
	"bytes"
	"context"
	"io"
	"net"
	"sync"
	"testing"
	"time"

	promtest "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/duration"
	"gitlab.com/gitlab-org/gitaly/v15/internal/middleware/limithandler"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/grpc_testing"
	"google.golang.org/protobuf/types/known/durationpb"
)

func TestMain(m *testing.M) {
	testhelper.Run(m)
}

func fixedLockKey(ctx context.Context) string {
	return "fixed-id"
}

func TestUnaryLimitHandler(t *testing.T) {
	t.Parallel()

	s := &server{blockCh: make(chan struct{})}

	cfg := config.Cfg{
		Concurrency: []config.Concurrency{
			{RPC: "/grpc.testing.TestService/UnaryCall", MaxPerRepo: 2},
		},
	}

	lh := limithandler.New(cfg, fixedLockKey, limithandler.WithConcurrencyLimiters)
	interceptor := lh.UnaryInterceptor()
	srv, serverSocketPath := runServer(t, s, grpc.UnaryInterceptor(interceptor))
	defer srv.Stop()

	client, conn := newClient(t, serverSocketPath)
	defer conn.Close()
	ctx := testhelper.Context(t)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			response, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})
			require.NoError(t, err)
			testhelper.ProtoEqual(t, grpc_testing.SimpleResponse{
				Payload: &grpc_testing.Payload{Body: []byte("success")},
			}, response)
		}()
	}

	time.Sleep(100 * time.Millisecond)

	require.Equal(t, 2, s.getRequestCount())

	close(s.blockCh)
	wg.Wait()
}

func TestUnaryLimitHandler_queueing(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	t.Run("simple timeout", func(t *testing.T) {
		lh := limithandler.New(config.Cfg{
			Concurrency: []config.Concurrency{
				{
					RPC:          "/grpc.testing.TestService/UnaryCall",
					MaxPerRepo:   1,
					MaxQueueSize: 1,
					MaxQueueWait: duration.Duration(time.Millisecond),
				},
			},
		}, fixedLockKey, limithandler.WithConcurrencyLimiters)

		s := &queueTestServer{
			server: server{
				blockCh: make(chan struct{}),
			},
			reqArrivedCh: make(chan struct{}),
		}

		srv, serverSocketPath := runServer(t, s, grpc.UnaryInterceptor(lh.UnaryInterceptor()))
		defer srv.Stop()

		client, conn := newClient(t, serverSocketPath)
		defer conn.Close()

		// Spawn an RPC call that blocks so that the subsequent call will be put into the
		// request queue and wait for the request to arrive.
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})
			require.NoError(t, err)
		}()
		<-s.reqArrivedCh

		// Now we spawn a second RPC call. As the concurrency limit is satisfied we'll be
		// put into queue and will eventually return with an error.
		_, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})
		testhelper.RequireGrpcError(t, structerr.NewResourceExhausted("%w", limithandler.ErrMaxQueueTime).WithDetail(
			&gitalypb.LimitError{
				ErrorMessage: "maximum time in concurrency queue reached",
				RetryAfter:   durationpb.New(0),
			},
		), err)

		// Unblock the concurrent RPC call and wait for the Goroutine to finish so that it
		// does not leak.
		close(s.blockCh)
		wg.Wait()
	})

	t.Run("unlimited queueing", func(t *testing.T) {
		lh := limithandler.New(config.Cfg{
			Concurrency: []config.Concurrency{
				// Due to a bug queueing wait times used to leak into subsequent
				// concurrency configuration in case they didn't explicitly set up
				// the queueing wait time. We thus set up two limits here: one dummy
				// limit that has a queueing wait time and then the actual config
				// that has no wait limit. We of course expect that the actual
				// config should not have any maximum queueing time.
				{
					RPC:          "dummy",
					MaxPerRepo:   1,
					MaxQueueWait: duration.Duration(1 * time.Nanosecond),
				},
				{
					RPC:        "/grpc.testing.TestService/UnaryCall",
					MaxPerRepo: 1,
				},
			},
		}, fixedLockKey, limithandler.WithConcurrencyLimiters)

		s := &queueTestServer{
			server: server{
				blockCh: make(chan struct{}),
			},
			reqArrivedCh: make(chan struct{}),
		}

		srv, serverSocketPath := runServer(t, s, grpc.UnaryInterceptor(lh.UnaryInterceptor()))
		defer srv.Stop()

		client, conn := newClient(t, serverSocketPath)
		defer conn.Close()

		// Spawn an RPC call that blocks so that the subsequent call will be put into the
		// request queue and wait for the request to arrive.
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})
			require.NoError(t, err)
		}()
		<-s.reqArrivedCh

		// We now spawn a second RPC call. This call will get put into the queue and wait
		// for the first call to finish.
		errCh := make(chan error, 1)
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})
			errCh <- err
		}()

		// Assert that the second call does not finish. This is not a great test as we can
		// basically just do a best-effort check. But I cannot think of any other way to
		// properly verify this property.
		select {
		case <-errCh:
			require.FailNow(t, "call should have been queued but finished unexpectedly")
		case <-s.reqArrivedCh:
			require.FailNow(t, "call should have been queued but posted a request")
		case <-time.After(time.Millisecond):
		}

		// Unblock the first and any subsequent RPC calls, ...
		close(s.blockCh)
		// ... which means that we should get the second request now and ...
		<-s.reqArrivedCh
		// ... subsequently we should also see that it finishes successfully.
		require.NoError(t, <-errCh)

		wg.Wait()
	})
}

func TestStreamLimitHandler(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		desc                  string
		fullname              string
		f                     func(*testing.T, context.Context, grpc_testing.TestServiceClient, chan interface{}, chan error)
		maxConcurrency        int
		expectedRequestCount  int
		expectedResponseCount int
		expectedErr           error
	}{
		// The max queue size is set at 1, which means 1 request
		// will be queued while the later ones will return with
		// an error. That means that maxConcurrency number of
		// requests will be processing but blocked due to blockCh.
		// 1 request will be waiting to be picked up, and will be
		// processed once we close the blockCh.
		{
			desc:     "Single request, multiple responses",
			fullname: "/grpc.testing.TestService/StreamingOutputCall",
			f: func(t *testing.T, ctx context.Context, client grpc_testing.TestServiceClient, respCh chan interface{}, errCh chan error) {
				stream, err := client.StreamingOutputCall(ctx, &grpc_testing.StreamingOutputCallRequest{})
				require.NoError(t, err)
				require.NotNil(t, stream)

				r, err := stream.Recv()
				if err != nil {
					errCh <- err
					return
				}

				testhelper.ProtoEqual(t, &grpc_testing.StreamingOutputCallResponse{
					Payload: &grpc_testing.Payload{Body: []byte("success")},
				}, r)
				respCh <- r
			},
			maxConcurrency:        3,
			expectedRequestCount:  4,
			expectedResponseCount: 4,
			expectedErr: structerr.NewResourceExhausted("%w", limithandler.ErrMaxQueueSize).WithDetail(
				&gitalypb.LimitError{
					ErrorMessage: "maximum queue size reached",
					RetryAfter:   durationpb.New(0),
				},
			),
		},
		{
			desc:     "Multiple requests, single response",
			fullname: "/grpc.testing.TestService/StreamingInputCall",
			f: func(t *testing.T, ctx context.Context, client grpc_testing.TestServiceClient, respCh chan interface{}, errCh chan error) {
				stream, err := client.StreamingInputCall(ctx)
				require.NoError(t, err)
				require.NotNil(t, stream)

				require.NoError(t, stream.Send(&grpc_testing.StreamingInputCallRequest{}))
				r, err := stream.CloseAndRecv()
				if err != nil {
					errCh <- err
					return
				}

				testhelper.ProtoEqual(t, &grpc_testing.StreamingInputCallResponse{
					AggregatedPayloadSize: 9000,
				}, r)
				respCh <- r
			},
			maxConcurrency:        3,
			expectedRequestCount:  4,
			expectedResponseCount: 4,
			expectedErr: structerr.NewResourceExhausted("%w", limithandler.ErrMaxQueueSize).WithDetail(
				&gitalypb.LimitError{
					ErrorMessage: "maximum queue size reached",
					RetryAfter:   durationpb.New(0),
				},
			),
		},
		{
			desc:     "Multiple requests, multiple responses",
			fullname: "/grpc.testing.TestService/FullDuplexCall",
			f: func(t *testing.T, ctx context.Context, client grpc_testing.TestServiceClient, respCh chan interface{}, errCh chan error) {
				stream, err := client.FullDuplexCall(ctx)
				require.NoError(t, err)
				require.NotNil(t, stream)

				require.NoError(t, stream.Send(&grpc_testing.StreamingOutputCallRequest{}))
				require.NoError(t, stream.CloseSend())

				r, err := stream.Recv()
				if err != nil {
					errCh <- err
					return
				}

				testhelper.ProtoEqual(t, &grpc_testing.StreamingOutputCallResponse{
					Payload: &grpc_testing.Payload{Body: []byte("success")},
				}, r)
				respCh <- r
			},
			maxConcurrency:        3,
			expectedRequestCount:  4,
			expectedResponseCount: 4,
			expectedErr: structerr.NewResourceExhausted("%w", limithandler.ErrMaxQueueSize).WithDetail(
				&gitalypb.LimitError{
					ErrorMessage: "maximum queue size reached",
					RetryAfter:   durationpb.New(0),
				},
			),
		},
		{
			// Make sure that _streams_ are limited but that _requests_ on each
			// allowed stream are not limited.
			desc:     "Multiple requests with same id, multiple responses",
			fullname: "/grpc.testing.TestService/FullDuplexCall",
			f: func(t *testing.T, ctx context.Context, client grpc_testing.TestServiceClient, respCh chan interface{}, errCh chan error) {
				stream, err := client.FullDuplexCall(ctx)
				require.NoError(t, err)
				require.NotNil(t, stream)

				// Since the concurrency id is fixed all requests have the same
				// id, but subsequent requests in a stream, even with the same
				// id, should bypass the concurrency limiter
				for i := 0; i < 10; i++ {
					// Rate-limiting the stream is happening asynchronously when
					// the server-side receives the first message. When the rate
					// limiter then decides that the RPC call must be limited,
					// it will close the stream.
					//
					// It may thus happen that we already see an EOF here in
					// case the closed stream is received on the client-side
					// before we have sent all requests. We thus need to special
					// case this specific error code and will just stop sending
					// requests in that case.
					if err := stream.Send(&grpc_testing.StreamingOutputCallRequest{}); err != nil {
						require.Equal(t, io.EOF, err)
						break
					}
				}
				require.NoError(t, stream.CloseSend())

				r, err := stream.Recv()
				if err != nil {
					errCh <- err
					return
				}

				testhelper.ProtoEqual(t, &grpc_testing.StreamingOutputCallResponse{
					Payload: &grpc_testing.Payload{Body: []byte("success")},
				}, r)
				respCh <- r
			},
			maxConcurrency: 3,
			// 3 (concurrent streams allowed) * 10 (requests per stream)
			// + 1 (queued stream) * (10 requests per stream)
			expectedRequestCount:  40,
			expectedResponseCount: 4,
			expectedErr: structerr.NewResourceExhausted("%w", limithandler.ErrMaxQueueSize).WithDetail(
				&gitalypb.LimitError{
					ErrorMessage: "maximum queue size reached",
					RetryAfter:   durationpb.New(0),
				},
			),
		},
		{
			desc:     "With a max concurrency of 0",
			fullname: "/grpc.testing.TestService/StreamingOutputCall",
			f: func(t *testing.T, ctx context.Context, client grpc_testing.TestServiceClient, respCh chan interface{}, errCh chan error) {
				stream, err := client.StreamingOutputCall(ctx, &grpc_testing.StreamingOutputCallRequest{})
				require.NoError(t, err)
				require.NotNil(t, stream)

				r, err := stream.Recv()
				if err != nil {
					errCh <- err
					return
				}

				testhelper.ProtoEqual(t, &grpc_testing.StreamingOutputCallResponse{
					Payload: &grpc_testing.Payload{Body: []byte("success")},
				}, r)
				respCh <- r
			},
			maxConcurrency:        0,
			expectedRequestCount:  10,
			expectedResponseCount: 10,
		},
	}

	for _, tc := range testCases {
		tc := tc

		t.Run(tc.desc, func(t *testing.T) {
			t.Parallel()

			s := &server{blockCh: make(chan struct{})}

			maxQueueSize := 1
			cfg := config.Cfg{
				Concurrency: []config.Concurrency{
					{
						RPC:          tc.fullname,
						MaxPerRepo:   tc.maxConcurrency,
						MaxQueueSize: maxQueueSize,
					},
				},
			}

			lh := limithandler.New(cfg, fixedLockKey, limithandler.WithConcurrencyLimiters)
			interceptor := lh.StreamInterceptor()
			srv, serverSocketPath := runServer(t, s, grpc.StreamInterceptor(interceptor))
			defer srv.Stop()

			client, conn := newClient(t, serverSocketPath)
			defer conn.Close()
			ctx := testhelper.Context(t)

			totalCalls := 10

			errChan := make(chan error)
			respChan := make(chan interface{})

			for i := 0; i < totalCalls; i++ {
				go func() {
					tc.f(t, ctx, client, respChan, errChan)
				}()
			}

			if tc.maxConcurrency > 0 {
				for i := 0; i < totalCalls-tc.maxConcurrency-maxQueueSize; i++ {
					err := <-errChan
					testhelper.RequireGrpcError(t, tc.expectedErr, err)
				}
			}

			close(s.blockCh)

			for i := 0; i < tc.expectedResponseCount; i++ {
				<-respChan
			}

			require.Equal(t, tc.expectedRequestCount, s.getRequestCount())
		})
	}
}

func TestStreamLimitHandler_error(t *testing.T) {
	t.Parallel()

	s := &queueTestServer{reqArrivedCh: make(chan struct{})}
	s.blockCh = make(chan struct{})

	cfg := config.Cfg{
		Concurrency: []config.Concurrency{
			{RPC: "/grpc.testing.TestService/FullDuplexCall", MaxPerRepo: 1, MaxQueueSize: 1},
		},
	}

	lh := limithandler.New(cfg, fixedLockKey, limithandler.WithConcurrencyLimiters)
	interceptor := lh.StreamInterceptor()
	srv, serverSocketPath := runServer(t, s, grpc.StreamInterceptor(interceptor))
	defer srv.Stop()

	client, conn := newClient(t, serverSocketPath)
	defer conn.Close()

	ctx := testhelper.Context(t)

	respChan := make(chan *grpc_testing.StreamingOutputCallResponse)
	go func() {
		stream, err := client.FullDuplexCall(ctx)
		require.NoError(t, err)
		require.NoError(t, stream.Send(&grpc_testing.StreamingOutputCallRequest{}))
		require.NoError(t, stream.CloseSend())
		resp, err := stream.Recv()
		require.NoError(t, err)
		respChan <- resp
	}()
	// The first request will be blocked by blockCh.
	<-s.reqArrivedCh

	// These are the second and third requests to be sent.
	// The second request will be waiting in the queue.
	// The third request should return with an error.
	errChan := make(chan error)
	for i := 0; i < 2; i++ {
		go func() {
			stream, err := client.FullDuplexCall(ctx)
			require.NoError(t, err)
			require.NotNil(t, stream)
			require.NoError(t, stream.Send(&grpc_testing.StreamingOutputCallRequest{}))
			require.NoError(t, stream.CloseSend())
			resp, err := stream.Recv()

			if err != nil {
				errChan <- err
			} else {
				respChan <- resp
			}
		}()
	}

	err := <-errChan
	testhelper.RequireGrpcCode(t, err, codes.ResourceExhausted)
	// ensure it is a structured error
	st, ok := status.FromError(err)
	require.True(t, ok)

	testhelper.ProtoEqual(t, []interface{}{&gitalypb.LimitError{
		ErrorMessage: "maximum queue size reached",
		RetryAfter:   &durationpb.Duration{},
	}}, st.Details())

	// allow the first request to finish
	close(s.blockCh)

	// This allows the second request to finish
	<-s.reqArrivedCh

	// we expect two responses. The first request, and the second
	// request. The third request returned immediately with an error
	// from the limit handler.
	<-respChan
	<-respChan
}

type queueTestServer struct {
	server
	reqArrivedCh chan struct{}
}

func (q *queueTestServer) UnaryCall(ctx context.Context, in *grpc_testing.SimpleRequest) (*grpc_testing.SimpleResponse, error) {
	q.registerRequest()

	q.reqArrivedCh <- struct{}{} // We need a way to know when a request got to the middleware
	<-q.blockCh                  // Block to ensure concurrency

	return &grpc_testing.SimpleResponse{
		Payload: &grpc_testing.Payload{
			Body: []byte("success"),
		},
	}, nil
}

func (q *queueTestServer) FullDuplexCall(stream grpc_testing.TestService_FullDuplexCallServer) error {
	// Read all the input
	for {
		if _, err := stream.Recv(); err != nil {
			if err != io.EOF {
				return err
			}

			break
		}
		q.reqArrivedCh <- struct{}{}

		q.registerRequest()
	}
	<-q.blockCh // Block to ensure concurrency

	return stream.Send(&grpc_testing.StreamingOutputCallResponse{
		Payload: &grpc_testing.Payload{
			Body: []byte("success"),
		},
	})
}

func TestConcurrencyLimitHandlerMetrics(t *testing.T) {
	s := &queueTestServer{reqArrivedCh: make(chan struct{})}
	s.blockCh = make(chan struct{})

	methodName := "/grpc.testing.TestService/UnaryCall"
	cfg := config.Cfg{
		Concurrency: []config.Concurrency{
			{RPC: methodName, MaxPerRepo: 1, MaxQueueSize: 1},
		},
	}

	lh := limithandler.New(cfg, fixedLockKey, limithandler.WithConcurrencyLimiters)
	interceptor := lh.UnaryInterceptor()
	srv, serverSocketPath := runServer(t, s, grpc.UnaryInterceptor(interceptor))
	defer srv.Stop()

	client, conn := newClient(t, serverSocketPath)
	defer conn.Close()

	ctx := testhelper.Context(t)

	respCh := make(chan *grpc_testing.SimpleResponse)
	go func() {
		resp, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})
		respCh <- resp
		require.NoError(t, err)
	}()
	// wait until the first request is being processed. After this, requests will be queued
	<-s.reqArrivedCh

	errChan := make(chan error)
	// out of ten requests, the first one will be queued and the other 9 will return with
	// an error
	for i := 0; i < 10; i++ {
		go func() {
			resp, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})
			if err != nil {
				errChan <- err
			} else {
				respCh <- resp
			}
		}()
	}

	var errs int
	for err := range errChan {
		s, ok := status.FromError(err)
		require.True(t, ok)
		details := s.Details()
		require.Len(t, details, 1)

		limitErr, ok := details[0].(*gitalypb.LimitError)
		require.True(t, ok)

		assert.Equal(t, limithandler.ErrMaxQueueSize.Error(), limitErr.ErrorMessage)
		assert.Equal(t, durationpb.New(0), limitErr.RetryAfter)

		errs++
		if errs == 9 {
			break
		}
	}

	expectedMetrics := `# HELP gitaly_concurrency_limiting_in_progress Gauge of number of concurrent in-progress calls
# TYPE gitaly_concurrency_limiting_in_progress gauge
gitaly_concurrency_limiting_in_progress{grpc_method="ReplicateRepository",grpc_service="gitaly.RepositoryService",system="gitaly"} 0
gitaly_concurrency_limiting_in_progress{grpc_method="UnaryCall",grpc_service="grpc.testing.TestService",system="gitaly"} 1
# HELP gitaly_concurrency_limiting_queued Gauge of number of queued calls
# TYPE gitaly_concurrency_limiting_queued gauge
gitaly_concurrency_limiting_queued{grpc_method="ReplicateRepository",grpc_service="gitaly.RepositoryService",system="gitaly"} 0
gitaly_concurrency_limiting_queued{grpc_method="UnaryCall",grpc_service="grpc.testing.TestService",system="gitaly"} 1
# HELP gitaly_requests_dropped_total Number of requests dropped from the queue
# TYPE gitaly_requests_dropped_total counter
gitaly_requests_dropped_total{grpc_method="UnaryCall",grpc_service="grpc.testing.TestService",reason="max_size",system="gitaly"} 9
`
	assert.NoError(t, promtest.CollectAndCompare(lh, bytes.NewBufferString(expectedMetrics),
		"gitaly_concurrency_limiting_queued",
		"gitaly_requests_dropped_total",
		"gitaly_concurrency_limiting_in_progress"))

	close(s.blockCh)
	<-s.reqArrivedCh
	// we expect two requests to complete. The first one that started to process immediately,
	// and the second one that got queued
	<-respCh
	<-respCh
}

func TestRateLimitHandler(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	methodName := "/grpc.testing.TestService/UnaryCall"
	cfg := config.Cfg{
		RateLimiting: []config.RateLimiting{
			{RPC: methodName, Interval: duration.Duration(1 * time.Hour), Burst: 1},
		},
	}

	t.Run("rate has hit max", func(t *testing.T) {
		s := &server{blockCh: make(chan struct{})}

		lh := limithandler.New(cfg, fixedLockKey, limithandler.WithRateLimiters(ctx))
		interceptor := lh.UnaryInterceptor()
		srv, serverSocketPath := runServer(t, s, grpc.UnaryInterceptor(interceptor))
		defer srv.Stop()

		client, conn := newClient(t, serverSocketPath)
		defer testhelper.MustClose(t, conn)

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})
			require.NoError(t, err)
		}()
		// wait until the first request is being processed so we know the rate
		// limiter already knows about it.
		s.blockCh <- struct{}{}
		close(s.blockCh)

		for i := 0; i < 10; i++ {
			_, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})

			s, ok := status.FromError(err)
			require.True(t, ok)
			details := s.Details()
			require.Len(t, details, 1)

			limitErr, ok := details[0].(*gitalypb.LimitError)
			require.True(t, ok)

			assert.Equal(t, limithandler.ErrRateLimit.Error(), limitErr.ErrorMessage)
			assert.Equal(t, durationpb.New(0), limitErr.RetryAfter)
		}

		expectedMetrics := `# HELP gitaly_requests_dropped_total Number of requests dropped from the queue
# TYPE gitaly_requests_dropped_total counter
gitaly_requests_dropped_total{grpc_method="UnaryCall",grpc_service="grpc.testing.TestService",reason="rate",system="gitaly"} 10
`
		assert.NoError(t, promtest.CollectAndCompare(lh, bytes.NewBufferString(expectedMetrics),
			"gitaly_requests_dropped_total"))

		wg.Wait()
	})

	t.Run("rate has not hit max", func(t *testing.T) {
		s := &server{blockCh: make(chan struct{})}

		lh := limithandler.New(cfg, fixedLockKey, limithandler.WithRateLimiters(ctx))
		interceptor := lh.UnaryInterceptor()
		srv, serverSocketPath := runServer(t, s, grpc.UnaryInterceptor(interceptor))
		defer srv.Stop()

		client, conn := newClient(t, serverSocketPath)
		defer testhelper.MustClose(t, conn)

		close(s.blockCh)
		_, err := client.UnaryCall(ctx, &grpc_testing.SimpleRequest{})
		require.NoError(t, err)

		expectedMetrics := `# HELP gitaly_requests_dropped_total Number of requests dropped from the queue
# TYPE gitaly_requests_dropped_total counter
gitaly_requests_dropped_total{grpc_method="UnaryCall",grpc_service="grpc.testing.TestService",reason="rate",system="gitaly"} 0
`
		assert.NoError(t, promtest.CollectAndCompare(lh, bytes.NewBufferString(expectedMetrics),
			"gitaly_requests_dropped_total"))
	})
}

func runServer(t *testing.T, s grpc_testing.TestServiceServer, opt ...grpc.ServerOption) (*grpc.Server, string) {
	serverSocketPath := testhelper.GetTemporaryGitalySocketFileName(t)
	grpcServer := grpc.NewServer(opt...)
	grpc_testing.RegisterTestServiceServer(grpcServer, s)

	lis, err := net.Listen("unix", serverSocketPath)
	require.NoError(t, err)

	go testhelper.MustServe(t, grpcServer, lis)

	return grpcServer, "unix://" + serverSocketPath
}

func newClient(t *testing.T, serverSocketPath string) (grpc_testing.TestServiceClient, *grpc.ClientConn) {
	connOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}
	conn, err := grpc.Dial(serverSocketPath, connOpts...)
	if err != nil {
		t.Fatal(err)
	}

	return grpc_testing.NewTestServiceClient(conn), conn
}
