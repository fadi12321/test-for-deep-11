package backup

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"

	"gitlab.com/gitlab-org/gitaly/v15/client"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/storage"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/chunk"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"gitlab.com/gitlab-org/gitaly/v15/streamio"
	"gocloud.dev/blob/azureblob"
	"gocloud.dev/blob/gcsblob"
	"gocloud.dev/blob/s3blob"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
)

var (
	// ErrSkipped means the repository was skipped because there was nothing to backup
	ErrSkipped = errors.New("repository skipped")
	// ErrDoesntExist means that the data was not found.
	ErrDoesntExist = errors.New("doesn't exist")
)

// errEmptyBundle means that the requested bundle contained nothing
var errEmptyBundle = errors.New("empty bundle")

// Sink is an abstraction over the real storage used for storing/restoring backups.
type Sink interface {
	// Write saves all the data from the r by relativePath.
	Write(ctx context.Context, relativePath string, r io.Reader) error
	// GetReader returns a reader that servers the data stored by relativePath.
	// If relativePath doesn't exists the ErrDoesntExist will be returned.
	GetReader(ctx context.Context, relativePath string) (io.ReadCloser, error)
}

// Backup represents all the information needed to restore a backup for a repository
type Backup struct {
	// Steps are the ordered list of steps required to restore this backup
	Steps []Step
}

// Step represents an incremental step that makes up a complete backup for a repository
type Step struct {
	// BundlePath is the path of the bundle
	BundlePath string
	// SkippableOnNotFound defines if the bundle can be skipped when it does
	// not exist. This allows us to maintain legacy behaviour where we always
	// check a specific location for a bundle without knowing if it exists.
	SkippableOnNotFound bool
	// RefPath is the path of the ref file
	RefPath string
	// PreviousRefPath is the path of the previous ref file
	PreviousRefPath string
	// CustomHooksPath is the path of the custom hooks archive
	CustomHooksPath string
}

// Locator finds sink backup paths for repositories
type Locator interface {
	// BeginFull returns a tentative first step needed to create a new full backup.
	BeginFull(ctx context.Context, repo *gitalypb.Repository, backupID string) *Step

	// BeginIncremental returns a tentative step needed to create a new incremental backup.
	BeginIncremental(ctx context.Context, repo *gitalypb.Repository, backupID string) (*Step, error)

	// Commit persists the step so that it can be looked up by FindLatest
	Commit(ctx context.Context, step *Step) error

	// FindLatest returns the latest backup that was written by Commit
	FindLatest(ctx context.Context, repo *gitalypb.Repository) (*Backup, error)
}

// ResolveSink returns a sink implementation based on the provided path.
func ResolveSink(ctx context.Context, path string) (Sink, error) {
	parsed, err := url.Parse(path)
	if err != nil {
		return nil, err
	}
	scheme := parsed.Scheme
	if i := strings.LastIndex(scheme, "+"); i > 0 {
		// the url may include additional configuration options like service name
		// we don't include it into the scheme definition as it will push us to create
		// a full set of variations. Instead we trim it up to the service option only.
		scheme = scheme[i+1:]
	}

	switch scheme {
	case s3blob.Scheme, azureblob.Scheme, gcsblob.Scheme:
		sink, err := NewStorageServiceSink(ctx, path)
		return sink, err
	default:
		return NewFilesystemSink(path), nil
	}
}

// ResolveLocator returns a locator implementation based on a locator identifier.
func ResolveLocator(layout string, sink Sink) (Locator, error) {
	legacy := LegacyLocator{}
	switch layout {
	case "legacy":
		return legacy, nil
	case "pointer":
		return PointerLocator{
			Sink:     sink,
			Fallback: legacy,
		}, nil
	default:
		return nil, fmt.Errorf("unknown layout: %q", layout)
	}
}

// Manager manages process of the creating/restoring backups.
type Manager struct {
	sink    Sink
	conns   *client.Pool
	locator Locator

	// backupID allows setting the same full backup ID for every repository at
	// once. We may use this to make it easier to specify a backup to restore
	// from, rather than always selecting the latest.
	backupID string
}

