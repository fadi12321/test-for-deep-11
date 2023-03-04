// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             v3.21.7
// source: remote.proto

package gitalypb

import (
	context "context"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
// Requires gRPC-Go v1.32.0 or later.
const _ = grpc.SupportPackageIsVersion7

// RemoteServiceClient is the client API for RemoteService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type RemoteServiceClient interface {
	// UpdateRemoteMirror compares the references in the target repository and its remote mirror
	// repository. Any differences in the references are then addressed by pushing the differing
	// references to the mirror. Created and modified references are updated, removed references are
	// deleted from the mirror. UpdateRemoteMirror updates all tags. Branches are updated if they match
	// the patterns specified in the requests.
	UpdateRemoteMirror(ctx context.Context, opts ...grpc.CallOption) (RemoteService_UpdateRemoteMirrorClient, error)
	// This comment is left unintentionally blank.
	FindRemoteRepository(ctx context.Context, in *FindRemoteRepositoryRequest, opts ...grpc.CallOption) (*FindRemoteRepositoryResponse, error)
	// FindRemoteRootRef tries to find the root reference of a remote
	// repository. The root reference is the default branch as pointed to by
	// the remotes HEAD reference. Returns an InvalidArgument error if the
	// specified remote does not exist and a NotFound error in case no HEAD
	// branch was found.
	FindRemoteRootRef(ctx context.Context, in *FindRemoteRootRefRequest, opts ...grpc.CallOption) (*FindRemoteRootRefResponse, error)
}

type remoteServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewRemoteServiceClient(cc grpc.ClientConnInterface) RemoteServiceClient {
	return &remoteServiceClient{cc}
}

func (c *remoteServiceClient) UpdateRemoteMirror(ctx context.Context, opts ...grpc.CallOption) (RemoteService_UpdateRemoteMirrorClient, error) {
	stream, err := c.cc.NewStream(ctx, &RemoteService_ServiceDesc.Streams[0], "/gitaly.RemoteService/UpdateRemoteMirror", opts...)
	if err != nil {
		return nil, err
	}
	x := &remoteServiceUpdateRemoteMirrorClient{stream}
	return x, nil
}

type RemoteService_UpdateRemoteMirrorClient interface {
	Send(*UpdateRemoteMirrorRequest) error
	CloseAndRecv() (*UpdateRemoteMirrorResponse, error)
	grpc.ClientStream
}

type remoteServiceUpdateRemoteMirrorClient struct {
	grpc.ClientStream
}

func (x *remoteServiceUpdateRemoteMirrorClient) Send(m *UpdateRemoteMirrorRequest) error {
	return x.ClientStream.SendMsg(m)
}

