//go:build !gitaly_test_sha256

package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/sirupsen/logrus/hooks/test"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/command"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config/auth"
	internallog "gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config/log"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config/prometheus"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service/hook"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitlab"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/text"
	gitalylog "gitlab.com/gitlab-org/gitaly/v15/internal/log"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata/featureflag"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testserver"
	"gitlab.com/gitlab-org/gitaly/v15/internal/transaction/txinfo"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc"
)

type glHookValues struct {
	GLID, GLUsername, GLProtocol, GitObjectDir string
	GitAlternateObjectDirs                     []string
}

type proxyValues struct {
	HTTPProxy, HTTPSProxy, NoProxy string
}

var (
	enabledFeatureFlag  = featureflag.FeatureFlag{Name: "enabled-feature-flag", OnByDefault: false}
	disabledFeatureFlag = featureflag.FeatureFlag{Name: "disabled-feature-flag", OnByDefault: true}
)

func featureFlags(ctx context.Context) map[featureflag.FeatureFlag]bool {
	ctx = featureflag.IncomingCtxWithFeatureFlag(ctx, enabledFeatureFlag, true)
	ctx = featureflag.IncomingCtxWithFeatureFlag(ctx, disabledFeatureFlag, false)
	return featureflag.FromContext(ctx)
}

// envForHooks generates a set of environment variables for gitaly hooks
func envForHooks(tb testing.TB, ctx context.Context, cfg config.Cfg, repo *gitalypb.Repository, glHookValues glHookValues, proxyValues proxyValues, gitPushOptions ...string) []string {
	payload, err := git.NewHooksPayload(cfg, repo, nil, &git.UserDetails{
		UserID:   glHookValues.GLID,
		Username: glHookValues.GLUsername,
		Protocol: glHookValues.GLProtocol,
	}, git.AllHooks, featureFlags(ctx)).Env()
	require.NoError(tb, err)

	env := append(command.AllowedEnvironment(os.Environ()), []string{
		payload,
		fmt.Sprintf("%s=%s", gitalylog.GitalyLogDirEnvKey, cfg.Logging.Dir),
	}...)
	env = append(env, gitPushOptions...)

	if proxyValues.HTTPProxy != "" {
		env = append(env, fmt.Sprintf("HTTP_PROXY=%s", proxyValues.HTTPProxy))
		env = append(env, fmt.Sprintf("http_proxy=%s", proxyValues.HTTPProxy))
	}
	if proxyValues.HTTPSProxy != "" {
		env = append(env, fmt.Sprintf("HTTPS_PROXY=%s", proxyValues.HTTPSProxy))
		env = append(env, fmt.Sprintf("https_proxy=%s", proxyValues.HTTPSProxy))
	}
	if proxyValues.NoProxy != "" {
		env = append(env, fmt.Sprintf("NO_PROXY=%s", proxyValues.NoProxy))
		env = append(env, fmt.Sprintf("no_proxy=%s", proxyValues.NoProxy))
	}

	if glHookValues.GitObjectDir != "" {
		env = append(env, fmt.Sprintf("GIT_OBJECT_DIRECTORY=%s", glHookValues.GitObjectDir))
	}
	if len(glHookValues.GitAlternateObjectDirs) > 0 {
		env = append(env, fmt.Sprintf("GIT_ALTERNATE_OBJECT_DIRECTORIES=%s", strings.Join(glHookValues.GitAlternateObjectDirs, ":")))
	}

	return env
}

func TestMain(m *testing.M) {
	testhelper.Run(m)
}

func TestHooksPrePostWithSymlinkedStoragePath(t *testing.T) {
	tempDir := testhelper.TempDir(t)

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t)

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
	})
	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	originalStoragePath := cfg.Storages[0].Path
	symlinkedStoragePath := filepath.Join(tempDir, "storage")
	require.NoError(t, os.Symlink(originalStoragePath, symlinkedStoragePath))
	cfg.Storages[0].Path = symlinkedStoragePath

	testHooksPrePostReceive(t, cfg, repo, repoPath)
}

func TestHooksPrePostReceive(t *testing.T) {
	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t)

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
	})

	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)
	testHooksPrePostReceive(t, cfg, repo, repoPath)
}

