package packfile_test

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/packfile"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
)

func TestMain(m *testing.M) {
	testhelper.Run(m)
}

func TestList(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t)

	for _, tc := range []struct {
		desc          string
		setup         func(t *testing.T) string
		expectedPacks int
	}{
		{
			desc: "empty repository",
			setup: func(t *testing.T) string {
				_, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
					SkipCreationViaService: true,
				})
				return repoPath
			},
			expectedPacks: 0,
		},
		{
			desc: "with single packfile",
			setup: func(t *testing.T) string {
				_, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
					SkipCreationViaService: true,
				})

				gittest.WriteCommit(t, cfg, repoPath, gittest.WithBranch("main"))
				gittest.Exec(t, cfg, "-C", repoPath, "repack", "-Ad")

				return repoPath
			},
			expectedPacks: 1,
		},
	} {
		tc := tc

		t.Run(tc.desc, func(t *testing.T) {
			t.Parallel()

			repoPath := tc.setup(t)

			packs, err := packfile.List(filepath.Join(repoPath, "objects"))
			require.NoError(t, err)
			require.Len(t, packs, tc.expectedPacks)
		})
	}
}