// NewManager creates and returns initialized *Manager instance.
func NewManager(sink Sink, locator Locator, pool *client.Pool, backupID string) *Manager {
	return &Manager{
		sink:     sink,
		conns:    pool,
		locator:  locator,
		backupID: backupID,
	}
}

// RemoveAllRepositoriesRequest is the request to remove all repositories in the specified
// storage name.
type RemoveAllRepositoriesRequest struct {
	Server      storage.ServerInfo
	StorageName string
}

// RemoveAllRepositories removes all repositories in the specified storage name.
func (mgr *Manager) RemoveAllRepositories(ctx context.Context, req *RemoveAllRepositoriesRequest) error {
	if err := setContextServerInfo(ctx, &req.Server, req.StorageName); err != nil {
		return fmt.Errorf("manager: %w", err)
	}

	repoClient, err := mgr.newRepoClient(ctx, req.Server)
	if err != nil {
		return fmt.Errorf("manager: %w", err)
	}

	_, err = repoClient.RemoveAll(ctx, &gitalypb.RemoveAllRequest{StorageName: req.StorageName})
	if err != nil {
		return fmt.Errorf("manager: %w", err)
	}

	return nil
}

// CreateRequest is the request to create a backup
type CreateRequest struct {
	Server      storage.ServerInfo
	Repository  *gitalypb.Repository
	Incremental bool
}

// Create creates a repository backup.
func (mgr *Manager) Create(ctx context.Context, req *CreateRequest) error {
	if err := setContextServerInfo(ctx, &req.Server, req.Repository.GetStorageName()); err != nil {
		return fmt.Errorf("manager: %w", err)
	}

	if isEmpty, err := mgr.isEmpty(ctx, req.Server, req.Repository); err != nil {
		return fmt.Errorf("manager: %w", err)
	} else if isEmpty {
		return fmt.Errorf("manager: repository empty: %w", ErrSkipped)
	}

	var step *Step
	if req.Incremental {
		var err error
		step, err = mgr.locator.BeginIncremental(ctx, req.Repository, mgr.backupID)
		if err != nil {
			return fmt.Errorf("manager: %w", err)
		}
	} else {
		step = mgr.locator.BeginFull(ctx, req.Repository, mgr.backupID)
	}

	refs, err := mgr.listRefs(ctx, req.Server, req.Repository)
	if err != nil {
		return fmt.Errorf("manager: %w", err)
	}
	if err := mgr.writeRefs(ctx, step.RefPath, refs); err != nil {
		return fmt.Errorf("manager: %w", err)
	}
	if err := mgr.writeBundle(ctx, step, req.Server, req.Repository, refs); err != nil {
		return fmt.Errorf("manager: write bundle: %w", err)
	}
	if err := mgr.writeCustomHooks(ctx, step.CustomHooksPath, req.Server, req.Repository); err != nil {
		return fmt.Errorf("manager: write custom hooks: %w", err)
	}

	if err := mgr.locator.Commit(ctx, step); err != nil {
		return fmt.Errorf("manager: %w", err)
	}

	return nil
}

// RestoreRequest is the request to restore from a backup
type RestoreRequest struct {
	Server       storage.ServerInfo
	Repository   *gitalypb.Repository
	AlwaysCreate bool
}