func testHooksPrePostReceive(t *testing.T, cfg config.Cfg, repo *gitalypb.Repository, repoPath string) {
	ctx := testhelper.Context(t)

	secretToken := "secret token"
	glID := "key-1234"
	glUsername := "iamgitlab"
	glProtocol := "ssh"

	changes := "abc"

	gitPushOptions := []string{"gitpushoption1", "gitpushoption2"}
	gitObjectDir := filepath.Join(repoPath, "objects", "temp")
	gitAlternateObjectDirs := []string{filepath.Join(repoPath, "objects")}

	gitlabUser, gitlabPassword := "gitlab_user-1234", "gitlabsecret9887"
	httpProxy, httpsProxy, noProxy := "http://test.example.com:8080", "https://test.example.com:8080", "*"

	logger, _ := test.NewNullLogger()

	c := gitlab.TestServerOptions{
		User:                        gitlabUser,
		Password:                    gitlabPassword,
		SecretToken:                 secretToken,
		GLID:                        glID,
		GLRepository:                repo.GetGlRepository(),
		Changes:                     changes,
		PostReceiveCounterDecreased: true,
		Protocol:                    "ssh",
		GitPushOptions:              gitPushOptions,
		GitObjectDir:                gitObjectDir,
		GitAlternateObjectDirs:      gitAlternateObjectDirs,
		RepoPath:                    repoPath,
	}

	gitlabURL, cleanup := gitlab.NewTestServer(t, c)
	defer cleanup()
	cfg.Gitlab.URL = gitlabURL
	cfg.Gitlab.SecretFile = gitlab.WriteShellSecretFile(t, cfg.GitlabShell.Dir, secretToken)
	cfg.Gitlab.HTTPSettings.User = gitlabUser
	cfg.Gitlab.HTTPSettings.Password = gitlabPassword

	gitlabClient, err := gitlab.NewHTTPClient(logger, cfg.Gitlab, cfg.TLS, prometheus.Config{})
	require.NoError(t, err)

	runHookServiceWithGitlabClient(t, cfg, gitlabClient)

	gitObjectDirRegex := regexp.MustCompile(`(?m)^GIT_OBJECT_DIRECTORY=(.*)$`)
	gitAlternateObjectDirRegex := regexp.MustCompile(`(?m)^GIT_ALTERNATE_OBJECT_DIRECTORIES=(.*)$`)

	hookNames := []string{"pre-receive", "post-receive"}

	for _, hookName := range hookNames {
		t.Run(fmt.Sprintf("hookName: %s", hookName), func(t *testing.T) {
			customHookOutputPath := gittest.WriteEnvToCustomHook(t, repoPath, hookName)

			var stderr, stdout bytes.Buffer
			stdin := bytes.NewBuffer([]byte(changes))
			require.NoError(t, err)
			cmd := exec.Command(cfg.BinaryPath("gitaly-hooks"))
			cmd.Args = []string{hookName}
			cmd.Stderr = &stderr
			cmd.Stdout = &stdout
			cmd.Stdin = stdin
			cmd.Env = envForHooks(
				t,
				ctx,
				cfg,
				repo,
				glHookValues{
					GLID:                   glID,
					GLUsername:             glUsername,
					GLProtocol:             glProtocol,
					GitObjectDir:           c.GitObjectDir,
					GitAlternateObjectDirs: c.GitAlternateObjectDirs,
				},
				proxyValues{
					HTTPProxy:  httpProxy,
					HTTPSProxy: httpsProxy,
					NoProxy:    noProxy,
				},
				"GIT_PUSH_OPTION_COUNT=2",
				"GIT_PUSH_OPTION_0=gitpushoption1",
				"GIT_PUSH_OPTION_1=gitpushoption2",
			)

			cmd.Dir = repoPath

			err = cmd.Run()
			assert.Empty(t, stderr.String())
			assert.Empty(t, stdout.String())
			require.NoError(t, err)

			output := string(testhelper.MustReadFile(t, customHookOutputPath))
			requireContainsOnce(t, output, "GL_USERNAME="+glUsername)
			requireContainsOnce(t, output, "GL_ID="+glID)
			requireContainsOnce(t, output, "GL_REPOSITORY="+repo.GetGlRepository())
			requireContainsOnce(t, output, "GL_PROTOCOL="+glProtocol)
			requireContainsOnce(t, output, "GIT_PUSH_OPTION_COUNT=2")
			requireContainsOnce(t, output, "GIT_PUSH_OPTION_0=gitpushoption1")
			requireContainsOnce(t, output, "GIT_PUSH_OPTION_1=gitpushoption2")
			requireContainsOnce(t, output, "HTTP_PROXY="+httpProxy)
			requireContainsOnce(t, output, "http_proxy="+httpProxy)
			requireContainsOnce(t, output, "HTTPS_PROXY="+httpsProxy)
			requireContainsOnce(t, output, "https_proxy="+httpsProxy)
			requireContainsOnce(t, output, "no_proxy="+noProxy)
			requireContainsOnce(t, output, "NO_PROXY="+noProxy)

			if hookName == "pre-receive" {
				gitObjectDirMatches := gitObjectDirRegex.FindStringSubmatch(output)
				require.Len(t, gitObjectDirMatches, 2)
				require.Equal(t, gitObjectDir, gitObjectDirMatches[1])

				gitAlternateObjectDirMatches := gitAlternateObjectDirRegex.FindStringSubmatch(output)
				require.Len(t, gitAlternateObjectDirMatches, 2)
				require.Equal(t, strings.Join(gitAlternateObjectDirs, ":"), gitAlternateObjectDirMatches[1])
			} else {
				require.Contains(t, output, "GL_PROTOCOL="+glProtocol)
			}
		})
	}
}

