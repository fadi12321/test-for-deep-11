package rubyserver

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
)

func TestPingSuccess(t *testing.T) {
	cfg := testcfg.Build(t)
	s := New(cfg, gittest.NewCommandFactory(t, cfg))
	require.NoError(t, s.Start())
	defer s.Stop()

	require.True(t, len(s.workers) > 0, "expected at least one worker in server")
	w := s.workers[0]

	var pingErr error
	for start := time.Now(); time.Since(start) < ConnectTimeout; time.Sleep(100 * time.Millisecond) {
		pingErr = ping(w.address)
		if pingErr == nil {
			break
		}
	}

	require.NoError(t, pingErr, "health check should pass")
}

func TestPingFail(t *testing.T) {
	require.Error(t, ping("fake address"), "health check should fail")
}
