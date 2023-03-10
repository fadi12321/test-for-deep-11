package hook

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"os"
	"strings"
	"syscall"

	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sirupsen/logrus"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/pktline"
	gitalyhook "gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/hook"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/metadata/featureflag"
	"gitlab.com/gitlab-org/gitaly/v15/internal/stream"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/protobuf/encoding/protojson"
)

var (
	packObjectsServedBytes = promauto.NewCounter(prometheus.CounterOpts{
		Name: "gitaly_pack_objects_served_bytes_total",
		Help: "Number of bytes of git-pack-objects data served to clients",
	})
	packObjectsCacheLookups = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gitaly_pack_objects_cache_lookups_total",
		Help: "Number of lookups in the PackObjectsHook cache, divided by hit/miss",
	}, []string{"result"})
	packObjectsGeneratedBytes = promauto.NewCounter(prometheus.CounterOpts{
		Name: "gitaly_pack_objects_generated_bytes_total",
		Help: "Number of bytes generated in PackObjectsHook by running git-pack-objects",
	})
)

func (s *server) packObjectsHook(ctx context.Context, req *gitalypb.PackObjectsHookWithSidechannelRequest, args *packObjectsArgs, stdinReader io.Reader, output io.Writer) error {
	data, err := protojson.Marshal(req)
	if err != nil {
		return err
	}

	h := sha256.New()
	if _, err := h.Write(data); err != nil {
		return err
	}

	stdin, err := bufferStdin(stdinReader, h)
	if err != nil {
		return err
	}

	// We do not know yet who has to close stdin. In case of a cache hit, it
	// is us. In case of a cache miss, a separate goroutine will run
	// git-pack-objects, and that goroutine may outlive the current request.
	// In that case, that separate goroutine will be responsible for closing
	// stdin.
	closeStdin := true
	defer func() {
		if closeStdin {
			stdin.Close()
		}
	}()

	key := hex.EncodeToString(h.Sum(nil))

	r, created, err := s.packObjectsCache.FindOrCreate(key, func(w io.Writer) error {
		if featureflag.PackObjectsLimitingRepo.IsEnabled(ctx) {
			return s.runPackObjectsLimited(
				ctx,
				w,
				req.GetRepository().GetStorageName()+":"+req.GetRepository().GetRelativePath(),
				req,
				args,
				stdin,
				key,
			)
		}

		if featureflag.PackObjectsLimitingUser.IsEnabled(ctx) && req.GetGlId() != "" {
			return s.runPackObjectsLimited(
				ctx,
				w,
				req.GetGlId(),
				req,
				args,
				stdin,
				key,
			)
		}

		return s.runPackObjects(ctx, w, req, args, stdin, key)
	})
	if err != nil {
		return err
	}
	defer r.Close()

	if created {
		closeStdin = false
		packObjectsCacheLookups.WithLabelValues("miss").Inc()
	} else {
		packObjectsCacheLookups.WithLabelValues("hit").Inc()
	}

	var servedBytes int64
	defer func() {
		ctxlogrus.Extract(ctx).WithFields(logrus.Fields{
			"cache_key": key,
			"bytes":     servedBytes,
		}).Info("served bytes")
		packObjectsServedBytes.Add(float64(servedBytes))
	}()

	servedBytes, err = io.Copy(output, r)
	if err != nil {
		return err
	}

	return r.Wait(ctx)
}

func (s *server) runPackObjects(
	ctx context.Context,
	w io.Writer,
	req *gitalypb.PackObjectsHookWithSidechannelRequest,
	args *packObjectsArgs,
	stdin io.ReadCloser,
	key string,
) error {
	// We want to keep the context for logging, but we want to block all its
	// cancellation signals (deadline, cancel etc.). This is because of
	// the following scenario. Imagine client1 calls PackObjectsHook and
	// causes runPackObjects to run in a goroutine. Now suppose that client2
	// calls PackObjectsHook with the same arguments and stdin, so it joins
	// client1 in waiting for this goroutine. Now client1 hangs up before the
	// runPackObjects goroutine is done.
	//
	// If the cancellation of client1 propagated into the runPackObjects
	// goroutine this would affect client2. We don't want that. So to prevent
	// that, we suppress the cancellation of the originating context.
	ctx = helper.SuppressCancellation(ctx)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	defer stdin.Close()

	return s.runPackObjectsFn(ctx, s.gitCmdFactory, w, req, args, stdin, key, s.concurrencyTracker)
}

func (s *server) runPackObjectsLimited(
	ctx context.Context,
	w io.Writer,
	limitkey string,
	req *gitalypb.PackObjectsHookWithSidechannelRequest,
	args *packObjectsArgs,
	stdin io.ReadCloser,
	key string,
) error {
	ctx = helper.SuppressCancellation(ctx)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	defer stdin.Close()

	if _, err := s.packObjectsLimiter.Limit(
		ctx,
		limitkey,
		func() (interface{}, error) {
			return nil,
				s.runPackObjectsFn(
					ctx,
					s.gitCmdFactory,
					w,
					req,
					args,
					stdin,
					key,
					s.concurrencyTracker,
				)
		},
	); err != nil {
		return err
	}

	return nil
}

