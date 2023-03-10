//go:build static && system_libgit2

package commit

import (
	"os"

	git "github.com/libgit2/git2go/v34"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git2go"
)

func validateFileExists(index *git.Index, path string) error {
	if _, err := index.Find(path); err != nil {
		if git.IsErrorCode(err, git.ErrorCodeNotFound) {
			return git2go.IndexError{Type: git2go.ErrFileNotFound, Path: path}
		}

		return err
	}

	return nil
}

func validateFileDoesNotExist(index *git.Index, path string) error {
	_, err := index.Find(path)
	if err == nil {
		return git2go.IndexError{Type: git2go.ErrFileExists, Path: path}
	}

	if !git.IsErrorCode(err, git.ErrorCodeNotFound) {
		return err
	}

	return nil
}

func validateDirectoryDoesNotExist(index *git.Index, path string) error {
	_, err := index.FindPrefix(path + string(os.PathSeparator))
	if err == nil {
		return git2go.IndexError{Type: git2go.ErrDirectoryExists, Path: path}
	}

	if !git.IsErrorCode(err, git.ErrorCodeNotFound) {
		return err
	}

	return nil
}
