package commit

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

func (s *server) CountCommits(ctx context.Context, in *gitalypb.CountCommitsRequest) (*gitalypb.CountCommitsResponse, error) {
	if err := validateCountCommitsRequest(in); err != nil {
		return nil, structerr.NewInvalidArgument("%w", err)
	}

	subCmd := git.Command{Name: "rev-list", Flags: []git.Option{git.Flag{Name: "--count"}}}

	if in.GetAll() {
		subCmd.Flags = append(subCmd.Flags, git.Flag{Name: "--all"})
	} else {
		subCmd.Args = []string{string(in.GetRevision())}
	}

	if before := in.GetBefore(); before != nil {
		subCmd.Flags = append(subCmd.Flags, git.Flag{Name: "--before=" + timestampToRFC3339(before.Seconds)})
	}
	if after := in.GetAfter(); after != nil {
		subCmd.Flags = append(subCmd.Flags, git.Flag{Name: "--after=" + timestampToRFC3339(after.Seconds)})
	}
	if maxCount := in.GetMaxCount(); maxCount != 0 {
		subCmd.Flags = append(subCmd.Flags, git.Flag{Name: fmt.Sprintf("--max-count=%d", maxCount)})
	}
	if in.GetFirstParent() {
		subCmd.Flags = append(subCmd.Flags, git.Flag{Name: "--first-parent"})
	}
	if path := in.GetPath(); path != nil {
		subCmd.PostSepArgs = []string{string(path)}
	}

	opts := git.ConvertGlobalOptions(in.GetGlobalOptions())
	cmd, err := s.gitCmdFactory.New(ctx, in.Repository, subCmd, opts...)
	if err != nil {
		return nil, structerr.NewInternal("cmd: %w", err)
	}

	var count int64
	countStr, readAllErr := io.ReadAll(cmd)
	if readAllErr != nil {
		ctxlogrus.Extract(ctx).WithError(err).Info("ignoring git rev-list error")
	}

	if err := cmd.Wait(); err != nil {
		ctxlogrus.Extract(ctx).WithError(err).Info("ignoring git rev-list error")
		count = 0
	} else if readAllErr == nil {
		var err error
		countStr = bytes.TrimSpace(countStr)
		count, err = strconv.ParseInt(string(countStr), 10, 0)

		if err != nil {
			return nil, structerr.NewInternal("parse count: %w", err)
		}
	}

	return &gitalypb.CountCommitsResponse{Count: int32(count)}, nil
}

func validateCountCommitsRequest(in *gitalypb.CountCommitsRequest) error {
	if err := service.ValidateRepository(in.GetRepository()); err != nil {
		return err
	}

	if err := git.ValidateRevisionAllowEmpty(in.Revision); err != nil {
		return err
	}

	if len(in.GetRevision()) == 0 && !in.GetAll() {
		return fmt.Errorf("empty Revision and false All")
	}

	return nil
}

func timestampToRFC3339(ts int64) string {
	return time.Unix(ts, 0).Format(time.RFC3339)
}
