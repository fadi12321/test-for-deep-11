package testhelper

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/testing/protocmp"
)

// SetCtxGrpcMethod will set the gRPC context value for the proper key
// responsible for an RPC full method name. This directly corresponds to the
// gRPC function responsible for extracting the method:
// https://godoc.org/google.golang.org/grpc#Method
func SetCtxGrpcMethod(ctx context.Context, method string) context.Context {
	return grpc.NewContextWithServerTransportStream(ctx, mockServerTransportStream{method})
}

type mockServerTransportStream struct {
	method string
}

func (msts mockServerTransportStream) Method() string             { return msts.method }
func (mockServerTransportStream) SetHeader(md metadata.MD) error  { return nil }
func (mockServerTransportStream) SendHeader(md metadata.MD) error { return nil }
func (mockServerTransportStream) SetTrailer(md metadata.MD) error { return nil }

// ProtoEqual asserts that expected and actual protobuf messages are equal.
// It can accept not only proto.Message, but slices, maps, and structs too.
// This is required as comparing messages directly with `require.Equal` doesn't
// work.
func ProtoEqual(tb testing.TB, expected, actual interface{}) {
	tb.Helper()
	require.Empty(tb, cmp.Diff(expected, actual, protocmp.Transform(), cmpopts.EquateErrors()))
}

// RequireGrpcCode asserts that the error has the expected gRPC status code.
func RequireGrpcCode(tb testing.TB, err error, expectedCode codes.Code) {
	tb.Helper()

	require.Error(tb, err)
	status, ok := status.FromError(err)
	require.True(tb, ok)
	require.Equal(tb, expectedCode, status.Code())
}

// AssertGrpcCode asserts that the error has the expected gRPC status code.
func AssertGrpcCode(tb testing.TB, err error, expectedCode codes.Code) {
	tb.Helper()

	assert.Error(tb, err)
	status, ok := status.FromError(err)
	assert.True(tb, ok)
	assert.Equal(tb, expectedCode, status.Code())
}

// RequireGrpcError asserts that expected and actual gRPC errors are equal. Comparing gRPC errors
// directly with `require.Equal()` will not typically work correct.
func RequireGrpcError(tb testing.TB, expected, actual error) {
	tb.Helper()
	// .Proto() handles nil receiver
	ProtoEqual(tb, status.Convert(expected).Proto(), status.Convert(actual).Proto())
}

// MergeOutgoingMetadata merges provided metadata-s and returns context with resulting value.
func MergeOutgoingMetadata(ctx context.Context, md ...metadata.MD) context.Context {
	ctxmd, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		return metadata.NewOutgoingContext(ctx, metadata.Join(md...))
	}

	return metadata.NewOutgoingContext(ctx, metadata.Join(append(md, ctxmd)...))
}

// MergeIncomingMetadata merges provided metadata-s and returns context with resulting value.
func MergeIncomingMetadata(ctx context.Context, md ...metadata.MD) context.Context {
	ctxmd, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return metadata.NewIncomingContext(ctx, metadata.Join(md...))
	}

	return metadata.NewIncomingContext(ctx, metadata.Join(append(md, ctxmd)...))
}
