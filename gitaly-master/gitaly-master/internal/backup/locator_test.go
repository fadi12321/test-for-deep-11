//go:build !gitaly_test_sha256

package backup

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/perm"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
)

func TestLegacyLocator(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t)

	repo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
		RelativePath:           t.Name(),
	})
	l := LegacyLocator{}

	t.Run("Begin/Commit Full", func(t *testing.T) {
		t.Parallel()

		expected := &Step{
			SkippableOnNotFound: true,
			BundlePath:          repo.RelativePath + ".bundle",
			RefPath:             repo.RelativePath + ".refs",
			CustomHooksPath:     filepath.Join(repo.RelativePath, "custom_hooks.tar"),
		}

		full := l.BeginFull(ctx, repo, "abc123")
		assert.Equal(t, expected, full)

		require.NoError(t, l.Commit(ctx, full))
	})

	t.Run("FindLatest", func(t *testing.T) {
		t.Parallel()

		expected := &Backup{
			Steps: []Step{
				{
					SkippableOnNotFound: true,
					BundlePath:          repo.RelativePath + ".bundle",
					RefPath:             repo.RelativePath + ".refs",
					CustomHooksPath:     filepath.Join(repo.RelativePath, "custom_hooks.tar"),
				},
			},
		}

		full, err := l.FindLatest(ctx, repo)
		require.NoError(t, err)

		assert.Equal(t, expected, full)
	})
}