// Restore restores a repository from a backup.
func (mgr *Manager) Restore(ctx context.Context, req *RestoreRequest) error {
	if err := setContextServerInfo(ctx, &req.Server, req.Repository.GetStorageName()); err != nil {
		return fmt.Errorf("manager: %w", err)
	}

	if err := mgr.removeRepository(ctx, req.Server, req.Repository); err != nil {
		return fmt.Errorf("manager: %w", err)
	}

	backup, err := mgr.locator.FindLatest(ctx, req.Repository)
	if err != nil {
		return fmt.Errorf("manager: %w", err)
	}

	if err := mgr.createRepository(ctx, req.Server, req.Repository); err != nil {
		return fmt.Errorf("manager: %w", err)
	}

	for _, step := range backup.Steps {
		if err := mgr.restoreBundle(ctx, step.BundlePath, req.Server, req.Repository); err != nil {
			if step.SkippableOnNotFound && errors.Is(err, ErrDoesntExist) {
				// For compatibility with existing backups we need to make sure the
				// repository exists even if there's no bundle for project
				// repositories (not wiki or snippet repositories).  Gitaly does
				// not know which repository is which type so here we accept a
				// parameter to tell us to employ this behaviour. Since the
				// repository has already been created, we simply skip cleaning up.
				if req.AlwaysCreate {
					return nil
				}

				if err := mgr.removeRepository(ctx, req.Server, req.Repository); err != nil {
					return fmt.Errorf("manager: remove on skipped: %w", err)
				}

				return fmt.Errorf("manager: %w: %s", ErrSkipped, err.Error())
			}
		}
		if err := mgr.restoreCustomHooks(ctx, step.CustomHooksPath, req.Server, req.Repository); err != nil {
			return fmt.Errorf("manager: %w", err)
		}
	}
	return nil
}

// setContextServerInfo overwrites server with gitaly connection info from ctx metadata when server is zero.
func setContextServerInfo(ctx context.Context, server *storage.ServerInfo, storageName string) error {
	if !server.Zero() {
		return nil
	}

	var err error
	*server, err = storage.ExtractGitalyServer(ctx, storageName)
	return err
}

func (mgr *Manager) isEmpty(ctx context.Context, server storage.ServerInfo, repo *gitalypb.Repository) (bool, error) {
	repoClient, err := mgr.newRepoClient(ctx, server)
	if err != nil {
		return false, fmt.Errorf("isEmpty: %w", err)
	}
	hasLocalBranches, err := repoClient.HasLocalBranches(ctx, &gitalypb.HasLocalBranchesRequest{Repository: repo})
	switch {
	case status.Code(err) == codes.NotFound:
		return true, nil
	case err != nil:
		return false, fmt.Errorf("isEmpty: %w", err)
	}
	return !hasLocalBranches.GetValue(), nil
}

func (mgr *Manager) removeRepository(ctx context.Context, server storage.ServerInfo, repo *gitalypb.Repository) error {
	repoClient, err := mgr.newRepoClient(ctx, server)
	if err != nil {
		return fmt.Errorf("remove repository: %w", err)
	}
	_, err = repoClient.RemoveRepository(ctx, &gitalypb.RemoveRepositoryRequest{Repository: repo})
	switch {
	case status.Code(err) == codes.NotFound:
		return nil
	case err != nil:
		return fmt.Errorf("remove repository: %w", err)
	}
	return nil
}

func (mgr *Manager) createRepository(ctx context.Context, server storage.ServerInfo, repo *gitalypb.Repository) error {
	repoClient, err := mgr.newRepoClient(ctx, server)
	if err != nil {
		return fmt.Errorf("create repository: %w", err)
	}
	if _, err := repoClient.CreateRepository(ctx, &gitalypb.CreateRepositoryRequest{Repository: repo}); err != nil {
		return fmt.Errorf("create repository: %w", err)
	}
	return nil
}

func (mgr *Manager) writeBundle(ctx context.Context, step *Step, server storage.ServerInfo, repo *gitalypb.Repository, refs []*gitalypb.ListRefsResponse_Reference) error {
	repoClient, err := mgr.newRepoClient(ctx, server)
	if err != nil {
		return err
	}
	stream, err := repoClient.CreateBundleFromRefList(ctx)
	if err != nil {
		return err
	}
	c := chunk.New(&createBundleFromRefListSender{
		stream: stream,
	})
	if err := mgr.sendKnownRefs(ctx, step, repo, c); err != nil {
		return err
	}
	for _, ref := range refs {
		if err := c.Send(&gitalypb.CreateBundleFromRefListRequest{
			Repository: repo,
			Patterns:   [][]byte{ref.GetName()},
		}); err != nil {
			return err
		}
	}
	if err := c.Flush(); err != nil {
		return err
	}
	if err := stream.CloseSend(); err != nil {
		return err
	}
	bundle := streamio.NewReader(func() ([]byte, error) {
		resp, err := stream.Recv()
		if structerr.GRPCCode(err) == codes.FailedPrecondition {
			err = errEmptyBundle
		}
		return resp.GetData(), err
	})

	if err := LazyWrite(ctx, mgr.sink, step.BundlePath, bundle); err != nil {
		if errors.Is(err, errEmptyBundle) {
			return fmt.Errorf("%T write: %w: no changes to bundle", mgr.sink, ErrSkipped)
		}
		return fmt.Errorf("%T write: %w", mgr.sink, err)
	}
	return nil
}