func runPackObjects(
	ctx context.Context,
	gitCmdFactory git.CommandFactory,
	w io.Writer,
	req *gitalypb.PackObjectsHookWithSidechannelRequest,
	args *packObjectsArgs,
	stdin io.Reader,
	key string,
	concurrencyTracker *gitalyhook.ConcurrencyTracker,
) error {
	repo := req.GetRepository()

	if concurrencyTracker != nil {
		finishRepoLog := concurrencyTracker.LogConcurrency(ctx, "repository", repo.GetRelativePath())
		defer finishRepoLog()

		userID := req.GetGlId()

		if userID == "" {
			userID = "none"
		}

		finishUserLog := concurrencyTracker.LogConcurrency(ctx, "user_id", userID)
		defer finishUserLog()
	}

	counter := &helper.CountingWriter{W: w}
	sw := pktline.NewSidebandWriter(counter)
	stdout := bufio.NewWriterSize(sw.Writer(stream.BandStdout), pktline.MaxSidebandData)
	stderrBuf := &bytes.Buffer{}
	stderr := io.MultiWriter(sw.Writer(stream.BandStderr), stderrBuf)

	defer func() {
		packObjectsGeneratedBytes.Add(float64(counter.N))
		logger := ctxlogrus.Extract(ctx)
		logger.WithFields(logrus.Fields{
			"cache_key": key,
			"bytes":     counter.N,
		}).Info("generated bytes")

		if total := totalMessage(stderrBuf.Bytes()); total != "" {
			logger.WithField("pack.stat", total).Info("pack file compression statistic")
		}
	}()

	cmd, err := gitCmdFactory.New(ctx, repo, args.subcmd(),
		git.WithStdin(stdin),
		git.WithStdout(stdout),
		git.WithStderr(stderr),
		git.WithGlobalOption(args.globals()...),
	)
	if err != nil {
		return err
	}
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("git-pack-objects: stderr: %q err: %w", stderrBuf.String(), err)
	}
	if err := stdout.Flush(); err != nil {
		return fmt.Errorf("flush stdout: %w", err)
	}
	return nil
}

func totalMessage(stderr []byte) string {
	start := bytes.Index(stderr, []byte("Total "))
	if start < 0 {
		return ""
	}

	end := bytes.Index(stderr[start:], []byte("\n"))
	if end < 0 {
		return ""
	}

	return string(stderr[start : start+end])
}

var (
	errNoPackObjects = errors.New("missing pack-objects")
	errNonFlagArg    = errors.New("non-flag argument")
	errNoStdout      = errors.New("missing --stdout")
)

func parsePackObjectsArgs(args []string) (*packObjectsArgs, error) {
	result := &packObjectsArgs{}

	// Check for special argument used with shallow clone:
	// https://gitlab.com/gitlab-org/git/-/blob/v2.30.0/upload-pack.c#L287-290
	if len(args) >= 2 && args[0] == "--shallow-file" && args[1] == "" {
		result.shallowFile = true
		args = args[2:]
	}

	if len(args) < 1 || args[0] != "pack-objects" {
		return nil, errNoPackObjects
	}
	args = args[1:]

	// There should always be "--stdout" somewhere. Git-pack-objects can
	// write to a file too but we don't want that in this RPC.
	// https://gitlab.com/gitlab-org/git/-/blob/v2.30.0/upload-pack.c#L296
	seenStdout := false
	for _, a := range args {
		if !strings.HasPrefix(a, "-") {
			return nil, errNonFlagArg
		}
		if a == "--stdout" {
			seenStdout = true
		} else {
			result.flags = append(result.flags, a)
		}
	}

	if !seenStdout {
		return nil, errNoStdout
	}

	return result, nil
}

type packObjectsArgs struct {
	shallowFile bool
	flags       []string
}

func (p *packObjectsArgs) globals() []git.GlobalOption {
	var globals []git.GlobalOption
	if p.shallowFile {
		globals = append(globals, git.ValueFlag{Name: "--shallow-file", Value: ""})
	}
	return globals
}

func (p *packObjectsArgs) subcmd() git.Command {
	sc := git.Command{
		Name:  "pack-objects",
		Flags: []git.Option{git.Flag{Name: "--stdout"}},
	}
	for _, f := range p.flags {
		sc.Flags = append(sc.Flags, git.Flag{Name: f})
	}
	return sc
}

func bufferStdin(r io.Reader, h hash.Hash) (_ io.ReadCloser, err error) {
	f, err := os.CreateTemp("", "PackObjectsHook-stdin")
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			f.Close()
		}
	}()

	if err := os.Remove(f.Name()); err != nil {
		return nil, err
	}

	_, err = io.Copy(f, io.TeeReader(r, h))
	if err != nil {
		return nil, err
	}

	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}

	return f, nil
}

func (s *server) PackObjectsHookWithSidechannel(ctx context.Context, req *gitalypb.PackObjectsHookWithSidechannelRequest) (*gitalypb.PackObjectsHookWithSidechannelResponse, error) {
	if err := service.ValidateRepository(req.GetRepository()); err != nil {
		return nil, structerr.NewInvalidArgument("%w", err)
	}

	args, err := parsePackObjectsArgs(req.Args)
	if err != nil {
		return nil, structerr.NewInvalidArgument("invalid pack-objects command: %v: %w", req.Args, err)
	}

	c, err := gitalyhook.GetSidechannel(ctx)
	if err != nil {
		if errors.As(err, &gitalyhook.ErrInvalidSidechannelAddress{}) {
			return nil, structerr.NewInvalidArgument("%w", err)
		}
		return nil, structerr.NewInternal("get side-channel: %w", err)
	}
	defer c.Close()

	if err := s.packObjectsHook(ctx, req, args, c, c); err != nil {
		if errors.Is(err, syscall.EPIPE) {
			// EPIPE is the error we get if we try to write to c after the client has
			// closed its side of the connection. By convention, we label server side
			// errors caused by the client disconnecting with the Canceled gRPC code.
			err = structerr.NewCanceled("%w", err)
		}
		return nil, structerr.NewInternal("pack objects hook: %w", err)
	}

	if err := c.Close(); err != nil {
		return nil, structerr.NewInternal("close side-channel: %w", err)
	}

	return &gitalypb.PackObjectsHookWithSidechannelResponse{}, nil
}
