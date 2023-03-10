//go:build !gitaly_test_sha256

package hook

import (
	"bytes"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/text"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata/featureflag"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestUpdateInvalidArgument(t *testing.T) {
	cfg := testcfg.Build(t)
	serverSocketPath := runHooksServer(t, cfg, nil)
	client, conn := newHooksClient(t, serverSocketPath)
	t.Cleanup(func() { conn.Close() })
	ctx := testhelper.Context(t)

	stream, err := client.UpdateHook(ctx, &gitalypb.UpdateHookRequest{})
	require.NoError(t, err)
	_, err = stream.Recv()

	testhelper.RequireGrpcError(t, status.Error(codes.InvalidArgument, "empty Repository"), err)
}

func TestUpdate_CustomHooks(t *testing.T) {
	ctx := testhelper.Context(t)
	cfg, repo, repoPath, client := setupHookService(t, ctx)

	hooksPayload, err := git.NewHooksPayload(
		cfg,
		repo,
		nil,
		&git.UserDetails{
			UserID:   "key-123",
			Username: "username",
			Protocol: "web",
		},
		git.UpdateHook,
		featureflag.FromContext(ctx),
	).Env()
	require.NoError(t, err)

	envVars := []string{
		hooksPayload,
	}

	req := gitalypb.UpdateHookRequest{
		Repository:           repo,
		Ref:                  []byte("master"),
		OldValue:             strings.Repeat("a", 40),
		NewValue:             strings.Repeat("b", 40),
		EnvironmentVariables: envVars,
	}

	errorMsg := "error123"
	gittest.WriteCustomHook(t, repoPath, "update", []byte(fmt.Sprintf(`#!/usr/bin/env bash
echo %s 1>&2
exit 1
`, errorMsg)))

	stream, err := client.UpdateHook(ctx, &req)
	require.NoError(t, err)

	var status int32
	var stderr, stdout bytes.Buffer
	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			break
		}
		require.NoError(t, err, "when receiving stream")

		stderr.Write(resp.GetStderr())
		stdout.Write(resp.GetStdout())

		status = resp.GetExitStatus().GetValue()
	}

	assert.Equal(t, int32(1), status)
	assert.Equal(t, errorMsg, text.ChompBytes(stderr.Bytes()), "hook stderr")
	assert.Equal(t, "", text.ChompBytes(stdout.Bytes()), "hook stdout")
}
