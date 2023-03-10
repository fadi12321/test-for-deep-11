//go:build !gitaly_test_sha256

package git2go

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
)

func TestMain(m *testing.M) {
	testhelper.Run(m)
}

type commit struct {
	Parent    git.ObjectID
	Author    Signature
	Committer Signature
	Message   string
}

func TestExecutor_Commit(t *testing.T) {
	const (
		DefaultMode    = "100644"
		ExecutableMode = "100755"
	)

	type step struct {
		actions     []Action
		error       error
		treeEntries []gittest.TreeEntry
	}
	ctx := testhelper.Context(t)

	cfg := testcfg.Build(t)
	testcfg.BuildGitalyGit2Go(t, cfg)

	repoProto, repoPath := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
	})

	repo := localrepo.NewTestRepo(t, cfg, repoProto)

	originalFile, err := repo.WriteBlob(ctx, "file", bytes.NewBufferString("original"))
	require.NoError(t, err)

	updatedFile, err := repo.WriteBlob(ctx, "file", bytes.NewBufferString("updated"))
	require.NoError(t, err)

	executor := NewExecutor(cfg, gittest.NewCommandFactory(t, cfg), config.NewLocator(cfg))

	for _, tc := range []struct {
		desc          string
		steps         []step
		signAndVerify bool
	}{
		{
			desc: "create directory",
			steps: []step{
				{
					actions: []Action{
						CreateDirectory{Path: "directory"},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "directory/.gitkeep"},
					},
				},
			},
		},
		{
			desc: "create directory created duplicate",
			steps: []step{
				{
					actions: []Action{
						CreateDirectory{Path: "directory"},
						CreateDirectory{Path: "directory"},
					},
					error: IndexError{Type: ErrDirectoryExists, Path: "directory"},
				},
			},
		},
		{
			desc: "create directory existing duplicate",
			steps: []step{
				{
					actions: []Action{
						CreateDirectory{Path: "directory"},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "directory/.gitkeep"},
					},
				},
				{
					actions: []Action{
						CreateDirectory{Path: "directory"},
					},
					error: IndexError{Type: ErrDirectoryExists, Path: "directory"},
				},
			},
		},
		{
			desc: "create directory with a files name",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file", OID: originalFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "file", Content: "original"},
					},
				},
				{
					actions: []Action{
						CreateDirectory{Path: "file"},
					},
					error: IndexError{Type: ErrFileExists, Path: "file"},
				},
			},
		},
		{
			desc: "create file",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file", OID: originalFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "file", Content: "original"},
					},
				},
			},
		},
		{
			desc: "create duplicate file",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file", OID: originalFile.String()},
						CreateFile{Path: "file", OID: updatedFile.String()},
					},
					error: IndexError{Type: ErrFileExists, Path: "file"},
				},
			},
		},
		{
			desc: "create file overwrites directory",
			steps: []step{
				{
					actions: []Action{
						CreateDirectory{Path: "directory"},
						CreateFile{Path: "directory", OID: originalFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "directory", Content: "original"},
					},
				},
			},
		},
		{
			desc: "update created file",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file", OID: originalFile.String()},
						UpdateFile{Path: "file", OID: updatedFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "file", Content: "updated"},
					},
				},
			},
		},
		{
			desc: "update existing file",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file", OID: originalFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "file", Content: "original"},
					},
				},
				{
					actions: []Action{
						UpdateFile{Path: "file", OID: updatedFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "file", Content: "updated"},
					},
				},
			},
		},
		{
			desc: "update non-existing file",
			steps: []step{
				{
					actions: []Action{
						UpdateFile{Path: "non-existing", OID: updatedFile.String()},
					},
					error: IndexError{Type: ErrFileNotFound, Path: "non-existing"},
				},
			},
		},
		{
			desc: "move created file",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "original-file", OID: originalFile.String()},
						MoveFile{Path: "original-file", NewPath: "moved-file", OID: originalFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "moved-file", Content: "original"},
					},
				},
			},
		},
		{
			desc: "moving directory fails",
			steps: []step{
				{
					actions: []Action{
						CreateDirectory{Path: "directory"},
						MoveFile{Path: "directory", NewPath: "moved-directory"},
					},
					error: IndexError{Type: ErrFileNotFound, Path: "directory"},
				},
			},
		},
		{
			desc: "move file inferring content",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "original-file", OID: originalFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "original-file", Content: "original"},
					},
				},
				{
					actions: []Action{
						MoveFile{Path: "original-file", NewPath: "moved-file"},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "moved-file", Content: "original"},
					},
				},
			},
		},
		{
			desc: "move file with non-existing source",
			steps: []step{
				{
					actions: []Action{
						MoveFile{Path: "non-existing", NewPath: "destination-file"},
					},
					error: IndexError{Type: ErrFileNotFound, Path: "non-existing"},
				},
			},
		},
		{
			desc: "move file with already existing destination file",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "source-file", OID: originalFile.String()},
						CreateFile{Path: "already-existing", OID: updatedFile.String()},
						MoveFile{Path: "source-file", NewPath: "already-existing"},
					},
					error: IndexError{Type: ErrFileExists, Path: "already-existing"},
				},
			},
		},
		{
			// seems like a bug in the original implementation to allow overwriting a
			// directory
			desc: "move file with already existing destination directory",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file", OID: originalFile.String()},
						CreateDirectory{Path: "already-existing"},
						MoveFile{Path: "file", NewPath: "already-existing"},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "already-existing", Content: "original"},
					},
				},
			},
		},
		{
			desc: "move file providing content",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "original-file", OID: originalFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "original-file", Content: "original"},
					},
				},
				{
					actions: []Action{
						MoveFile{Path: "original-file", NewPath: "moved-file", OID: updatedFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "moved-file", Content: "updated"},
					},
				},
			},
		},
		{
			desc: "mark non-existing file executable",
			steps: []step{
				{
					actions: []Action{
						ChangeFileMode{Path: "non-existing"},
					},
					error: IndexError{Type: ErrFileNotFound, Path: "non-existing"},
				},
			},
		},
		{
			desc: "mark executable file executable",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file-1", OID: originalFile.String()},
						ChangeFileMode{Path: "file-1", ExecutableMode: true},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: ExecutableMode, Path: "file-1", Content: "original"},
					},
				},
				{
					actions: []Action{
						ChangeFileMode{Path: "file-1", ExecutableMode: true},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: ExecutableMode, Path: "file-1", Content: "original"},
					},
				},
			},
		},
		{
			desc: "mark created file executable",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file-1", OID: originalFile.String()},
						ChangeFileMode{Path: "file-1", ExecutableMode: true},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: ExecutableMode, Path: "file-1", Content: "original"},
					},
				},
			},
		},
		{
			desc: "mark existing file executable",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file-1", OID: originalFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "file-1", Content: "original"},
					},
				},
				{
					actions: []Action{
						ChangeFileMode{Path: "file-1", ExecutableMode: true},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: ExecutableMode, Path: "file-1", Content: "original"},
					},
				},
			},
		},
		{
			desc: "move non-existing file",
			steps: []step{
				{
					actions: []Action{
						MoveFile{Path: "non-existing", NewPath: "destination"},
					},
					error: IndexError{Type: ErrFileNotFound, Path: "non-existing"},
				},
			},
		},
		{
			desc: "move doesn't overwrite a file",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file-1", OID: originalFile.String()},
						CreateFile{Path: "file-2", OID: updatedFile.String()},
						MoveFile{Path: "file-1", NewPath: "file-2"},
					},
					error: IndexError{Type: ErrFileExists, Path: "file-2"},
				},
			},
		},
		{
			desc: "delete non-existing file",
			steps: []step{
				{
					actions: []Action{
						DeleteFile{Path: "non-existing"},
					},
					error: IndexError{Type: ErrFileNotFound, Path: "non-existing"},
				},
			},
		},
		{
			desc: "delete created file",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file-1", OID: originalFile.String()},
						DeleteFile{Path: "file-1"},
					},
				},
			},
		},
		{
			desc: "delete existing file",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file-1", OID: originalFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "file-1", Content: "original"},
					},
				},
				{
					actions: []Action{
						DeleteFile{Path: "file-1"},
					},
				},
			},
		},
		{
			desc: "update created file, sign commit and verify signature",
			steps: []step{
				{
					actions: []Action{
						CreateFile{Path: "file", OID: originalFile.String()},
						UpdateFile{Path: "file", OID: updatedFile.String()},
					},
					treeEntries: []gittest.TreeEntry{
						{Mode: DefaultMode, Path: "file", Content: "updated"},
					},
				},
			},
			signAndVerify: true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			author := NewSignature("Author Name", "author.email@example.com", time.Now())
			committer := NewSignature("Committer Name", "committer.email@example.com", time.Now())

			if tc.signAndVerify {
				executor.signingKey = testhelper.SigningKeyPath
			}

			var parentCommit git.ObjectID
			for i, step := range tc.steps {
				message := fmt.Sprintf("commit %d", i+1)
				commitID, err := executor.Commit(ctx, repo, CommitCommand{
					Repository: repoPath,
					Author:     author,
					Committer:  committer,
					Message:    message,
					Parent:     parentCommit.String(),
					Actions:    step.actions,
				})

				if step.error != nil {
					require.True(t, errors.Is(err, step.error), "expected: %q, actual: %q", step.error, err)
					continue
				} else {
					require.NoError(t, err)
				}

				require.Equal(t, commit{
					Parent:    parentCommit,
					Author:    author,
					Committer: committer,
					Message:   message,
				}, getCommit(t, ctx, repo, commitID, tc.signAndVerify))

				gittest.RequireTree(t, cfg, repoPath, commitID.String(), step.treeEntries)
				parentCommit = commitID
			}
		})
	}
}

