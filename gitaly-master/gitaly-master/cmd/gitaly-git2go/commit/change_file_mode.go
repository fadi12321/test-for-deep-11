//go:build static && system_libgit2

package commit

import (
	git "github.com/libgit2/git2go/v34"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git2go"
)

func applyChangeFileMode(action git2go.ChangeFileMode, index *git.Index) error {
	entry, err := index.EntryByPath(action.Path, 0)
	if err != nil {
		if git.IsErrorCode(err, git.ErrorCodeNotFound) {
			return git2go.IndexError{Type: git2go.ErrFileNotFound, Path: action.Path}
		}

		return err
	}

	mode := git.FilemodeBlob
	if action.ExecutableMode {
		mode = git.FilemodeBlobExecutable
	}

	return index.Add(&git.IndexEntry{
		Path: action.Path,
		Mode: mode,
		Id:   entry.Id,
	})
}
