package diff

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/chunk"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/protobuf/proto"
)

const (
	numStatDelimiter = 0
)

// changedPathsRequestToString converts the given FindChangedPathsRequest to a string that can be passed to git-diff-tree(1). Note
// that this function expects that all revisions have already been resolved to their respective object IDs.
func changedPathsRequestToString(r *gitalypb.FindChangedPathsRequest_Request) (string, error) {
	switch t := r.GetType().(type) {
	case *gitalypb.FindChangedPathsRequest_Request_CommitRequest_:
		return strings.Join(append([]string{t.CommitRequest.GetCommitRevision()}, t.CommitRequest.GetParentCommitRevisions()...), " "), nil
	case *gitalypb.FindChangedPathsRequest_Request_TreeRequest_:
		return t.TreeRequest.GetLeftTreeRevision() + " " + t.TreeRequest.GetRightTreeRevision(), nil
	}

	// This shouldn't happen
	return "", fmt.Errorf("unknown FindChangedPathsRequest type")
}

func (s *server) FindChangedPaths(in *gitalypb.FindChangedPathsRequest, stream gitalypb.DiffService_FindChangedPathsServer) error {
	if err := s.validateFindChangedPathsRequestParams(stream.Context(), in); err != nil {
		return err
	}

	diffChunker := chunk.New(&findChangedPathsSender{stream: stream})

	requests := make([]string, len(in.GetRequests()))
	for i, request := range in.GetRequests() {
		str, err := changedPathsRequestToString(request)
		if err != nil {
			return err
		}
		requests[i] = str
	}

	cmd, err := s.gitCmdFactory.New(stream.Context(), in.Repository, git.Command{
		Name: "diff-tree",
		Flags: []git.Option{
			git.Flag{Name: "-z"},
			git.Flag{Name: "--stdin"},
			git.Flag{Name: "-m"},
			git.Flag{Name: "-r"},
			git.Flag{Name: "--no-renames"},
			git.Flag{Name: "--no-commit-id"},
			git.Flag{Name: "--diff-filter=AMDTC"},
		},
	}, git.WithStdin(strings.NewReader(strings.Join(requests, "\n")+"\n")))
	if err != nil {
		return structerr.NewInternal("cmd err: %w", err)
	}

	if err := parsePaths(bufio.NewReader(cmd), diffChunker); err != nil {
		return fmt.Errorf("parsing err: %w", err)
	}

	if err := cmd.Wait(); err != nil {
		return structerr.NewUnavailable("cmd wait err: %w", err)
	}

	return diffChunker.Flush()
}

func parsePaths(reader *bufio.Reader, chunker *chunk.Chunker) error {
	for {
		path, err := nextPath(reader)
		if err != nil {
			if err == io.EOF {
				break
			}

			return fmt.Errorf("next path err: %w", err)
		}

		if err := chunker.Send(path); err != nil {
			return fmt.Errorf("err sending to chunker: %v", err)
		}
	}

	return nil
}

func nextPath(reader *bufio.Reader) (*gitalypb.ChangedPaths, error) {
	_, err := reader.ReadBytes(':')
	if err != nil {
		return nil, err
	}

	line, err := reader.ReadBytes(numStatDelimiter)
	if err != nil {
		return nil, err
	}
	split := bytes.Split(line[:len(line)-1], []byte(" "))
	if len(split) != 5 || len(split[4]) != 1 {
		return nil, fmt.Errorf("git diff-tree parsing failed on: %v", line)
	}

	oldMode, err := strconv.ParseInt(string(split[0]), 8, 32)
	if err != nil {
		return nil, fmt.Errorf("parsing old mode: %w", err)
	}

	newMode, err := strconv.ParseInt(string(split[1]), 8, 32)
	if err != nil {
		return nil, fmt.Errorf("parsing new mode: %w", err)
	}

	pathStatus := split[4]

	path, err := reader.ReadBytes(numStatDelimiter)
	if err != nil {
		return nil, err
	}

	statusTypeMap := map[string]gitalypb.ChangedPaths_Status{
		"M": gitalypb.ChangedPaths_MODIFIED,
		"D": gitalypb.ChangedPaths_DELETED,
		"T": gitalypb.ChangedPaths_TYPE_CHANGE,
		"C": gitalypb.ChangedPaths_COPIED,
		"A": gitalypb.ChangedPaths_ADDED,
	}

	parsedPath, ok := statusTypeMap[string(pathStatus)]
	if !ok {
		return nil, structerr.NewInternal("unknown changed paths returned: %v", string(pathStatus))
	}

	changedPath := &gitalypb.ChangedPaths{
		Status:  parsedPath,
		Path:    path[:len(path)-1],
		OldMode: int32(oldMode),
		NewMode: int32(newMode),
	}

	return changedPath, nil
}

