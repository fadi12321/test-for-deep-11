package ref

import (
	"bytes"
	"context"
	"fmt"

	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/catfile"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/lines"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

var localBranchFormatFields = []string{"%(refname)", "%(objectname)"}

func parseRef(ref []byte, length int) ([][]byte, error) {
	elements := bytes.Split(ref, []byte("\x00"))
	if len(elements) != length {
		return nil, fmt.Errorf("error parsing ref %q", ref)
	}
	return elements, nil
}

func buildLocalBranch(name []byte, target *gitalypb.GitCommit) *gitalypb.FindLocalBranchResponse {
	response := &gitalypb.FindLocalBranchResponse{
		Name: name,
	}

	if target == nil {
		return response
	}

	response.Commit = target

	// all code below exists for compatibility and must be removed after
	// https://gitlab.com/gitlab-org/gitlab/issues/205685
	response.CommitId = target.Id
	response.CommitSubject = target.Subject

	if author := target.Author; author != nil {
		response.CommitAuthor = &gitalypb.FindLocalBranchCommitAuthor{
			Name:     author.Name,
			Email:    author.Email,
			Date:     author.Date,
			Timezone: author.Timezone,
		}
	}

	if committer := target.Committer; committer != nil {
		response.CommitCommitter = &gitalypb.FindLocalBranchCommitAuthor{
			Name:     committer.Name,
			Email:    committer.Email,
			Date:     committer.Date,
			Timezone: committer.Timezone,
		}
	}

	return response
}

func buildAllBranchesBranch(ctx context.Context, objectReader catfile.ObjectContentReader, elements [][]byte) (*gitalypb.FindAllBranchesResponse_Branch, error) {
	target, err := catfile.GetCommit(ctx, objectReader, git.Revision(elements[1]))
	if err != nil {
		return nil, err
	}

	return &gitalypb.FindAllBranchesResponse_Branch{
		Name:   elements[0],
		Target: target,
	}, nil
}

func buildBranch(ctx context.Context, objectReader catfile.ObjectContentReader, elements [][]byte) (*gitalypb.Branch, error) {
	target, err := catfile.GetCommit(ctx, objectReader, git.Revision(elements[1]))
	if err != nil {
		return nil, err
	}

	return &gitalypb.Branch{
		Name:         elements[0],
		TargetCommit: target,
	}, nil
}

func newFindLocalBranchesWriter(stream gitalypb.RefService_FindLocalBranchesServer, objectReader catfile.ObjectContentReader) lines.Sender {
	return func(refs [][]byte) error {
		ctx := stream.Context()
		var response *gitalypb.FindLocalBranchesResponse

		var branches []*gitalypb.Branch

		for _, ref := range refs {
			elements, err := parseRef(ref, len(localBranchFormatFields))
			if err != nil {
				return err
			}

			branch, err := buildBranch(ctx, objectReader, elements)
			if err != nil {
				return err
			}

			branches = append(branches, branch)
		}

		response = &gitalypb.FindLocalBranchesResponse{LocalBranches: branches}

		return stream.Send(response)
	}
}

func newFindAllBranchesWriter(stream gitalypb.RefService_FindAllBranchesServer, objectReader catfile.ObjectContentReader) lines.Sender {
	return func(refs [][]byte) error {
		var branches []*gitalypb.FindAllBranchesResponse_Branch
		ctx := stream.Context()

		for _, ref := range refs {
			elements, err := parseRef(ref, len(localBranchFormatFields))
			if err != nil {
				return err
			}
			branch, err := buildAllBranchesBranch(ctx, objectReader, elements)
			if err != nil {
				return err
			}
			branches = append(branches, branch)
		}
		return stream.Send(&gitalypb.FindAllBranchesResponse{Branches: branches})
	}
}

func newFindAllRemoteBranchesWriter(stream gitalypb.RefService_FindAllRemoteBranchesServer, objectReader catfile.ObjectContentReader) lines.Sender {
	return func(refs [][]byte) error {
		var branches []*gitalypb.Branch
		ctx := stream.Context()

		for _, ref := range refs {
			elements, err := parseRef(ref, len(localBranchFormatFields))
			if err != nil {
				return err
			}
			branch, err := buildBranch(ctx, objectReader, elements)
			if err != nil {
				return err
			}
			branches = append(branches, branch)
		}

		return stream.Send(&gitalypb.FindAllRemoteBranchesResponse{Branches: branches})
	}
}