func TestHooksUpdate(t *testing.T) {
	ctx := testhelper.Context(t)

	glID := "key-1234"
	glUsername := "iamgitlab"
	glProtocol := "ssh"

	customHooksDir := testhelper.TempDir(t)

	cfg := testcfg.Build(t, testcfg.WithBase(config.Cfg{
		Auth:  auth.Config{Token: "abc123"},
		Hooks: config.Hooks{CustomHooksDir: customHooksDir},
	}))
	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	require.NoError(t, os.Symlink(filepath.Join(cfg.GitlabShell.Dir, "config.yml"), filepath.Join(cfg.GitlabShell.Dir, "config.yml")))

	cfg.Gitlab.SecretFile = gitlab.WriteShellSecretFile(t, cfg.GitlabShell.Dir, "the wrong token")

	runHookServiceServer(t, cfg)

	testHooksUpdate(t, ctx, cfg, glHookValues{
		GLID:       glID,
		GLUsername: glUsername,
		GLProtocol: glProtocol,
	})
}

func testHooksUpdate(t *testing.T, ctx context.Context, cfg config.Cfg, glValues glHookValues) {
	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
	})

	refval, oldval, newval := "refval", strings.Repeat("a", 40), strings.Repeat("b", 40)

	// Write a custom update hook that dumps all arguments seen by the hook...
	customHookArgsPath := filepath.Join(testhelper.TempDir(t), "containsarguments")
	testhelper.WriteExecutable(t,
		filepath.Join(repoPath, "custom_hooks", "update.d", "dumpargsscript"),
		[]byte(fmt.Sprintf(`#!/usr/bin/env bash
			echo "$@" >%q
		`, customHookArgsPath)),
	)

	// ... and a second custom hook that dumps the environment variables.
	customHookEnvPath := gittest.WriteEnvToCustomHook(t, repoPath, "update")

	var stdout, stderr bytes.Buffer
	cmd := exec.Command(cfg.BinaryPath("gitaly-hooks"))
	cmd.Args = []string{"update", refval, oldval, newval}
	cmd.Env = envForHooks(t, ctx, cfg, repo, glValues, proxyValues{})
	cmd.Dir = repoPath
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	cmd.Dir = repoPath

	require.NoError(t, cmd.Run())
	require.Empty(t, stdout.String())
	require.Empty(t, stderr.String())

	// Ensure that the hook was executed with the expected arguments...
	require.Equal(t,
		fmt.Sprintf("%s %s %s", refval, oldval, newval),
		text.ChompBytes(testhelper.MustReadFile(t, customHookArgsPath)),
	)

	// ... and with the expected environment variables.
	output := string(testhelper.MustReadFile(t, customHookEnvPath))
	require.Contains(t, output, "GL_USERNAME="+glValues.GLUsername)
	require.Contains(t, output, "GL_ID="+glValues.GLID)
	require.Contains(t, output, "GL_REPOSITORY="+repo.GetGlRepository())
	require.Contains(t, output, "GL_PROTOCOL="+glValues.GLProtocol)
}

