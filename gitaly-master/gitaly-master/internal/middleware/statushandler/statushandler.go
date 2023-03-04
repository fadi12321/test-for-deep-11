package statushandler

import (
	"context"

	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"google.golang.org/grpc"
)

// Unary is a unary server interceptor that converts error happened during the call into a
// response status returned as an error.
func Unary(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	resp, err := handler(ctx, req)
	return resp, wrapCtxErr(ctx, err)
}

// Stream is a server interceptor that converts error happened during the call into a
// response status returned as an error.
func Stream(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
	ctx := stream.Context()
	err := handler(srv, stream)
	return wrapCtxErr(ctx, err)
}

// wrapCtxErr returns an error as an instance of the google.golang.org/grpc/status package or nil.
// In case the ctx is cancelled or timeout happened it will be reflected in the returned status
// code. Otherwise, the error is converted into the status with the helper function. If an error
// can provide a status (error created with helper package, etc.) it is used. Otherwise, the Internal
// status code will be used instead.
func wrapCtxErr(ctx context.Context, err error) error {
	switch {
	case err == nil:
		return nil
	case ctx.Err() == context.DeadlineExceeded:
		return structerr.NewDeadlineExceeded("%v", err)
	case ctx.Err() == context.Canceled:
		return structerr.NewCanceled("%v", err)
	default:
		return structerr.NewInternal("%w", err)
	}
}
