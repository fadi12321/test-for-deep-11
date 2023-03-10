//go:build !gitaly_test_sha256

package client

import (
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/backchannel"
	"gitlab.com/gitlab-org/gitaly/v15/internal/listenmux"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

func TestDial(t *testing.T) {
	errNonMuxed := status.Error(codes.Internal, "non-muxed connection")
	errMuxed := status.Error(codes.Internal, "muxed connection")

	logger := testhelper.NewDiscardingLogEntry(t)

	lm := listenmux.New(insecure.NewCredentials())
	lm.Register(backchannel.NewServerHandshaker(logger, backchannel.NewRegistry(), nil))

	srv := grpc.NewServer(
		grpc.Creds(lm),
		grpc.UnknownServiceHandler(func(srv interface{}, stream grpc.ServerStream) error {
			_, err := backchannel.GetPeerID(stream.Context())
			if err == backchannel.ErrNonMultiplexedConnection {
				return errNonMuxed
			}

			assert.NoError(t, err)
			return errMuxed
		}),
	)
	defer srv.Stop()

	ln, err := net.Listen("tcp", "localhost:0")
	require.NoError(t, err)

	go testhelper.MustServe(t, srv, ln)
	ctx := testhelper.Context(t)

	t.Run("non-muxed conn", func(t *testing.T) {
		nonMuxedConn, err := Dial(ctx, "tcp://"+ln.Addr().String(), nil, nil)
		require.NoError(t, err)
		defer func() { require.NoError(t, nonMuxedConn.Close()) }()

		dialErr := nonMuxedConn.Invoke(ctx, "/Service/Method", &gitalypb.VoteTransactionRequest{}, &gitalypb.VoteTransactionResponse{})
		testhelper.RequireGrpcError(t, errNonMuxed, dialErr)
	})

	t.Run("muxed conn", func(t *testing.T) {
		handshaker := backchannel.NewClientHandshaker(logger, func() backchannel.Server { return grpc.NewServer() }, backchannel.DefaultConfiguration())
		nonMuxedConn, err := Dial(ctx, "tcp://"+ln.Addr().String(), nil, handshaker)
		require.NoError(t, err)
		defer func() { require.NoError(t, nonMuxedConn.Close()) }()

		dialErr := nonMuxedConn.Invoke(ctx, "/Service/Method", &gitalypb.VoteTransactionRequest{}, &gitalypb.VoteTransactionResponse{})
		testhelper.RequireGrpcError(t, errMuxed, dialErr)
	})
}