func TestHooksPostReceiveFailed(t *testing.T) {
	secretToken := "secret token"
	glID := "key-1234"
	glUsername := "iamgitlab"
	glProtocol := "ssh"
	changes := "oldhead newhead"

	logger, _ := test.NewNullLogger()

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t, testcfg.WithBase(config.Cfg{Auth: auth.Config{Token: "abc123"}}))

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
	})

	gitalyHooksPath := testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	// By setting the last parameter to false, the post-receive API call will
	// send back {"reference_counter_increased": false}, indicating something went wrong
	// with the call

	c := gitlab.TestServerOptions{
		User:                        "",
		Password:                    "",
		SecretToken:                 secretToken,
		Changes:                     changes,
		GLID:                        glID,
		GLRepository:                repo.GetGlRepository(),
		PostReceiveCounterDecreased: false,
		Protocol:                    "ssh",
	}
	serverURL, cleanup := gitlab.NewTestServer(t, c)
	defer cleanup()
	cfg.Gitlab.URL = serverURL
	cfg.Gitlab.SecretFile = gitlab.WriteShellSecretFile(t, cfg.GitlabShell.Dir, secretToken)

	gitlabClient, err := gitlab.NewHTTPClient(logger, cfg.Gitlab, cfg.TLS, prometheus.Config{})
	require.NoError(t, err)

	runHookServiceWithGitlabClient(t, cfg, gitlabClient)

	customHookOutputPath := gittest.WriteEnvToCustomHook(t, repoPath, "post-receive")

	var stdout, stderr bytes.Buffer

	testcases := []struct {
		desc    string
		primary bool
		verify  func(*testing.T, *exec.Cmd, *bytes.Buffer, *bytes.Buffer)
	}{
		{
			desc:    "Primary calls out to post_receive endpoint",
			primary: true,
			verify: func(t *testing.T, cmd *exec.Cmd, stdout, stderr *bytes.Buffer) {
				err = cmd.Run()
				code, ok := command.ExitStatus(err)
				require.True(t, ok, "expect exit status in %v", err)

				require.Equal(t, 1, code, "exit status")
				require.Empty(t, stdout.String())
				require.Empty(t, stderr.String())
				require.NoFileExists(t, customHookOutputPath)
			},
		},
		{
			desc:    "Secondary does not call out to post_receive endpoint",
			primary: false,
			verify: func(t *testing.T, cmd *exec.Cmd, stdout, stderr *bytes.Buffer) {
				err = cmd.Run()
				require.NoError(t, err)

				require.Empty(t, stdout.String())
				require.Empty(t, stderr.String())
				require.NoFileExists(t, customHookOutputPath)
			},
		},
	}

	for _, tc := range testcases {
		t.Run(tc.desc, func(t *testing.T) {
			hooksPayload, err := git.NewHooksPayload(
				cfg,
				repo,
				&txinfo.Transaction{
					ID:      1,
					Node:    "node",
					Primary: tc.primary,
				},
				&git.UserDetails{
					UserID:   glID,
					Username: glUsername,
					Protocol: glProtocol,
				},
				git.PostReceiveHook,
				featureFlags(ctx),
			).Env()
			require.NoError(t, err)

			env := envForHooks(t, ctx, cfg, repo, glHookValues{}, proxyValues{})
			env = append(env, hooksPayload)

			cmd := exec.Command(gitalyHooksPath)
			cmd.Args = []string{"post-receive"}
			cmd.Env = env
			cmd.Stdout = &stdout
			cmd.Stderr = &stderr
			cmd.Stdin = bytes.NewBuffer([]byte(changes))
			cmd.Dir = repoPath

			tc.verify(t, cmd, &stdout, &stderr)
		})
	}
}