func TestPointerLocator(t *testing.T) {
	t.Parallel()

	const backupID = "abc123"

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t)

	repo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
		RelativePath:           t.Name(),
	})

	t.Run("Begin/Commit full", func(t *testing.T) {
		t.Parallel()

		backupPath := testhelper.TempDir(t)
		var l Locator = PointerLocator{
			Sink: NewFilesystemSink(backupPath),
		}

		const expectedIncrement = "001"
		expected := &Step{
			BundlePath:      filepath.Join(repo.RelativePath, backupID, expectedIncrement+".bundle"),
			RefPath:         filepath.Join(repo.RelativePath, backupID, expectedIncrement+".refs"),
			CustomHooksPath: filepath.Join(repo.RelativePath, backupID, expectedIncrement+".custom_hooks.tar"),
		}

		full := l.BeginFull(ctx, repo, backupID)
		assert.Equal(t, expected, full)

		require.NoError(t, l.Commit(ctx, full))

		backupPointer := testhelper.MustReadFile(t, filepath.Join(backupPath, repo.RelativePath, "LATEST"))
		require.Equal(t, backupID, string(backupPointer))

		incrementPointer := testhelper.MustReadFile(t, filepath.Join(backupPath, repo.RelativePath, backupID, "LATEST"))
		require.Equal(t, expectedIncrement, string(incrementPointer))
	})

	t.Run("Begin/Commit incremental", func(t *testing.T) {
		t.Parallel()

		const fallbackBackupID = "fallback123"

		for _, tc := range []struct {
			desc             string
			setup            func(tb testing.TB, ctx context.Context, sink Sink)
			expectedBackupID string
			expectedOffset   int
		}{
			{
				desc:             "no previous backup",
				expectedBackupID: fallbackBackupID,
			},
			{
				desc:             "with previous backup",
				expectedBackupID: "abc123",
				expectedOffset:   1,
				setup: func(tb testing.TB, ctx context.Context, sink Sink) {
					require.NoError(tb, sink.Write(ctx, filepath.Join(repo.RelativePath, "LATEST"), strings.NewReader("abc123")))
					require.NoError(tb, sink.Write(ctx, filepath.Join(repo.RelativePath, "abc123", "LATEST"), strings.NewReader("001")))
				},
			},
		} {
			tc := tc

			t.Run(tc.desc, func(t *testing.T) {
				t.Parallel()

				backupPath := testhelper.TempDir(t)
				sink := NewFilesystemSink(backupPath)
				var l Locator = PointerLocator{Sink: sink}

				if tc.setup != nil {
					tc.setup(t, ctx, sink)
				}

				var expected *Step
				for i := 1; i <= 3; i++ {
					incrementID := i + tc.expectedOffset
					var previousRefPath string
					if incrementID > 1 {
						previousRefPath = filepath.Join(repo.RelativePath, tc.expectedBackupID, fmt.Sprintf("%03d.refs", incrementID-1))
					}
					expectedIncrement := fmt.Sprintf("%03d", incrementID)
					expected = &Step{
						BundlePath:      filepath.Join(repo.RelativePath, tc.expectedBackupID, expectedIncrement+".bundle"),
						RefPath:         filepath.Join(repo.RelativePath, tc.expectedBackupID, expectedIncrement+".refs"),
						PreviousRefPath: previousRefPath,
						CustomHooksPath: filepath.Join(repo.RelativePath, tc.expectedBackupID, expectedIncrement+".custom_hooks.tar"),
					}

					step, err := l.BeginIncremental(ctx, repo, fallbackBackupID)
					require.NoError(t, err)
					require.Equal(t, expected, step)

					require.NoError(t, l.Commit(ctx, step))

					backupPointer := testhelper.MustReadFile(t, filepath.Join(backupPath, repo.RelativePath, "LATEST"))
					require.Equal(t, tc.expectedBackupID, string(backupPointer))

					incrementPointer := testhelper.MustReadFile(t, filepath.Join(backupPath, repo.RelativePath, tc.expectedBackupID, "LATEST"))
					require.Equal(t, expectedIncrement, string(incrementPointer))
				}
			})
		}
	})

	t.Run("FindLatest", func(t *testing.T) {
		t.Parallel()

		t.Run("no fallback", func(t *testing.T) {
			t.Parallel()

			backupPath := testhelper.TempDir(t)
			var l Locator = PointerLocator{
				Sink: NewFilesystemSink(backupPath),
			}

			_, err := l.FindLatest(ctx, repo)
			require.ErrorIs(t, err, ErrDoesntExist)

			require.NoError(t, os.MkdirAll(filepath.Join(backupPath, repo.RelativePath, backupID), perm.SharedDir))
			require.NoError(t, os.WriteFile(filepath.Join(backupPath, repo.RelativePath, "LATEST"), []byte(backupID), perm.SharedFile))
			require.NoError(t, os.WriteFile(filepath.Join(backupPath, repo.RelativePath, backupID, "LATEST"), []byte("003"), perm.SharedFile))
			expected := &Backup{
				Steps: []Step{
					{
						BundlePath:      filepath.Join(repo.RelativePath, backupID, "001.bundle"),
						RefPath:         filepath.Join(repo.RelativePath, backupID, "001.refs"),
						CustomHooksPath: filepath.Join(repo.RelativePath, backupID, "001.custom_hooks.tar"),
					},
					{
						BundlePath:      filepath.Join(repo.RelativePath, backupID, "002.bundle"),
						RefPath:         filepath.Join(repo.RelativePath, backupID, "002.refs"),
						PreviousRefPath: filepath.Join(repo.RelativePath, backupID, "001.refs"),
						CustomHooksPath: filepath.Join(repo.RelativePath, backupID, "002.custom_hooks.tar"),
					},
					{
						BundlePath:      filepath.Join(repo.RelativePath, backupID, "003.bundle"),
						RefPath:         filepath.Join(repo.RelativePath, backupID, "003.refs"),
						PreviousRefPath: filepath.Join(repo.RelativePath, backupID, "002.refs"),
						CustomHooksPath: filepath.Join(repo.RelativePath, backupID, "003.custom_hooks.tar"),
					},
				},
			}

			full, err := l.FindLatest(ctx, repo)
			require.NoError(t, err)
			require.Equal(t, expected, full)
		})

		t.Run("fallback", func(t *testing.T) {
			t.Parallel()

			backupPath := testhelper.TempDir(t)
			var l Locator = PointerLocator{
				Sink:     NewFilesystemSink(backupPath),
				Fallback: LegacyLocator{},
			}

			expectedFallback := &Backup{
				Steps: []Step{
					{
						SkippableOnNotFound: true,
						BundlePath:          repo.RelativePath + ".bundle",
						RefPath:             repo.RelativePath + ".refs",
						CustomHooksPath:     filepath.Join(repo.RelativePath, "custom_hooks.tar"),
					},
				},
			}

			fallbackFull, err := l.FindLatest(ctx, repo)
			require.NoError(t, err)
			require.Equal(t, expectedFallback, fallbackFull)

			require.NoError(t, os.MkdirAll(filepath.Join(backupPath, repo.RelativePath, backupID), perm.SharedDir))
			require.NoError(t, os.WriteFile(filepath.Join(backupPath, repo.RelativePath, "LATEST"), []byte(backupID), perm.SharedFile))
			require.NoError(t, os.WriteFile(filepath.Join(backupPath, repo.RelativePath, backupID, "LATEST"), []byte("001"), perm.SharedFile))
			expected := &Backup{
				Steps: []Step{
					{
						BundlePath:      filepath.Join(repo.RelativePath, backupID, "001.bundle"),
						RefPath:         filepath.Join(repo.RelativePath, backupID, "001.refs"),
						CustomHooksPath: filepath.Join(repo.RelativePath, backupID, "001.custom_hooks.tar"),
					},
				},
			}

			full, err := l.FindLatest(ctx, repo)
			require.NoError(t, err)
			require.Equal(t, expected, full)
		})

		t.Run("invalid backup LATEST", func(t *testing.T) {
			t.Parallel()

			backupPath := testhelper.TempDir(t)
			var l Locator = PointerLocator{
				Sink: NewFilesystemSink(backupPath),
			}

			_, err := l.FindLatest(ctx, repo)
			require.ErrorIs(t, err, ErrDoesntExist)

			require.NoError(t, os.MkdirAll(filepath.Join(backupPath, repo.RelativePath), perm.SharedDir))
			require.NoError(t, os.WriteFile(filepath.Join(backupPath, repo.RelativePath, "LATEST"), []byte("invalid"), perm.SharedFile))
			_, err = l.FindLatest(ctx, repo)
			require.EqualError(t, err, "pointer locator: find latest: find: find latest ID: filesystem sink: get reader for \"TestPointerLocator/invalid/LATEST\": doesn't exist")
		})

		t.Run("invalid incremental LATEST", func(t *testing.T) {
			t.Parallel()

			backupPath := testhelper.TempDir(t)
			var l Locator = PointerLocator{
				Sink: NewFilesystemSink(backupPath),
			}

			_, err := l.FindLatest(ctx, repo)
			require.ErrorIs(t, err, ErrDoesntExist)

			require.NoError(t, os.MkdirAll(filepath.Join(backupPath, repo.RelativePath, backupID), perm.SharedDir))
			require.NoError(t, os.WriteFile(filepath.Join(backupPath, repo.RelativePath, "LATEST"), []byte(backupID), perm.SharedFile))
			require.NoError(t, os.WriteFile(filepath.Join(backupPath, repo.RelativePath, backupID, "LATEST"), []byte("invalid"), perm.SharedFile))

			_, err = l.FindLatest(ctx, repo)
			require.EqualError(t, err, "pointer locator: find latest: find: determine increment ID: strconv.Atoi: parsing \"invalid\": invalid syntax")
		})
	})
}
