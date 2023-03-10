//go:build !gitaly_test_sha256

package ref

import (
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestGetTagSignatures(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg, repoProto, repoPath, client := setupRefService(t, ctx)

	message1 := strings.Repeat("a", helper.MaxCommitOrTagMessageSize) + "\n"
	signature1 := string(testhelper.MustReadFile(t, "testdata/tag-1e292f8fedd741b75372e19097c76d327140c312-signature"))
	tag1ID := gittest.WriteTag(t, cfg, repoPath, "big-tag-1", "master", gittest.WriteTagConfig{Message: message1 + signature1})
	content1 := fmt.Sprintf("object 1e292f8fedd741b75372e19097c76d327140c312\ntype commit\ntag big-tag-1\ntagger %s\n\n%s", gittest.DefaultCommitterSignature, message1)

	message2 := strings.Repeat("b", helper.MaxCommitOrTagMessageSize) + "\n"
	signature2 := string(testhelper.MustReadFile(t, "testdata/tag-7975be0116940bf2ad4321f79d02a55c5f7779aa-signature"))
	tag2ID := gittest.WriteTag(t, cfg, repoPath, "big-tag-2", "master~", gittest.WriteTagConfig{Message: message2 + signature2})
	content2 := fmt.Sprintf("object 7975be0116940bf2ad4321f79d02a55c5f7779aa\ntype commit\ntag big-tag-2\ntagger %s\n\n%s", gittest.DefaultCommitterSignature, message2)

	message3 := "tag message\n"
	tag3ID := gittest.WriteTag(t, cfg, repoPath, "tag-3", "master~~", gittest.WriteTagConfig{Message: message3})
	content3 := fmt.Sprintf("object 60ecb67744cb56576c30214ff52294f8ce2def98\ntype commit\ntag tag-3\ntagger %s\n\n%s", gittest.DefaultCommitterSignature, message3)

	for _, tc := range []struct {
		desc               string
		revisions          []string
		expectedErr        error
		expectedSignatures []*gitalypb.GetTagSignaturesResponse_TagSignature
	}{
		{
			desc:        "missing revisions",
			revisions:   []string{},
			expectedErr: status.Error(codes.InvalidArgument, "missing revisions"),
		},
		{
			desc: "invalid revision",
			revisions: []string{
				"--foobar",
			},
			expectedErr: status.Error(codes.InvalidArgument, "invalid revision: \"--foobar\""),
		},
		{
			desc: "unknown id",
			revisions: []string{
				"b10ff336f3fbfb131431c4959915cdfd1b49c635",
			},
			expectedErr: status.Error(codes.Internal, "cat-file iterator stop: rev-list pipeline command: exit status 128, stderr: \"fatal: bad object b10ff336f3fbfb131431c4959915cdfd1b49c635\\n\""),
		},
		{
			desc: "commit id",
			revisions: []string{
				"1e292f8fedd741b75372e19097c76d327140c312",
			},
			expectedSignatures: nil,
		},
		{
			desc: "commit ref",
			revisions: []string{
				"refs/heads/master",
			},
			expectedSignatures: nil,
		},
		{
			desc: "single tag signature",
			revisions: []string{
				tag1ID.String(),
			},
			expectedSignatures: []*gitalypb.GetTagSignaturesResponse_TagSignature{
				{
					TagId:     tag1ID.String(),
					Signature: []byte(signature1),
					Content:   []byte(content1),
				},
			},
		},
		{
			desc: "single tag signature by short SHA",
			revisions: []string{
				tag1ID.String()[:7],
			},
			expectedSignatures: []*gitalypb.GetTagSignaturesResponse_TagSignature{
				{
					TagId:     tag1ID.String(),
					Signature: []byte(signature1),
					Content:   []byte(content1),
				},
			},
		},
		{
			desc: "single tag signature by ref",
			revisions: []string{
				"refs/tags/big-tag-1",
			},
			expectedSignatures: []*gitalypb.GetTagSignaturesResponse_TagSignature{
				{
					TagId:     tag1ID.String(),
					Signature: []byte(signature1),
					Content:   []byte(content1),
				},
			},
		},
		{
			desc: "multiple tag signatures",
			revisions: []string{
				tag1ID.String(),
				tag2ID.String(),
			},
			expectedSignatures: []*gitalypb.GetTagSignaturesResponse_TagSignature{
				{
					TagId:     tag1ID.String(),
					Signature: []byte(signature1),
					Content:   []byte(content1),
				},
				{
					TagId:     tag2ID.String(),
					Signature: []byte(signature2),
					Content:   []byte(content2),
				},
			},
		},
		{
			desc: "tag without signature",
			revisions: []string{
				tag3ID.String(),
			},
			expectedSignatures: []*gitalypb.GetTagSignaturesResponse_TagSignature{
				{
					TagId:     tag3ID.String(),
					Signature: []byte(""),
					Content:   []byte(content3),
				},
			},
		},
		{
			desc: "pseudorevisions",
			revisions: []string{
				"--not",
				"--all",
			},
			expectedSignatures: nil,
		},
	} {
		tc := tc

		t.Run(tc.desc, func(t *testing.T) {
			t.Parallel()

			stream, err := client.GetTagSignatures(ctx, &gitalypb.GetTagSignaturesRequest{
				Repository:   repoProto,
				TagRevisions: tc.revisions,
			})
			require.NoError(t, err)

			var signatures []*gitalypb.GetTagSignaturesResponse_TagSignature
			for {
				resp, err := stream.Recv()
				if err != nil {
					if !errors.Is(err, io.EOF) {
						testhelper.RequireGrpcError(t, tc.expectedErr, err)
					}
					break
				}

				signatures = append(signatures, resp.Signatures...)
			}

			testhelper.ProtoEqual(t, tc.expectedSignatures, signatures)
		})
	}
}

func TestGetTagSignatures_validate(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)
	_, repoProto, _, client := setupRefService(t, ctx)

	for _, tc := range []struct {
		desc        string
		req         *gitalypb.GetTagSignaturesRequest
		expectedErr error
	}{
		{
			desc: "repository not provided",
			req:  &gitalypb.GetTagSignaturesRequest{Repository: nil},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
		{
			desc:        "no tag revisions",
			req:         &gitalypb.GetTagSignaturesRequest{Repository: repoProto, TagRevisions: nil},
			expectedErr: status.Error(codes.InvalidArgument, "missing revisions"),
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			stream, err := client.GetTagSignatures(ctx, tc.req)
			require.NoError(t, err)
			_, err = stream.Recv()
			testhelper.RequireGrpcError(t, tc.expectedErr, err)
		})
	}
}
