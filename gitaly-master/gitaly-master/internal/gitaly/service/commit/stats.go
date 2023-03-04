package commit

import (
	"bufio"
	"context"
	"fmt"
	"strconv"
	"strings"

	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

func validateCommitStatsRequest(in *gitalypb.CommitStatsRequest) error {
	if err := service.ValidateRepository(in.GetRepository()); err != nil {
		return err
	}
	if err := git.ValidateRevision(in.Revision); err != nil {
		return err
	}
	return nil
}

func (s *server) CommitStats(ctx context.Context, in *gitalypb.CommitStatsRequest) (*gitalypb.CommitStatsResponse, error) {
	if err := validateCommitStatsRequest(in); err != nil {
		return nil, structerr.NewInvalidArgument("%w", err)
	}

	resp, err := s.commitStats(ctx, in)
	if err != nil {
		return nil, structerr.NewInternal("%w", err)
	}

	return resp, nil
}

func (s *server) commitStats(ctx context.Context, in *gitalypb.CommitStatsRequest) (*gitalypb.CommitStatsResponse, error) {
	repo := s.localrepo(in.GetRepository())

	commit, err := repo.ReadCommit(ctx, git.Revision(in.Revision))
	if err != nil {
		return nil, err
	}
	if commit == nil {
		return nil, fmt.Errorf("commit not found: %q", in.Revision)
	}

	var args []string

	if len(commit.GetParentIds()) == 0 {
		args = append(args, git.ObjectHashSHA1.EmptyTreeOID.String(), commit.Id)
	} else {
		args = append(args, commit.Id+"^", commit.Id)
	}

	cmd, err := repo.Exec(ctx, git.Command{
		Name:  "diff",
		Flags: []git.Option{git.Flag{Name: "--numstat"}},
		Args:  args,
	})
	if err != nil {
		return nil, err
	}

	scanner := bufio.NewScanner(cmd)
	var added, deleted int32

	for scanner.Scan() {
		split := strings.SplitN(scanner.Text(), "\t", 3)
		if len(split) != 3 {
			return nil, fmt.Errorf("invalid numstat line %q", scanner.Text())
		}

		if split[0] == "-" && split[1] == "-" {
			// binary file
			continue
		}

		add64, err := strconv.ParseInt(split[0], 10, 32)
		if err != nil {
			return nil, err
		}

		added += int32(add64)

		del64, err := strconv.ParseInt(split[1], 10, 32)
		if err != nil {
			return nil, err
		}

		deleted += int32(del64)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	if err := cmd.Wait(); err != nil {
		return nil, err
	}

	return &gitalypb.CommitStatsResponse{
		Oid:       commit.Id,
		Additions: added,
		Deletions: deleted,
	}, nil
}