func TestHooksNotAllowed(t *testing.T) {
	secretToken := "secret token"
	glID := "key-1234"
	glUsername := "iamgitlab"
	glProtocol := "ssh"
	changes := "oldhead newhead"

	logger, _ := test.NewNullLogger()

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t, testcfg.WithBase(config.Cfg{Auth: auth.Config{Token: "abc123"}}))

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
	})

	gitalyHooksPath := testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	c := gitlab.TestServerOptions{
		User:                        "",
		Password:                    "",
		SecretToken:                 secretToken,
		GLID:                        glID,
		GLRepository:                repo.GetGlRepository(),
		Changes:                     changes,
		PostReceiveCounterDecreased: true,
		Protocol:                    "ssh",
	}
	serverURL, cleanup := gitlab.NewTestServer(t, c)
	defer cleanup()

	cfg.Gitlab.URL = serverURL
	cfg.Gitlab.SecretFile = gitlab.WriteShellSecretFile(t, cfg.GitlabShell.Dir, "the wrong token")

	customHookOutputPath := gittest.WriteEnvToCustomHook(t, repoPath, "post-receive")

	gitlabClient, err := gitlab.NewHTTPClient(logger, cfg.Gitlab, cfg.TLS, prometheus.Config{})
	require.NoError(t, err)

	runHookServiceWithGitlabClient(t, cfg, gitlabClient)

	var stderr, stdout bytes.Buffer

	cmd := exec.Command(gitalyHooksPath)
	cmd.Args = []string{"pre-receive"}
	cmd.Stderr = &stderr
	cmd.Stdout = &stdout
	cmd.Stdin = strings.NewReader(changes)
	cmd.Env = envForHooks(t, ctx, cfg, repo,
		glHookValues{
			GLID:       glID,
			GLUsername: glUsername,
			GLProtocol: glProtocol,
		},
		proxyValues{})
	cmd.Dir = repoPath

	require.Error(t, cmd.Run())
	require.Equal(t, "GitLab: 401 Unauthorized\n", stderr.String())
	require.Equal(t, "", stdout.String())
	require.NoFileExists(t, customHookOutputPath)
}

func runHookServiceServer(t *testing.T, cfg config.Cfg, serverOpts ...testserver.GitalyServerOpt) {
	runHookServiceWithGitlabClient(t, cfg, gitlab.NewMockClient(
		t, gitlab.MockAllowed, gitlab.MockPreReceive, gitlab.MockPostReceive,
	), serverOpts...)
}

type featureFlagAsserter struct {
	gitalypb.UnimplementedHookServiceServer
	t       testing.TB
	wrapped gitalypb.HookServiceServer
}

func (svc featureFlagAsserter) assertFlags(ctx context.Context) {
	assert.True(svc.t, enabledFeatureFlag.IsEnabled(ctx))
	assert.True(svc.t, disabledFeatureFlag.IsDisabled(ctx))
}

func (svc featureFlagAsserter) PreReceiveHook(stream gitalypb.HookService_PreReceiveHookServer) error {
	svc.assertFlags(stream.Context())
	return svc.wrapped.PreReceiveHook(stream)
}

func (svc featureFlagAsserter) PostReceiveHook(stream gitalypb.HookService_PostReceiveHookServer) error {
	svc.assertFlags(stream.Context())
	return svc.wrapped.PostReceiveHook(stream)
}

func (svc featureFlagAsserter) UpdateHook(request *gitalypb.UpdateHookRequest, stream gitalypb.HookService_UpdateHookServer) error {
	svc.assertFlags(stream.Context())
	return svc.wrapped.UpdateHook(request, stream)
}

func (svc featureFlagAsserter) ReferenceTransactionHook(stream gitalypb.HookService_ReferenceTransactionHookServer) error {
	svc.assertFlags(stream.Context())
	return svc.wrapped.ReferenceTransactionHook(stream)
}

func (svc featureFlagAsserter) PackObjectsHookWithSidechannel(ctx context.Context, req *gitalypb.PackObjectsHookWithSidechannelRequest) (*gitalypb.PackObjectsHookWithSidechannelResponse, error) {
	svc.assertFlags(ctx)
	return svc.wrapped.PackObjectsHookWithSidechannel(ctx, req)
}

