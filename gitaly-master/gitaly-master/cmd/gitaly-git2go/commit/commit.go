//go:build static && system_libgit2

package commit

import (
	"context"
	"encoding/gob"
	"errors"
	"fmt"

	git "github.com/libgit2/git2go/v34"
	"gitlab.com/gitlab-org/gitaly/v15/cmd/gitaly-git2go/git2goutil"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git2go"
)

// Run runs the commit subcommand.
func Run(ctx context.Context, decoder *gob.Decoder, encoder *gob.Encoder) error {
	var params git2go.CommitCommand
	if err := decoder.Decode(&params); err != nil {
		return err
	}

	commitID, err := commit(ctx, params)
	return encoder.Encode(git2go.Result{
		CommitID: commitID,
		Err:      git2go.SerializableError(err),
	})
}

func commit(ctx context.Context, request git2go.CommitCommand) (string, error) {
	repo, err := git2goutil.OpenRepository(request.Repository)
	if err != nil {
		return "", fmt.Errorf("open repository: %w", err)
	}

	index, err := git.NewIndex()
	if err != nil {
		return "", fmt.Errorf("new index: %w", err)
	}

	var parents []*git.Commit
	if request.Parent != "" {
		parentOID, err := git.NewOid(request.Parent)
		if err != nil {
			return "", fmt.Errorf("parse base commit oid: %w", err)
		}

		baseCommit, err := repo.LookupCommit(parentOID)
		if err != nil {
			return "", fmt.Errorf("lookup commit: %w", err)
		}

		parents = []*git.Commit{baseCommit}

		baseTree, err := baseCommit.Tree()
		if err != nil {
			return "", fmt.Errorf("lookup tree: %w", err)
		}

		if err := index.ReadTree(baseTree); err != nil {
			return "", fmt.Errorf("read tree: %w", err)
		}
	}

	for _, action := range request.Actions {
		if err := apply(action, repo, index); err != nil {
			if git.IsErrorClass(err, git.ErrorClassIndex) {
				err = git2go.UnknownIndexError(err.Error())
			}

			return "", fmt.Errorf("apply action %T: %w", action, err)
		}
	}

	treeOID, err := index.WriteTreeTo(repo)
	if err != nil {
		return "", fmt.Errorf("write tree: %w", err)
	}
	tree, err := repo.LookupTree(treeOID)
	if err != nil {
		return "", fmt.Errorf("lookup tree: %w", err)
	}

	author := git.Signature(request.Author)
	committer := git.Signature(request.Committer)
	commitID, err := git2goutil.NewCommitSubmitter(repo, request.SigningKey).
		Commit(&author, &committer, git.MessageEncodingUTF8, request.Message, tree, parents...)
	if err != nil {
		if git.IsErrorClass(err, git.ErrorClassInvalid) {
			return "", git2go.InvalidArgumentError(err.Error())
		}

		return "", fmt.Errorf("create commit: %w", err)
	}

	return commitID.String(), nil
}

func apply(action git2go.Action, repo *git.Repository, index *git.Index) error {
	switch action := action.(type) {
	case git2go.ChangeFileMode:
		return applyChangeFileMode(action, index)
	case git2go.CreateDirectory:
		return applyCreateDirectory(action, repo, index)
	case git2go.CreateFile:
		return applyCreateFile(action, index)
	case git2go.DeleteFile:
		return applyDeleteFile(action, index)
	case git2go.MoveFile:
		return applyMoveFile(action, index)
	case git2go.UpdateFile:
		return applyUpdateFile(action, index)
	default:
		return errors.New("unsupported action")
	}
}
