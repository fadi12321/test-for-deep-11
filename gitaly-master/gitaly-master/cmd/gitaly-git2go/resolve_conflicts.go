//go:build static && system_libgit2

package main

import (
	"bytes"
	"context"
	"encoding/gob"
	"errors"
	"flag"
	"fmt"
	"strings"
	"time"

	git "github.com/libgit2/git2go/v34"
	"gitlab.com/gitlab-org/gitaly/v15/cmd/gitaly-git2go/git2goutil"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/conflict"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git2go"
)

type resolveSubcommand struct{}

func (cmd *resolveSubcommand) Flags() *flag.FlagSet {
	return flag.NewFlagSet("resolve", flag.ExitOnError)
}

func (cmd resolveSubcommand) Run(_ context.Context, decoder *gob.Decoder, encoder *gob.Encoder) error {
	var request git2go.ResolveCommand
	if err := decoder.Decode(&request); err != nil {
		return err
	}

	if request.AuthorDate.IsZero() {
		request.AuthorDate = time.Now()
	}

	repo, err := git2goutil.OpenRepository(request.Repository)
	if err != nil {
		return fmt.Errorf("could not open repository: %w", err)
	}

	ours, err := lookupCommit(repo, request.Ours)
	if err != nil {
		return fmt.Errorf("ours commit lookup: %w", err)
	}

	theirs, err := lookupCommit(repo, request.Theirs)
	if err != nil {
		return fmt.Errorf("theirs commit lookup: %w", err)
	}

	index, err := repo.MergeCommits(ours, theirs, nil)
	if err != nil {
		return fmt.Errorf("could not merge commits: %w", err)
	}

	ci, err := index.ConflictIterator()
	if err != nil {
		return err
	}

	type paths struct {
		theirs, ours string
	}
	conflicts := map[paths]git.IndexConflict{}

	for {
		c, err := ci.Next()
		if git.IsErrorCode(err, git.ErrorCodeIterOver) {
			break
		}
		if err != nil {
			return err
		}

		if c.Our.Path == "" || c.Their.Path == "" {
			return errors.New("conflict side missing")
		}

		k := paths{
			theirs: c.Their.Path,
			ours:   c.Our.Path,
		}
		conflicts[k] = c
	}

	odb, err := repo.Odb()
	if err != nil {
		return err
	}

	for _, r := range request.Resolutions {
		c, ok := conflicts[paths{
			theirs: r.OldPath,
			ours:   r.NewPath,
		}]
		if !ok {
			// Note: this emulates the Ruby error that occurs when
			// there are no conflicts for a resolution
			return errors.New("NoMethodError: undefined method `resolve_lines' for nil:NilClass")
		}

		switch {
		case c.Our == nil:
			return fmt.Errorf("missing our-part of merge file input for new path %q", r.NewPath)
		case c.Their == nil:
			return fmt.Errorf("missing their-part of merge file input for new path %q", r.NewPath)
		}

		ancestor, our, their, err := readConflictEntries(odb, c)
		if err != nil {
			return fmt.Errorf("read conflict entries: %w", err)
		}

		mfr, err := mergeFileResult(ancestor, our, their)
		if err != nil {
			return fmt.Errorf("merge file result for %q: %w", r.NewPath, err)
		}

		if r.Content != "" && bytes.Equal([]byte(r.Content), mfr.Contents) {
			return fmt.Errorf("Resolved content has no changes for file %s", r.NewPath) //nolint
		}

		conflictFile, err := conflict.Parse(
			bytes.NewReader(mfr.Contents),
			ancestor,
			our,
			their,
		)
		if err != nil {
			return fmt.Errorf("parse conflict for %q: %w", c.Our.Path, err)
		}

		resolvedBlob, err := conflictFile.Resolve(r)
		if err != nil {
			return err // do not decorate this error to satisfy old test
		}

		resolvedBlobOID, err := odb.Write(resolvedBlob, git.ObjectBlob)
		if err != nil {
			return fmt.Errorf("write object for %q: %w", c.Ancestor.Path, err)
		}

		ourResolvedEntry := *c.Our // copy by value
		ourResolvedEntry.Id = resolvedBlobOID
		if err := index.Add(&ourResolvedEntry); err != nil {
			return fmt.Errorf("add index for %q: %w", c.Ancestor.Path, err)
		}

		if err := index.RemoveConflict(ourResolvedEntry.Path); err != nil {
			return fmt.Errorf("remove conflict from index for %q: %w", c.Ancestor.Path, err)
		}
	}

	if index.HasConflicts() {
		ci, err := index.ConflictIterator()
		if err != nil {
			return fmt.Errorf("iterating unresolved conflicts: %w", err)
		}

		var conflictPaths []string
		for {
			c, err := ci.Next()
			if git.IsErrorCode(err, git.ErrorCodeIterOver) {
				break
			}
			if err != nil {
				return fmt.Errorf("next unresolved conflict: %w", err)
			}
			var conflictingPath string
			if c.Ancestor != nil {
				conflictingPath = c.Ancestor.Path
			} else {
				conflictingPath = c.Our.Path
			}

			conflictPaths = append(conflictPaths, conflictingPath)
		}

		return fmt.Errorf("Missing resolutions for the following files: %s", strings.Join(conflictPaths, ", ")) //nolint
	}

	treeOID, err := index.WriteTreeTo(repo)
	if err != nil {
		return fmt.Errorf("write tree to repo: %w", err)
	}
	tree, err := repo.LookupTree(treeOID)
	if err != nil {
		return fmt.Errorf("lookup tree: %w", err)
	}

	sign := git2go.NewSignature(request.AuthorName, request.AuthorMail, request.AuthorDate)
	committer := &git.Signature{
		Name:  sign.Name,
		Email: sign.Email,
		When:  request.AuthorDate,
	}

	commitID, err := git2goutil.NewCommitSubmitter(repo, request.SigningKey).
		Commit(committer, committer, git.MessageEncodingUTF8, request.Message, tree, ours, theirs)
	if err != nil {
		return fmt.Errorf("create commit: %w", err)
	}

	response := git2go.ResolveResult{
		MergeResult: git2go.MergeResult{
			CommitID: commitID.String(),
		},
	}

	return encoder.Encode(response)
}

