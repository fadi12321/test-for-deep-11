package commit

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	log "github.com/sirupsen/logrus"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/catfile"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/lstree"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/service"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/chunk"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/protobuf/proto"
)

const (
	defaultFlatTreeRecursion = 10
)

func validateGetTreeEntriesRequest(in *gitalypb.GetTreeEntriesRequest) error {
	if err := service.ValidateRepository(in.GetRepository()); err != nil {
		return err
	}
	if err := git.ValidateRevision(in.Revision); err != nil {
		return err
	}

	if len(in.GetPath()) == 0 {
		return fmt.Errorf("empty Path")
	}

	return nil
}

func populateFlatPath(
	ctx context.Context,
	objectReader catfile.ObjectContentReader,
	objectInfoReader catfile.ObjectInfoReader,
	entries []*gitalypb.TreeEntry,
) error {
	for _, entry := range entries {
		entry.FlatPath = entry.Path

		if entry.Type != gitalypb.TreeEntry_TREE {
			continue
		}

		for i := 1; i < defaultFlatTreeRecursion; i++ {
			subEntries, err := catfile.TreeEntries(ctx, objectReader, objectInfoReader, entry.CommitOid, string(entry.FlatPath))
			if err != nil {
				return err
			}

			if len(subEntries) != 1 || subEntries[0].Type != gitalypb.TreeEntry_TREE {
				break
			}

			entry.FlatPath = subEntries[0].Path
		}
	}

	return nil
}

func (s *server) sendTreeEntries(
	stream gitalypb.CommitService_GetTreeEntriesServer,
	repo *localrepo.Repo,
	revision, path string,
	recursive bool,
	skipFlatPaths bool,
	sort gitalypb.GetTreeEntriesRequest_SortBy,
	p *gitalypb.PaginationParameter,
) error {
	ctx := stream.Context()

	var entries []*gitalypb.TreeEntry

	var (
		objectReader     catfile.ObjectContentReader
		objectInfoReader catfile.ObjectInfoReader
	)

	// When we want to do a recursive listing, then it's a _lot_ more efficient to let
	// git-ls-tree(1) handle this for us. In theory, we'd also want to do this for the
	// non-recursive case. But in practice, we must populate a so-called "flat path" when doing
	// a non-recursive listing, where the flat path of a directory entry points to the first
	// subdirectory which has more than a single entry.
	//
	// Answering this query efficiently is not possible with Git's tooling, and solving it via
	// git-ls-tree(1) is worse than using a long-lived catfile process. We thus fall back to
	// using catfile readers to answer these non-recursive queries.
	if recursive {
		if path == "." {
			path = ""
		}

		rootTreeInfo, err := repo.ResolveRevision(ctx, git.Revision(revision+"^{tree}"))
		if err != nil {
			if errors.Is(err, git.ErrReferenceNotFound) {
				return nil
			}

			return err
		}

		treeEntries, err := lstree.ListEntries(ctx, repo, git.Revision(revision), &lstree.ListEntriesConfig{
			Recursive:    recursive,
			RelativePath: path,
		})
		if err != nil {
			// Design wart: we do not return an error if the request does not
			// point to a tree object, but just return nothing.
			if errors.Is(err, lstree.ErrNotTreeish) {
				return nil
			}

			// Same if we try to list tree entries of a revision which doesn't exist.
			if errors.Is(err, lstree.ErrNotExist) {
				return nil
			}

			return fmt.Errorf("listing tree entries: %w", err)
		}

		entries = make([]*gitalypb.TreeEntry, 0, len(treeEntries))
		for _, entry := range treeEntries {
			objectID, err := entry.OID.Bytes()
			if err != nil {
				return fmt.Errorf("converting tree entry OID: %w", err)
			}

			treeEntry, err := git.NewTreeEntry(
				revision,
				rootTreeInfo.String(),
				path,
				[]byte(entry.Path),
				objectID,
				[]byte(entry.Mode),
			)
			if err != nil {
				return fmt.Errorf("converting tree entry: %w", err)
			}

			entries = append(entries, treeEntry)
		}
	} else {
		var err error
		var cancel func()

		objectReader, cancel, err = s.catfileCache.ObjectReader(stream.Context(), repo)
		if err != nil {
			return err
		}
		defer cancel()

		objectInfoReader, cancel, err = s.catfileCache.ObjectInfoReader(stream.Context(), repo)
		if err != nil {
			return err
		}
		defer cancel()

		entries, err = catfile.TreeEntries(ctx, objectReader, objectInfoReader, revision, path)
		if err != nil {
			return err
		}
	}

	// We sort before we paginate to ensure consistent results with ListLastCommitsForTree
	entries, err := sortTrees(entries, sort)
	if err != nil {
		return err
	}

	cursor := ""
	if p != nil {
		entries, cursor, err = paginateTreeEntries(ctx, entries, p)
		if err != nil {
			return err
		}
	}

	treeSender := &treeEntriesSender{stream: stream}

	if cursor != "" {
		treeSender.SetPaginationCursor(cursor)
	}

	if !recursive && !skipFlatPaths {
		// When we're not doing a recursive request, then we need to populate flat
		// paths. A flat path of a tree entry refers to the first subtree of that
		// entry which either has at least one blob or more than two subtrees. In
		// other terms, it refers to the first "non-empty" subtree such that it's
		// easy to skip navigating the intermediate subtrees which wouldn't carry
		// any interesting information anyway.
		//
		// Unfortunately, computing flat paths is _really_ inefficient: for each
		// tree entry, we recurse up to 10 levels deep into that subtree. We do so
		// by requesting the tree entries via a catfile process, which to the best
		// of my knowledge is as good as we can get. Doing this via git-ls-tree(1)
		// wouldn't fly: we'd have to spawn a separate process for each of the
		// subtrees, which is a lot of overhead.
		if err := populateFlatPath(ctx, objectReader, objectInfoReader, entries); err != nil {
			return err
		}
	}

	sender := chunk.New(treeSender)
	for _, e := range entries {
		if err := sender.Send(e); err != nil {
			return err
		}
	}

	return sender.Flush()
}