// This sender implements the interface in the chunker class
type findChangedPathsSender struct {
	paths  []*gitalypb.ChangedPaths
	stream gitalypb.DiffService_FindChangedPathsServer
}

func (t *findChangedPathsSender) Reset() {
	t.paths = nil
}

func (t *findChangedPathsSender) Append(m proto.Message) {
	t.paths = append(t.paths, m.(*gitalypb.ChangedPaths))
}

func (t *findChangedPathsSender) Send() error {
	return t.stream.Send(&gitalypb.FindChangedPathsResponse{
		Paths: t.paths,
	})
}

func resolveObjectWithType(ctx context.Context, repo *localrepo.Repo, revision string, expectedType string) (git.ObjectID, error) {
	if revision == "" {
		return "", structerr.NewInvalidArgument("revision cannot be empty")
	}

	oid, err := repo.ResolveRevision(ctx, git.Revision(fmt.Sprintf("%s^{%s}", revision, expectedType)))
	if err != nil {
		if errors.Is(err, git.ErrReferenceNotFound) {
			return "", structerr.NewNotFound("revision can not be found: %q", revision)
		}
		return "", err
	}

	return oid, nil
}

func (s *server) validateFindChangedPathsRequestParams(ctx context.Context, in *gitalypb.FindChangedPathsRequest) error {
	repository := in.GetRepository()
	if err := service.ValidateRepository(repository); err != nil {
		return structerr.NewInvalidArgument("%w", err)
	}
	if _, err := s.locator.GetRepoPath(repository); err != nil {
		return err
	}

	gitRepo := s.localrepo(repository)

	if len(in.GetCommits()) > 0 { //nolint:staticcheck
		if len(in.GetRequests()) > 0 {
			return structerr.NewInvalidArgument("cannot specify both commits and requests")
		}

		in.Requests = make([]*gitalypb.FindChangedPathsRequest_Request, len(in.GetCommits())) //nolint:staticcheck
		for i, commit := range in.GetCommits() {                                              //nolint:staticcheck
			in.Requests[i] = &gitalypb.FindChangedPathsRequest_Request{
				Type: &gitalypb.FindChangedPathsRequest_Request_CommitRequest_{
					CommitRequest: &gitalypb.FindChangedPathsRequest_Request_CommitRequest{
						CommitRevision: commit,
					},
				},
			}
		}
	}

	for _, request := range in.GetRequests() {
		switch t := request.Type.(type) {
		case *gitalypb.FindChangedPathsRequest_Request_CommitRequest_:
			oid, err := resolveObjectWithType(ctx, gitRepo, t.CommitRequest.GetCommitRevision(), "commit")
			if err != nil {
				return structerr.NewInternal("resolving commit: %w", err)
			}
			t.CommitRequest.CommitRevision = oid.String()

			for i, commit := range t.CommitRequest.GetParentCommitRevisions() {
				oid, err := resolveObjectWithType(ctx, gitRepo, commit, "commit")
				if err != nil {
					return structerr.NewInternal("resolving commit parent: %w", err)
				}
				t.CommitRequest.ParentCommitRevisions[i] = oid.String()
			}
		case *gitalypb.FindChangedPathsRequest_Request_TreeRequest_:
			oid, err := resolveObjectWithType(ctx, gitRepo, t.TreeRequest.GetLeftTreeRevision(), "tree")
			if err != nil {
				return structerr.NewInternal("resolving left tree: %w", err)
			}
			t.TreeRequest.LeftTreeRevision = oid.String()

			oid, err = resolveObjectWithType(ctx, gitRepo, t.TreeRequest.GetRightTreeRevision(), "tree")
			if err != nil {
				return structerr.NewInternal("resolving right tree: %w", err)
			}
			t.TreeRequest.RightTreeRevision = oid.String()
		}
	}

	return nil
}
