//go:build !gitaly_test_sha256

package cleanup

import (
	"context"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/localrepo"
	"gitlab.com/gitlab-org/gitaly/v15/internal/structerr"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
)

func TestApplyBfgObjectMapStreamSuccess(t *testing.T) {
	ctx := testhelper.Context(t)

	cfg, protoRepo, repoPath, client := setupCleanupService(t, ctx)

	testcfg.BuildGitalyHooks(t, cfg)

	repo := localrepo.NewTestRepo(t, cfg, protoRepo)

	headCommit, err := repo.ReadCommit(ctx, "HEAD")
	require.NoError(t, err)

	// A known blob: the CHANGELOG in the test repository
	blobID := "53855584db773c3df5b5f61f72974cb298822fbb"

	// A known tag: v1.0.0
	tagID := "f4e6814c3e4e7a0de82a9e7cd20c626cc963a2f8"

	// Create some refs pointing to HEAD
	for _, ref := range []string{
		"refs/environments/1", "refs/keep-around/1", "refs/merge-requests/1", "refs/pipelines/1",
		"refs/heads/_keep", "refs/tags/_keep", "refs/notes/_keep",
	} {
		gittest.Exec(t, cfg, "-C", repoPath, "update-ref", ref, headCommit.Id)
	}

	// Create some refs pointing to ref/tags/v1.0.0, simulating an unmodified
	// commit that predates bad data being added to the repository.
	for _, ref := range []string{
		"refs/environments/_keep", "refs/keep-around/_keep", "refs/merge-requests/_keep", "refs/pipelines/_keep",
	} {
		gittest.Exec(t, cfg, "-C", repoPath, "update-ref", ref, tagID)
	}

	const filterRepoCommitMapHeader = "old                                      new\n"
	objectMapData := fmt.Sprintf(
		filterRepoCommitMapHeader+strings.Repeat("%s %s\n", 5),
		headCommit.Id, git.ObjectHashSHA1.ZeroOID.String(),
		git.ObjectHashSHA1.ZeroOID.String(), blobID,
		git.ObjectHashSHA1.ZeroOID.String(), tagID,
		blobID, git.ObjectHashSHA1.ZeroOID.String(),
		tagID, tagID,
	)

	entries, err := doStreamingRequest(t, ctx, client,
		&gitalypb.ApplyBfgObjectMapStreamRequest{
			Repository: protoRepo,
			ObjectMap:  []byte(objectMapData[:10]),
		},
		&gitalypb.ApplyBfgObjectMapStreamRequest{
			ObjectMap: []byte(objectMapData[10:20]),
		},
		&gitalypb.ApplyBfgObjectMapStreamRequest{
			ObjectMap: []byte(objectMapData[20:]),
		},
	)
	require.NoError(t, err)

	// Ensure that the internal refs are gone, but the others still exist
	refs, err := repo.GetReferences(ctx, "refs/")
	require.NoError(t, err)

	refNames := make([]string, len(refs))
	for i, branch := range refs {
		refNames[i] = branch.Name.String()
	}

	assert.NotContains(t, refNames, "refs/environments/1")
	assert.NotContains(t, refNames, "refs/keep-around/1")
	assert.NotContains(t, refNames, "refs/merge-requests/1")
	assert.NotContains(t, refNames, "refs/pipelines/1")
	assert.Contains(t, refNames, "refs/heads/_keep")
	assert.Contains(t, refNames, "refs/tags/_keep")
	assert.Contains(t, refNames, "refs/notes/_keep")
	assert.Contains(t, refNames, "refs/environments/_keep")
	assert.Contains(t, refNames, "refs/keep-around/_keep")
	assert.Contains(t, refNames, "refs/merge-requests/_keep")
	assert.Contains(t, refNames, "refs/pipelines/_keep")

	// Ensure that the returned entry is correct
	require.Len(t, entries, 4, "wrong number of entries returned")
	requireEntry(t, entries[0], headCommit.Id, git.ObjectHashSHA1.ZeroOID.String(), gitalypb.ObjectType_COMMIT)
	requireEntry(t, entries[1], git.ObjectHashSHA1.ZeroOID.String(), blobID, gitalypb.ObjectType_BLOB)
	requireEntry(t, entries[2], git.ObjectHashSHA1.ZeroOID.String(), tagID, gitalypb.ObjectType_TAG)
	requireEntry(t, entries[3], blobID, git.ObjectHashSHA1.ZeroOID.String(), gitalypb.ObjectType_UNKNOWN)
}

func requireEntry(t *testing.T, entry *gitalypb.ApplyBfgObjectMapStreamResponse_Entry, oldOid, newOid string, objectType gitalypb.ObjectType) {
	t.Helper()

	require.Equal(t, objectType, entry.Type)
	require.Equal(t, oldOid, entry.OldOid)
	require.Equal(t, newOid, entry.NewOid)
}

func TestApplyBfgObjectMapStreamFailsOnInvalidInput(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	_, repoProto, _, client := setupCleanupService(t, ctx)

	t.Run("invalid object map", func(t *testing.T) {
		response, err := doStreamingRequest(t, ctx, client, &gitalypb.ApplyBfgObjectMapStreamRequest{
			Repository: repoProto,
			ObjectMap:  []byte("invalid-data here as you can see"),
		})
		require.Nil(t, response)
		testhelper.RequireGrpcError(t, structerr.NewInvalidArgument("object map invalid at line 0"), err)
	})

	t.Run("no repository provided", func(t *testing.T) {
		response, err := doStreamingRequest(t, ctx, client, &gitalypb.ApplyBfgObjectMapStreamRequest{
			Repository: nil,
			ObjectMap:  []byte("does not matter"),
		})
		require.Nil(t, response)
		testhelper.RequireGrpcError(t, structerr.NewInvalidArgument(testhelper.GitalyOrPraefect(
			"empty Repository",
			"repo scoped: empty Repository",
		)), err)
	})
}

func doStreamingRequest(
	t *testing.T,
	ctx context.Context,
	client gitalypb.CleanupServiceClient,
	requests ...*gitalypb.ApplyBfgObjectMapStreamRequest,
) ([]*gitalypb.ApplyBfgObjectMapStreamResponse_Entry, error) {
	t.Helper()

	server, err := client.ApplyBfgObjectMapStream(ctx)
	require.NoError(t, err)
	for _, request := range requests {
		require.NoError(t, server.Send(request))
	}
	require.NoError(t, server.CloseSend())

	var entries []*gitalypb.ApplyBfgObjectMapStreamResponse_Entry
	for {
		rsp, err := server.Recv()
		if rsp != nil {
			entries = append(entries, rsp.GetEntries()...)
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
	}

	return entries, nil
}