func sortTrees(entries []*gitalypb.TreeEntry, sortBy gitalypb.GetTreeEntriesRequest_SortBy) ([]*gitalypb.TreeEntry, error) {
	if sortBy == gitalypb.GetTreeEntriesRequest_DEFAULT {
		return entries, nil
	}

	var err error

	sort.SliceStable(entries, func(i, j int) bool {
		a, firstError := toLsTreeEnum(entries[i].Type)
		b, secondError := toLsTreeEnum(entries[j].Type)

		if firstError != nil {
			err = firstError
		} else if secondError != nil {
			err = secondError
		}

		return a < b
	})

	return entries, err
}

// This is used to match the sorting order given by getLSTreeEntries
func toLsTreeEnum(input gitalypb.TreeEntry_EntryType) (localrepo.ObjectType, error) {
	switch input {
	case gitalypb.TreeEntry_TREE:
		return localrepo.Tree, nil
	case gitalypb.TreeEntry_COMMIT:
		return localrepo.Submodule, nil
	case gitalypb.TreeEntry_BLOB:
		return localrepo.Blob, nil
	default:
		return -1, lstree.ErrParse
	}
}

type treeEntriesSender struct {
	response   *gitalypb.GetTreeEntriesResponse
	stream     gitalypb.CommitService_GetTreeEntriesServer
	cursor     string
	sentCursor bool
}

func (c *treeEntriesSender) Append(m proto.Message) {
	c.response.Entries = append(c.response.Entries, m.(*gitalypb.TreeEntry))
}

