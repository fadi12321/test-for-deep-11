//go:build !gitaly_test_sha256

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service/setup"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testserver"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

func TestCreateSubcommand(t *testing.T) {
	cfg := testcfg.Build(t)

	cfg.SocketPath = testserver.RunGitalyServer(t, cfg, nil, setup.RegisterAll)

	ctx := testhelper.Context(t)
	path := testhelper.TempDir(t)

	var repos []*gitalypb.Repository
	for i := 0; i < 5; i++ {
		repo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
			Seed:         gittest.SeedGitLabTest,
			RelativePath: fmt.Sprintf("repo-%d", i),
		})
		repos = append(repos, repo)
	}

	var stdin bytes.Buffer

	encoder := json.NewEncoder(&stdin)
	for _, repo := range repos {
		require.NoError(t, encoder.Encode(map[string]string{
			"address":         cfg.SocketPath,
			"token":           cfg.Auth.Token,
			"storage_name":    repo.StorageName,
			"relative_path":   repo.RelativePath,
			"gl_project_path": repo.GlProjectPath,
		}))
	}

	require.NoError(t, encoder.Encode(map[string]string{
		"address":       "invalid",
		"token":         "invalid",
		"relative_path": "invalid",
	}))

	cmd := createSubcommand{backupPath: path}

	fs := flag.NewFlagSet("create", flag.ContinueOnError)
	cmd.Flags(fs)

	require.NoError(t, fs.Parse([]string{"-path", path, "-id", "the-new-backup"}))
	require.EqualError(t,
		cmd.Run(ctx, &stdin, io.Discard),
		"create: pipeline: 1 failures encountered:\n - invalid: manager: isEmpty: could not dial source: invalid connection string: \"invalid\"\n")

	for _, repo := range repos {
		bundlePath := filepath.Join(path, repo.RelativePath, "the-new-backup", "001.bundle")
		require.FileExists(t, bundlePath)
	}
}