func getCommit(tb testing.TB, ctx context.Context, repo *localrepo.Repo, oid git.ObjectID, verifySignature bool) commit {
	tb.Helper()

	data, err := repo.ReadObject(ctx, oid)
	require.NoError(tb, err)

	var (
		gpgsig, dataWithoutGpgSig string
		gpgsigStarted             bool
	)

	var commit commit
	lines := strings.Split(string(data), "\n")
	for i, line := range lines {
		if line == "" {
			commit.Message = strings.Join(lines[i+1:], "\n")
			dataWithoutGpgSig += "\n" + commit.Message
			break
		}

		if gpgsigStarted && strings.HasPrefix(line, " ") {
			gpgsig += strings.TrimSpace(line) + "\n"
			continue
		}

		split := strings.SplitN(line, " ", 2)
		require.Len(tb, split, 2, "invalid commit: %q", data)

		field, value := split[0], split[1]

		if field != "gpgsig" {
			dataWithoutGpgSig += line + "\n"
		}

		switch field {
		case "parent":
			require.Empty(tb, commit.Parent, "multi parent parsing not implemented")
			commit.Parent = git.ObjectID(value)
		case "author":
			require.Empty(tb, commit.Author, "commit contained multiple authors")
			commit.Author = unmarshalSignature(tb, value)
		case "committer":
			require.Empty(tb, commit.Committer, "commit contained multiple committers")
			commit.Committer = unmarshalSignature(tb, value)
		case "gpgsig":
			gpgsig = value + "\n"
			gpgsigStarted = true
		default:
		}
	}

	if gpgsig != "" || verifySignature {
		file, err := os.Open("testdata/publicKey.gpg")
		require.NoError(tb, err)

		keyring, err := openpgp.ReadKeyRing(file)
		require.NoError(tb, err)

		_, err = openpgp.CheckArmoredDetachedSignature(
			keyring,
			strings.NewReader(dataWithoutGpgSig),
			strings.NewReader(gpgsig),
			&packet.Config{},
		)
		require.NoError(tb, err)
	}

	return commit
}

func unmarshalSignature(tb testing.TB, data string) Signature {
	tb.Helper()

	// Format: NAME <EMAIL> DATE_UNIX DATE_TIMEZONE
	split1 := strings.Split(data, " <")
	require.Len(tb, split1, 2, "invalid signature: %q", data)

	split2 := strings.Split(split1[1], "> ")
	require.Len(tb, split2, 2, "invalid signature: %q", data)

	split3 := strings.Split(split2[1], " ")
	require.Len(tb, split3, 2, "invalid signature: %q", data)

	timestamp, err := strconv.ParseInt(split3[0], 10, 64)
	require.NoError(tb, err)

	return Signature{
		Name:  split1[0],
		Email: split2[0],
		When:  time.Unix(timestamp, 0),
	}
}