func (c *treeEntriesSender) Send() error {
	// To save bandwidth, we only send the cursor on the first response
	if !c.sentCursor {
		c.response.PaginationCursor = &gitalypb.PaginationCursor{NextCursor: c.cursor}
		c.sentCursor = true
	}

	return c.stream.Send(c.response)
}

func (c *treeEntriesSender) Reset() {
	c.response = &gitalypb.GetTreeEntriesResponse{}
}

func (c *treeEntriesSender) SetPaginationCursor(cursor string) {
	c.cursor = cursor
}

func (s *server) GetTreeEntries(in *gitalypb.GetTreeEntriesRequest, stream gitalypb.CommitService_GetTreeEntriesServer) error {
	ctxlogrus.Extract(stream.Context()).WithFields(log.Fields{
		"Revision": in.Revision,
		"Path":     in.Path,
	}).Debug("GetTreeEntries")

	if err := validateGetTreeEntriesRequest(in); err != nil {
		return structerr.NewInvalidArgument("%w", err)
	}

	repo := s.localrepo(in.GetRepository())

	revision := string(in.GetRevision())
	path := string(in.GetPath())
	return s.sendTreeEntries(stream, repo, revision, path, in.Recursive, in.SkipFlatPaths, in.GetSort(), in.GetPaginationParams())
}

func paginateTreeEntries(ctx context.Context, entries []*gitalypb.TreeEntry, p *gitalypb.PaginationParameter) ([]*gitalypb.TreeEntry, string, error) {
	limit := int(p.GetLimit())
	start, tokenType := decodePageToken(p.GetPageToken())
	index := -1

	// No token means we should start from the top
	if start == "" {
		index = 0
	} else {
		for i, entry := range entries {
			if buildEntryToken(entry, tokenType) == start {
				index = i + 1
				break
			}
		}
	}

	if index == -1 {
		return nil, "", fmt.Errorf("could not find starting OID: %s", start)
	}

	if limit == 0 {
		return nil, "", nil
	}

	if limit < 0 || (index+limit >= len(entries)) {
		return entries[index:], "", nil
	}

	paginated := entries[index : index+limit]

	newPageToken, err := encodePageToken(paginated[len(paginated)-1])
	if err != nil {
		return nil, "", fmt.Errorf("encode page token: %w", err)
	}

	return paginated, newPageToken, nil
}

func buildEntryToken(entry *gitalypb.TreeEntry, tokenType pageTokenType) string {
	if tokenType == pageTokenTypeOID {
		return entry.GetOid()
	}

	return string(entry.GetPath())
}

type pageToken struct {
	// FileName is the name of the tree entry that acts as continuation point.
	FileName string `json:"file_name"`
}

type pageTokenType bool

const (
	// pageTokenTypeOID is an old-style page token that contains the object ID a tree
	// entry is pointing to. This is ambiguous and thus deprecated.
	pageTokenTypeOID pageTokenType = false
	// pageTokenTypeFilename is a page token that contains the tree entry path.
	pageTokenTypeFilename pageTokenType = true
)

// decodePageToken decodes the given Base64-encoded page token. It returns the
// continuation point of the token and its type.
func decodePageToken(token string) (string, pageTokenType) {
	var pageToken pageToken

	decodedString, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return token, pageTokenTypeOID
	}

	if err := json.Unmarshal(decodedString, &pageToken); err != nil {
		return token, pageTokenTypeOID
	}

	return pageToken.FileName, pageTokenTypeFilename
}

// encodePageToken returns a page token with the TreeEntry's path as the continuation point for
// the next page. The page token serialized by first JSON marshaling it and then base64 encoding it.
func encodePageToken(entry *gitalypb.TreeEntry) (string, error) {
	jsonEncoded, err := json.Marshal(pageToken{FileName: string(entry.GetPath())})
	if err != nil {
		return "", err
	}

	encoded := base64.StdEncoding.EncodeToString(jsonEncoded)

	return encoded, err
}
