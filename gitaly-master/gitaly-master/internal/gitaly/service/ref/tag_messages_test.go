//go:build !gitaly_test_sha256

package ref

import (
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

func TestSuccessfulGetTagMessagesRequest(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg, repo, repoPath, client := setupRefService(t, ctx)

	message1 := strings.Repeat("a", helper.MaxCommitOrTagMessageSize*2)
	message2 := strings.Repeat("b", helper.MaxCommitOrTagMessageSize)

	tag1ID := gittest.WriteTag(t, cfg, repoPath, "big-tag-1", "master", gittest.WriteTagConfig{Message: message1})
	tag2ID := gittest.WriteTag(t, cfg, repoPath, "big-tag-2", "master~", gittest.WriteTagConfig{Message: message2})

	request := &gitalypb.GetTagMessagesRequest{
		Repository: repo,
		TagIds:     []string{tag1ID.String(), tag2ID.String()},
	}

	expectedMessages := []*gitalypb.GetTagMessagesResponse{
		{
			TagId:   tag1ID.String(),
			Message: []byte(message1 + "\n"),
		},
		{
			TagId:   tag2ID.String(),
			Message: []byte(message2 + "\n"),
		},
	}

	c, err := client.GetTagMessages(ctx, request)
	require.NoError(t, err)

	fetchedMessages := readAllMessagesFromClient(t, c)
	require.Len(t, fetchedMessages, len(expectedMessages))
	testhelper.ProtoEqual(t, expectedMessages[0], fetchedMessages[0])
	testhelper.ProtoEqual(t, expectedMessages[1], fetchedMessages[1])
}

func TestFailedGetTagMessagesRequest(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)
	_, client := setupRefServiceWithoutRepo(t)

	testCases := []struct {
		desc        string
		request     *gitalypb.GetTagMessagesRequest
		expectedErr error
	}{
		{
			desc: "empty Repository",
			request: &gitalypb.GetTagMessagesRequest{
				Repository: nil,
				TagIds:     []string{"5937ac0a7beb003549fc5fd26fc247adbce4a52e"},
			},
			expectedErr: status.Error(codes.InvalidArgument, testhelper.GitalyOrPraefect(
				"empty Repository",
				"repo scoped: empty Repository",
			)),
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.desc, func(t *testing.T) {
			c, err := client.GetTagMessages(ctx, testCase.request)
			require.NoError(t, err)
			_, err = c.Recv()
			testhelper.RequireGrpcError(t, testCase.expectedErr, err)
		})
	}
}

func readAllMessagesFromClient(t *testing.T, c gitalypb.RefService_GetTagMessagesClient) (messages []*gitalypb.GetTagMessagesResponse) {
	for {
		resp, err := c.Recv()
		if err == io.EOF {
			break
		}
		require.NoError(t, err)

		if resp.TagId != "" {
			messages = append(messages, resp)
			// first message contains a chunk of the message, so no need to append anything
			continue
		}

		currentMessage := messages[len(messages)-1]
		currentMessage.Message = append(currentMessage.Message, resp.Message...)
	}

	return
}