func readConflictEntries(odb *git.Odb, c git.IndexConflict) (*conflict.Entry, *conflict.Entry, *conflict.Entry, error) {
	var ancestor, our, their *conflict.Entry

	for _, part := range []struct {
		entry  *git.IndexEntry
		result **conflict.Entry
	}{
		{entry: c.Ancestor, result: &ancestor},
		{entry: c.Our, result: &our},
		{entry: c.Their, result: &their},
	} {
		if part.entry == nil {
			continue
		}

		blob, err := odb.Read(part.entry.Id)
		if err != nil {
			return nil, nil, nil, err
		}

		data := blob.Data()
		contents := make([]byte, len(data))
		copy(contents, data)

		*part.result = &conflict.Entry{
			Path:     part.entry.Path,
			Mode:     uint(part.entry.Mode),
			Contents: contents,
		}
	}

	return ancestor, our, their, nil
}

func mergeFileResult(ancestor, our, their *conflict.Entry) (*git.MergeFileResult, error) {
	mfr, err := git.MergeFile(
		conflictEntryToMergeFileInput(ancestor),
		conflictEntryToMergeFileInput(our),
		conflictEntryToMergeFileInput(their),
		nil,
	)
	if err != nil {
		return nil, err
	}

	return mfr, nil
}

func conflictEntryToMergeFileInput(e *conflict.Entry) git.MergeFileInput {
	if e == nil {
		return git.MergeFileInput{}
	}

	return git.MergeFileInput{
		Path:     e.Path,
		Mode:     e.Mode,
		Contents: e.Contents,
	}
}
