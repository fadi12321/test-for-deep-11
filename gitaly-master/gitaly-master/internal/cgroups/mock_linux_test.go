/*
   Adapted from https://github.com/containerd/cgroups/blob/f1d9380fd3c028194db9582825512fdf3f39ab2a/mock_test.go

   Copyright The containerd Authors.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

package cgroups

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/containerd/cgroups"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/perm"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
)

type mockCgroup struct {
	root       string
	subsystems []cgroups.Subsystem
}

func newMock(t *testing.T) *mockCgroup {
	t.Helper()

	root := testhelper.TempDir(t)

	subsystems, err := defaultSubsystems(root)
	require.NoError(t, err)

	for _, s := range subsystems {
		require.NoError(t, os.MkdirAll(filepath.Join(root, string(s.Name())), perm.SharedDir))
	}

	return &mockCgroup{
		root:       root,
		subsystems: subsystems,
	}
}

func (m *mockCgroup) hierarchy() ([]cgroups.Subsystem, error) {
	return m.subsystems, nil
}

func (m *mockCgroup) setupMockCgroupFiles(
	t *testing.T,
	manager *CGroupV1Manager,
	memFailCount int,
) {
	for _, s := range m.subsystems {
		cgroupPath := filepath.Join(m.root, string(s.Name()), manager.currentProcessCgroup())
		require.NoError(t, os.MkdirAll(cgroupPath, perm.SharedDir))

		contentByFilename := map[string]string{
			"cgroup.procs": "",
		}

		switch s.Name() {
		case "memory":
			contentByFilename["memory.stat"] = ""
			contentByFilename["memory.oom_control"] = ""
			contentByFilename["memory.usage_in_bytes"] = "0"
			contentByFilename["memory.max_usage_in_bytes"] = "0"
			contentByFilename["memory.limit_in_bytes"] = "0"
			contentByFilename["memory.failcnt"] = "0"
			contentByFilename["memory.memsw.failcnt"] = "0"
			contentByFilename["memory.memsw.usage_in_bytes"] = "0"
			contentByFilename["memory.memsw.max_usage_in_bytes"] = "0"
			contentByFilename["memory.memsw.limit_in_bytes"] = "0"
			contentByFilename["memory.kmem.usage_in_bytes"] = "0"
			contentByFilename["memory.kmem.max_usage_in_bytes"] = "0"
			contentByFilename["memory.kmem.failcnt"] = "0"
			contentByFilename["memory.kmem.limit_in_bytes"] = "0"
			contentByFilename["memory.kmem.tcp.usage_in_bytes"] = "0"
			contentByFilename["memory.kmem.tcp.max_usage_in_bytes"] = "0"
			contentByFilename["memory.kmem.tcp.failcnt"] = "0"
			contentByFilename["memory.kmem.tcp.limit_in_bytes"] = "0"
			contentByFilename["memory.failcnt"] = strconv.Itoa(memFailCount)
		case "cpu":
			contentByFilename["cpu.stat"] = ""
			contentByFilename["cpu.shares"] = "0"
		default:
			require.FailNow(t, "cannot set up subsystem", "unknown subsystem %q", s.Name())
		}

		for filename, content := range contentByFilename {
			controlFilePath := filepath.Join(cgroupPath, filename)
			require.NoError(t, os.WriteFile(controlFilePath, []byte(content), perm.SharedFile))
		}

		for shard := uint(0); shard < manager.cfg.Repositories.Count; shard++ {
			shardPath := filepath.Join(cgroupPath, fmt.Sprintf("repos-%d", shard))
			require.NoError(t, os.MkdirAll(shardPath, perm.SharedDir))

			for filename, content := range contentByFilename {
				shardControlFilePath := filepath.Join(shardPath, filename)
				require.NoError(t, os.WriteFile(shardControlFilePath, []byte(content), perm.SharedFile))
			}
		}
	}
}