// sendKnownRefs sends the negated targets of each ref that had previously been
// backed up. This ensures that git-bundle stops traversing commits once it
// finds the commits that were previously backed up.
func (mgr *Manager) sendKnownRefs(ctx context.Context, step *Step, repo *gitalypb.Repository, c *chunk.Chunker) error {
	if len(step.PreviousRefPath) == 0 {
		return nil
	}

	reader, err := mgr.sink.GetReader(ctx, step.PreviousRefPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	d := git.NewShowRefDecoder(reader)
	for {
		var ref git.Reference

		if err := d.Decode(&ref); err == io.EOF {
			break
		} else if err != nil {
			return err
		}

		if err := c.Send(&gitalypb.CreateBundleFromRefListRequest{
			Repository: repo,
			Patterns:   [][]byte{[]byte("^" + ref.Target)},
		}); err != nil {
			return err
		}
	}

	return nil
}

type createBundleFromRefListSender struct {
	stream gitalypb.RepositoryService_CreateBundleFromRefListClient
	chunk  gitalypb.CreateBundleFromRefListRequest
}

// Reset should create a fresh response message.
func (s *createBundleFromRefListSender) Reset() {
	s.chunk = gitalypb.CreateBundleFromRefListRequest{}
}

// Append should append the given item to the slice in the current response message
func (s *createBundleFromRefListSender) Append(msg proto.Message) {
	req := msg.(*gitalypb.CreateBundleFromRefListRequest)
	s.chunk.Repository = req.GetRepository()
	s.chunk.Patterns = append(s.chunk.Patterns, req.Patterns...)
}

// Send should send the current response message
func (s *createBundleFromRefListSender) Send() error {
	return s.stream.Send(&s.chunk)
}

func (mgr *Manager) restoreBundle(ctx context.Context, path string, server storage.ServerInfo, repo *gitalypb.Repository) error {
	reader, err := mgr.sink.GetReader(ctx, path)
	if err != nil {
		return fmt.Errorf("restore bundle: %w", err)
	}
	defer reader.Close()

	repoClient, err := mgr.newRepoClient(ctx, server)
	if err != nil {
		return fmt.Errorf("restore bundle: %q: %w", path, err)
	}
	stream, err := repoClient.FetchBundle(ctx)
	if err != nil {
		return fmt.Errorf("restore bundle: %q: %w", path, err)
	}
	request := &gitalypb.FetchBundleRequest{Repository: repo, UpdateHead: true}
	bundle := streamio.NewWriter(func(p []byte) error {
		request.Data = p
		if err := stream.Send(request); err != nil {
			return err
		}

		// Only set `Repository` on the first `Send` of the stream
		request = &gitalypb.FetchBundleRequest{}

		return nil
	})
	if _, err := io.Copy(bundle, reader); err != nil {
		return fmt.Errorf("restore bundle: %q: %w", path, err)
	}
	if _, err = stream.CloseAndRecv(); err != nil {
		return fmt.Errorf("restore bundle: %q: %w", path, err)
	}
	return nil
}

func (mgr *Manager) writeCustomHooks(ctx context.Context, path string, server storage.ServerInfo, repo *gitalypb.Repository) error {
	repoClient, err := mgr.newRepoClient(ctx, server)
	if err != nil {
		return err
	}
	stream, err := repoClient.GetCustomHooks(ctx, &gitalypb.GetCustomHooksRequest{Repository: repo})
	if err != nil {
		return err
	}
	hooks := streamio.NewReader(func() ([]byte, error) {
		resp, err := stream.Recv()
		return resp.GetData(), err
	})
	if err := LazyWrite(ctx, mgr.sink, path, hooks); err != nil {
		return fmt.Errorf("%T write: %w", mgr.sink, err)
	}
	return nil
}

func (mgr *Manager) restoreCustomHooks(ctx context.Context, path string, server storage.ServerInfo, repo *gitalypb.Repository) error {
	reader, err := mgr.sink.GetReader(ctx, path)
	if err != nil {
		if errors.Is(err, ErrDoesntExist) {
			return nil
		}
		return fmt.Errorf("restore custom hooks: %w", err)
	}
	defer reader.Close()

	repoClient, err := mgr.newRepoClient(ctx, server)
	if err != nil {
		return fmt.Errorf("restore custom hooks, %q: %w", path, err)
	}
	stream, err := repoClient.SetCustomHooks(ctx)
	if err != nil {
		return fmt.Errorf("restore custom hooks, %q: %w", path, err)
	}

	request := &gitalypb.SetCustomHooksRequest{Repository: repo}
	bundle := streamio.NewWriter(func(p []byte) error {
		request.Data = p
		if err := stream.Send(request); err != nil {
			return err
		}

		// Only set `Repository` on the first `Send` of the stream
		request = &gitalypb.SetCustomHooksRequest{}

		return nil
	})
	if _, err := io.Copy(bundle, reader); err != nil {
		return fmt.Errorf("restore custom hooks, %q: %w", path, err)
	}
	if _, err = stream.CloseAndRecv(); err != nil {
		return fmt.Errorf("restore custom hooks, %q: %w", path, err)
	}
	return nil
}

// listRefs fetches the full set of refs and targets for the repository
func (mgr *Manager) listRefs(ctx context.Context, server storage.ServerInfo, repo *gitalypb.Repository) ([]*gitalypb.ListRefsResponse_Reference, error) {
	refClient, err := mgr.newRefClient(ctx, server)
	if err != nil {
		return nil, fmt.Errorf("list refs: %w", err)
	}
	stream, err := refClient.ListRefs(ctx, &gitalypb.ListRefsRequest{
		Repository: repo,
		Head:       true,
		Patterns:   [][]byte{[]byte("refs/")},
	})
	if err != nil {
		return nil, fmt.Errorf("list refs: %w", err)
	}

	var refs []*gitalypb.ListRefsResponse_Reference

	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			break
		} else if err != nil {
			return nil, fmt.Errorf("list refs: %w", err)
		}
		refs = append(refs, resp.GetReferences()...)
	}

	return refs, nil
}