func (x *remoteServiceUpdateRemoteMirrorClient) CloseAndRecv() (*UpdateRemoteMirrorResponse, error) {
	if err := x.ClientStream.CloseSend(); err != nil {
		return nil, err
	}
	m := new(UpdateRemoteMirrorResponse)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func (c *remoteServiceClient) FindRemoteRepository(ctx context.Context, in *FindRemoteRepositoryRequest, opts ...grpc.CallOption) (*FindRemoteRepositoryResponse, error) {
	out := new(FindRemoteRepositoryResponse)
	err := c.cc.Invoke(ctx, "/gitaly.RemoteService/FindRemoteRepository", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *remoteServiceClient) FindRemoteRootRef(ctx context.Context, in *FindRemoteRootRefRequest, opts ...grpc.CallOption) (*FindRemoteRootRefResponse, error) {
	out := new(FindRemoteRootRefResponse)
	err := c.cc.Invoke(ctx, "/gitaly.RemoteService/FindRemoteRootRef", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// RemoteServiceServer is the server API for RemoteService service.
// All implementations must embed UnimplementedRemoteServiceServer
// for forward compatibility
type RemoteServiceServer interface {
	// UpdateRemoteMirror compares the references in the target repository and its remote mirror
	// repository. Any differences in the references are then addressed by pushing the differing
	// references to the mirror. Created and modified references are updated, removed references are
	// deleted from the mirror. UpdateRemoteMirror updates all tags. Branches are updated if they match
	// the patterns specified in the requests.
	UpdateRemoteMirror(RemoteService_UpdateRemoteMirrorServer) error
	// This comment is left unintentionally blank.
	FindRemoteRepository(context.Context, *FindRemoteRepositoryRequest) (*FindRemoteRepositoryResponse, error)
	// FindRemoteRootRef tries to find the root reference of a remote
	// repository. The root reference is the default branch as pointed to by
	// the remotes HEAD reference. Returns an InvalidArgument error if the
	// specified remote does not exist and a NotFound error in case no HEAD
	// branch was found.
	FindRemoteRootRef(context.Context, *FindRemoteRootRefRequest) (*FindRemoteRootRefResponse, error)
	mustEmbedUnimplementedRemoteServiceServer()
}

// UnimplementedRemoteServiceServer must be embedded to have forward compatible implementations.
type UnimplementedRemoteServiceServer struct {
}

func (UnimplementedRemoteServiceServer) UpdateRemoteMirror(RemoteService_UpdateRemoteMirrorServer) error {
	return status.Errorf(codes.Unimplemented, "method UpdateRemoteMirror not implemented")
}
func (UnimplementedRemoteServiceServer) FindRemoteRepository(context.Context, *FindRemoteRepositoryRequest) (*FindRemoteRepositoryResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method FindRemoteRepository not implemented")
}
func (UnimplementedRemoteServiceServer) FindRemoteRootRef(context.Context, *FindRemoteRootRefRequest) (*FindRemoteRootRefResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method FindRemoteRootRef not implemented")
}
func (UnimplementedRemoteServiceServer) mustEmbedUnimplementedRemoteServiceServer() {}

// UnsafeRemoteServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to RemoteServiceServer will
// result in compilation errors.
type UnsafeRemoteServiceServer interface {
	mustEmbedUnimplementedRemoteServiceServer()
}

func RegisterRemoteServiceServer(s grpc.ServiceRegistrar, srv RemoteServiceServer) {
	s.RegisterService(&RemoteService_ServiceDesc, srv)
}

func _RemoteService_UpdateRemoteMirror_Handler(srv interface{}, stream grpc.ServerStream) error {
	return srv.(RemoteServiceServer).UpdateRemoteMirror(&remoteServiceUpdateRemoteMirrorServer{stream})
}

type RemoteService_UpdateRemoteMirrorServer interface {
	SendAndClose(*UpdateRemoteMirrorResponse) error
	Recv() (*UpdateRemoteMirrorRequest, error)
	grpc.ServerStream
}

type remoteServiceUpdateRemoteMirrorServer struct {
	grpc.ServerStream
}

func (x *remoteServiceUpdateRemoteMirrorServer) SendAndClose(m *UpdateRemoteMirrorResponse) error {
	return x.ServerStream.SendMsg(m)
}

func (x *remoteServiceUpdateRemoteMirrorServer) Recv() (*UpdateRemoteMirrorRequest, error) {
	m := new(UpdateRemoteMirrorRequest)
	if err := x.ServerStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func _RemoteService_FindRemoteRepository_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(FindRemoteRepositoryRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(RemoteServiceServer).FindRemoteRepository(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitaly.RemoteService/FindRemoteRepository",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(RemoteServiceServer).FindRemoteRepository(ctx, req.(*FindRemoteRepositoryRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _RemoteService_FindRemoteRootRef_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(FindRemoteRootRefRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(RemoteServiceServer).FindRemoteRootRef(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitaly.RemoteService/FindRemoteRootRef",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(RemoteServiceServer).FindRemoteRootRef(ctx, req.(*FindRemoteRootRefRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// RemoteService_ServiceDesc is the grpc.ServiceDesc for RemoteService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var RemoteService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "gitaly.RemoteService",
	HandlerType: (*RemoteServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "FindRemoteRepository",
			Handler:    _RemoteService_FindRemoteRepository_Handler,
		},
		{
			MethodName: "FindRemoteRootRef",
			Handler:    _RemoteService_FindRemoteRootRef_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "UpdateRemoteMirror",
			Handler:       _RemoteService_UpdateRemoteMirror_Handler,
			ClientStreams: true,
		},
	},
	Metadata: "remote.proto",
}