func runHookServiceWithGitlabClient(t *testing.T, cfg config.Cfg, gitlabClient gitlab.Client, serverOpts ...testserver.GitalyServerOpt) {
	testserver.RunGitalyServer(t, cfg, nil, func(srv *grpc.Server, deps *service.Dependencies) {
		gitalypb.RegisterHookServiceServer(srv, featureFlagAsserter{
			t: t, wrapped: hook.NewServer(deps.GetHookManager(), deps.GetGitCmdFactory(), deps.GetPackObjectsCache(), deps.GetPackObjectsConcurrencyTracker(), deps.GetPackObjectsLimiter()),
		})
	}, append(serverOpts, testserver.WithGitLabClient(gitlabClient))...)
}

func requireContainsOnce(t *testing.T, s string, contains string) {
	r := regexp.MustCompile(contains)
	matches := r.FindAllStringIndex(s, -1)
	require.Equal(t, 1, len(matches))
}

func TestGitalyHooksPackObjects(t *testing.T) {
	logDir := testhelper.TempDir(t)

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t, testcfg.WithBase(config.Cfg{
		Auth:    auth.Config{Token: "abc123"},
		Logging: config.Logging{Config: internallog.Config{Dir: logDir}},
	}))

	repo, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
	})

	logger, hook := test.NewNullLogger()
	runHookServiceServer(t, cfg, testserver.WithLogger(logger))

	testcfg.BuildGitalyHooks(t, cfg)
	testcfg.BuildGitalySSH(t, cfg)

	baseArgs := []string{
		"clone",
		"-u",
		"git -c uploadpack.allowFilter -c uploadpack.packObjectsHook=" + cfg.BinaryPath("gitaly-hooks") + " upload-pack",
		"--quiet",
		"--no-local",
		"--bare",
	}

	testCases := []struct {
		desc      string
		extraArgs []string
	}{
		{desc: "regular clone"},
		{desc: "shallow clone", extraArgs: []string{"--depth=1"}},
		{desc: "partial clone", extraArgs: []string{"--filter=blob:none"}},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			hook.Reset()

			tempDir := testhelper.TempDir(t)

			args := append(baseArgs, tc.extraArgs...)
			args = append(args, repoPath, tempDir)

			gittest.ExecOpts(t, cfg, gittest.ExecConfig{
				Env: (envForHooks(t, ctx, cfg, repo, glHookValues{}, proxyValues{})),
			}, args...)
		})
	}
}

func TestRequestedHooks(t *testing.T) {
	for hook, hookArgs := range map[git.Hook][]string{
		git.ReferenceTransactionHook: {"reference-transaction"},
		git.UpdateHook:               {"update"},
		git.PreReceiveHook:           {"pre-receive"},
		git.PostReceiveHook:          {"post-receive"},
		git.PackObjectsHook:          {"gitaly-hooks", "git"},
	} {
		t.Run(hookArgs[0], func(t *testing.T) {
			t.Run("unrequested hook is ignored", func(t *testing.T) {
				cfg := testcfg.Build(t)
				testcfg.BuildGitalyHooks(t, cfg)
				testcfg.BuildGitalySSH(t, cfg)

				payload, err := git.NewHooksPayload(cfg, &gitalypb.Repository{}, nil, nil, git.AllHooks&^hook, nil).Env()
				require.NoError(t, err)

				cmd := exec.Command(cfg.BinaryPath("gitaly-hooks"))
				cmd.Args = hookArgs
				cmd.Env = []string{payload}
				require.NoError(t, cmd.Run())
			})

			t.Run("requested hook runs", func(t *testing.T) {
				cfg := testcfg.Build(t)
				testcfg.BuildGitalyHooks(t, cfg)
				testcfg.BuildGitalySSH(t, cfg)

				payload, err := git.NewHooksPayload(cfg, &gitalypb.Repository{}, nil, nil, hook, nil).Env()
				require.NoError(t, err)

				cmd := exec.Command(cfg.BinaryPath("gitaly-hooks"))
				cmd.Args = hookArgs
				cmd.Env = []string{payload}

				// We simply check that there is an error here as an indicator that
				// the hook logic ran. We don't care for the actual error because we
				// know that in the previous testcase without the hook being
				// requested, there was no error.
				require.Error(t, cmd.Run(), "hook should have run and failed due to incomplete setup")
			})
		})
	}
}