// writeRefs writes the previously fetched list of refs in the same output
// format as `git-show-ref(1)`
func (mgr *Manager) writeRefs(ctx context.Context, path string, refs []*gitalypb.ListRefsResponse_Reference) error {
	r, w := io.Pipe()
	go func() {
		var err error
		defer func() {
			_ = w.CloseWithError(err) // io.PipeWriter.Close* does not return an error
		}()
		for _, ref := range refs {
			_, err = fmt.Fprintf(w, "%s %s\n", ref.GetTarget(), ref.GetName())
			if err != nil {
				return
			}
		}
	}()

	err := mgr.sink.Write(ctx, path, r)
	if err != nil {
		return fmt.Errorf("write refs: %w", err)
	}

	return nil
}

func (mgr *Manager) newRepoClient(ctx context.Context, server storage.ServerInfo) (gitalypb.RepositoryServiceClient, error) {
	conn, err := mgr.conns.Dial(ctx, server.Address, server.Token)
	if err != nil {
		return nil, err
	}

	return gitalypb.NewRepositoryServiceClient(conn), nil
}

func (mgr *Manager) newRefClient(ctx context.Context, server storage.ServerInfo) (gitalypb.RefServiceClient, error) {
	conn, err := mgr.conns.Dial(ctx, server.Address, server.Token)
	if err != nil {
		return nil, err
	}

	return gitalypb.NewRefServiceClient(conn), nil
}
