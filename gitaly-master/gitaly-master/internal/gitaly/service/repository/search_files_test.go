//go:build !gitaly_test_sha256

package repository

import (
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/client"
	"gitlab.com/gitlab-org/gitaly/v15/internal/backchannel"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/catfile"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/gittest"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git/housekeeping"
	"gitlab.com/gitlab-org/gitaly/v15/internal/git2go"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/transaction"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper/testcfg"
	"gitlab.com/gitlab-org/gitaly/v15/proto/go/gitalypb"
	"google.golang.org/grpc/codes"
)

var (
	contentOutputLines = [][]byte{bytes.Join([][]byte{
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00128\x00    ```Ruby"),
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00129\x00    # bad"),
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00130\x00    puts 'foobar'; # superfluous semicolon"),
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00131\x00"),
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00132\x00    puts 'foo'; puts 'bar' # two expression on the same line"),
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00133\x00"),
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00134\x00    # good"),
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00135\x00    puts 'foobar'"),
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00136\x00"),
		[]byte("many_files:files/markdown/ruby-style-guide.md\x00137\x00    puts 'foo'"),
		[]byte(""),
	}, []byte{'\n'})}
	contentMultiLines = [][]byte{
		bytes.Join([][]byte{
			[]byte("many_files:CHANGELOG\x00306\x00  - Gitlab::Git set of objects to abstract from grit library"),
			[]byte("many_files:CHANGELOG\x00307\x00  - Replace Unicorn web server with Puma"),
			[]byte("many_files:CHANGELOG\x00308\x00  - Backup/Restore refactored. Backup dump project wiki too now"),
			[]byte("many_files:CHANGELOG\x00309\x00  - Restyled Issues list. Show milestone version in issue row"),
			[]byte("many_files:CHANGELOG\x00310\x00  - Restyled Merge Request list"),
			[]byte("many_files:CHANGELOG\x00311\x00  - Backup now dump/restore uploads"),
			[]byte("many_files:CHANGELOG\x00312\x00  - Improved performance of dashboard (Andrew Kumanyaev)"),
			[]byte("many_files:CHANGELOG\x00313\x00  - File history now tracks renames (Akzhan Abdulin)"),
			[]byte(""),
		}, []byte{'\n'}),
		bytes.Join([][]byte{
			[]byte("many_files:CHANGELOG\x00377\x00  - fix routing issues"),
			[]byte("many_files:CHANGELOG\x00378\x00  - cleanup rake tasks"),
			[]byte("many_files:CHANGELOG\x00379\x00  - fix backup/restore"),
			[]byte("many_files:CHANGELOG\x00380\x00  - scss cleanup"),
			[]byte("many_files:CHANGELOG\x00381\x00  - show preview for note images"),
			[]byte(""),
		}, []byte{'\n'}),
		bytes.Join([][]byte{
			[]byte("many_files:CHANGELOG\x00393\x00  - Remove project code and path from API. Use id instead"),
			[]byte("many_files:CHANGELOG\x00394\x00  - Return valid cloneable url to repo for web hook"),
			[]byte("many_files:CHANGELOG\x00395\x00  - Fixed backup issue"),
			[]byte("many_files:CHANGELOG\x00396\x00  - Reorganized settings"),
			[]byte("many_files:CHANGELOG\x00397\x00  - Fixed commits compare"),
			[]byte(""),
		}, []byte{'\n'}),
	}
	contentCoffeeLines = [][]byte{
		bytes.Join([][]byte{
			[]byte("many_files:CONTRIBUTING.md\x0092\x001. [Ruby style guide](https://github.com/bbatsov/ruby-style-guide)"),
			[]byte("many_files:CONTRIBUTING.md\x0093\x001. [Rails style guide](https://github.com/bbatsov/rails-style-guide)"),
			[]byte("many_files:CONTRIBUTING.md\x0094\x001. [CoffeeScript style guide](https://github.com/polarmobile/coffeescript-style-guide)"),
			[]byte("many_files:CONTRIBUTING.md\x0095\x001. [Shell command guidelines](doc/development/shell_commands.md)"),
			[]byte(""),
		}, []byte{'\n'}),
		bytes.Join([][]byte{
			[]byte("many_files:files/js/application.js\x001\x00// This is a manifest file that'll be compiled into including all the files listed below."),
			[]byte("many_files:files/js/application.js\x002\x00// Add new JavaScript/Coffee code in separate files in this directory and they'll automatically"),
			[]byte("many_files:files/js/application.js\x003\x00// be included in the compiled file accessible from http://example.com/assets/application.js"),
			[]byte("many_files:files/js/application.js\x004\x00// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the"),
			[]byte(""),
		}, []byte{'\n'}),
	}
)

func TestSearchFilesByContentSuccessful(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)

	_, repo, _, client := setupRepositoryService(t, ctx)

	testCases := []struct {
		desc   string
		query  string
		ref    string
		output [][]byte
	}{
		{
			desc:   "single file in many_files",
			query:  "foobar",
			ref:    "many_files",
			output: contentOutputLines,
		},
		{
			desc:   "single files, multiple matches",
			query:  "backup",
			ref:    "many_files",
			output: contentMultiLines,
		},
		{
			desc:   "multiple files, multiple matches",
			query:  "coffee",
			ref:    "many_files",
			output: contentCoffeeLines,
		},
		{
			desc:   "no results",
			query:  "????????????????????????",
			ref:    "many_files",
			output: [][]byte{},
		},
		{
			desc:   "with regexp limiter only recognized by pcre",
			query:  "(*LIMIT_MATCH=1)foobar",
			ref:    "many_files",
			output: contentOutputLines,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			request := &gitalypb.SearchFilesByContentRequest{
				Repository: repo,
				Query:      tc.query,
				Ref:        []byte(tc.ref),
			}
			request.ChunkedResponse = true
			stream, err := client.SearchFilesByContent(ctx, request)
			require.NoError(t, err)

			resp, err := consumeFilenameByContentChunked(stream)
			require.NoError(t, err)
			require.Equal(t, len(tc.output), len(resp))
			for i := 0; i < len(tc.output); i++ {
				require.Equal(t, tc.output[i], resp[i])
			}
		})
	}
}

func TestSearchFilesByContentLargeFile(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)

	cfg, repo, repoPath, client := setupRepositoryService(t, ctx)

	for _, tc := range []struct {
		desc     string
		filename string
		line     string
		repeated int
		query    string
	}{
		{
			desc:     "large file",
			filename: "large_file_of_abcdefg_2mb",
			line:     "abcdefghi\n", // 10 bytes
			repeated: 210000,
			query:    "abcdefg",
		},
		{
			desc:     "large file with unicode",
			filename: "large_file_of_unicode_1.5mb",
			line:     "????????????????????????????\n", // 22 bytes
			repeated: 70000,
			query:    "????????????",
		},
	} {
		t.Run(tc.filename, func(t *testing.T) {
			gittest.WriteCommit(t, cfg, repoPath, gittest.WithTreeEntries(gittest.TreeEntry{
				Path:    tc.filename,
				Mode:    "100644",
				Content: strings.Repeat(tc.line, tc.repeated),
			}), gittest.WithBranch("master"))

			stream, err := client.SearchFilesByContent(ctx, &gitalypb.SearchFilesByContentRequest{
				Repository:      repo,
				Query:           tc.query,
				Ref:             []byte("master"),
				ChunkedResponse: true,
			})
			require.NoError(t, err)

			response, err := consumeFilenameByContentChunked(stream)
			require.NoError(t, err)

			require.Equal(t, tc.repeated, len(bytes.Split(bytes.TrimRight(response[0], "\n"), []byte("\n"))))
		})
	}
}

func TestSearchFilesByContentFailure(t *testing.T) {
	t.Parallel()

	ctx := testhelper.Context(t)
	cfg := testcfg.Build(t)

	repo, _ := gittest.CreateRepository(t, ctx, cfg, gittest.CreateRepositoryConfig{
		SkipCreationViaService: true,
		Seed:                   gittest.SeedGitLabTest,
	})

	gitCommandFactory := gittest.NewCommandFactory(t, cfg)
	catfileCache := catfile.NewCache(cfg)
	t.Cleanup(catfileCache.Stop)

	locator := config.NewLocator(cfg)

	connsPool := client.NewPool()
	defer testhelper.MustClose(t, connsPool)

	git2goExecutor := git2go.NewExecutor(cfg, gitCommandFactory, locator)
	txManager := transaction.NewManager(cfg, backchannel.NewRegistry())
	housekeepingManager := housekeeping.NewManager(cfg.Prometheus, txManager)

	server := NewServer(
		cfg,
		nil,
		locator,
		txManager,
		gitCommandFactory,
		catfileCache,
		connsPool,
		git2goExecutor,
		housekeepingManager,
	)

	testCases := []struct {
		desc  string
		repo  *gitalypb.Repository
		query string
		ref   string
		code  codes.Code
		msg   string
	}{
		{
			desc: "empty request",
			repo: repo,
			code: codes.InvalidArgument,
			msg:  "no query given",
		},
		{
			desc:  "only query given",
			repo:  repo,
			query: "foo",
			code:  codes.InvalidArgument,
			msg:   "no ref given",
		},
		{
			desc:  "no repo",
			query: "foo",
			ref:   "master",
			code:  codes.InvalidArgument,
			msg:   "empty Repo",
		},
		{
			desc:  "invalid ref argument",
			repo:  repo,
			query: ".",
			ref:   "--no-index",
			code:  codes.InvalidArgument,
			msg:   "invalid ref argument",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			err := server.SearchFilesByContent(&gitalypb.SearchFilesByContentRequest{
				Repository: tc.repo,
				Query:      tc.query,
				Ref:        []byte(tc.ref),
			}, nil)

			testhelper.RequireGrpcCode(t, err, tc.code)
			require.Contains(t, err.Error(), tc.msg)
		})
	}
}

func TestSearchFilesByNameSuccessful(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)

	_, repo, _, client := setupRepositoryService(t, ctx)

	testCases := []struct {
		desc     string
		ref      []byte
		query    string
		filter   string
		numFiles int
		testFile []byte
	}{
		{
			desc:     "one file",
			ref:      []byte("many_files"),
			query:    "files/images/logo-black.png",
			numFiles: 1,
			testFile: []byte("files/images/logo-black.png"),
		},
		{
			desc:     "many files",
			ref:      []byte("many_files"),
			query:    "many_files",
			numFiles: 1001,
			testFile: []byte("many_files/99"),
		},
		{
			desc:     "filtered",
			ref:      []byte("many_files"),
			query:    "files/images",
			filter:   `\.svg$`,
			numFiles: 1,
			testFile: []byte("files/images/wm.svg"),
		},
		{
			desc:     "non-existent ref",
			query:    ".",
			ref:      []byte("non_existent_ref"),
			numFiles: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			stream, err := client.SearchFilesByName(ctx, &gitalypb.SearchFilesByNameRequest{
				Repository: repo,
				Ref:        tc.ref,
				Query:      tc.query,
				Filter:     tc.filter,
			})
			require.NoError(t, err)

			var files [][]byte
			files, err = consumeFilenameByName(stream)
			require.NoError(t, err)

			require.Equal(t, tc.numFiles, len(files))
			if tc.numFiles != 0 {
				require.Contains(t, files, tc.testFile)
			}
		})
	}
}

func TestSearchFilesByNameUnusualFileNamesSuccessful(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)

	cfg, repo, repoPath, client := setupRepositoryService(t, ctx)

	ref := []byte("unusual_file_names")
	gittest.WriteCommit(t, cfg, repoPath,
		gittest.WithBranch(string(ref)),
		gittest.WithMessage("commit message"),
		gittest.WithTreeEntries(
			gittest.TreeEntry{Path: "\"file with quote.txt", Mode: "100644", Content: "something"},
			gittest.TreeEntry{Path: ".vimrc", Mode: "100644", Content: "something"},
			gittest.TreeEntry{Path: "cu???c ?????i l?? nh???ng chuy???n ??i.md", Mode: "100644", Content: "something"},
			gittest.TreeEntry{Path: "?????? 'foo'.md", Mode: "100644", Content: "something"},
		),
	)

	testCases := []struct {
		desc          string
		query         string
		filter        string
		expectedFiles [][]byte
	}{
		{
			desc:          "file with quote",
			query:         "\"file with quote.txt",
			expectedFiles: [][]byte{[]byte("\"file with quote.txt")},
		},
		{
			desc:          "dotfiles",
			query:         ".vimrc",
			expectedFiles: [][]byte{[]byte(".vimrc")},
		},
		{
			desc:          "latin-base language",
			query:         "cu???c ?????i l?? nh???ng chuy???n ??i.md",
			expectedFiles: [][]byte{[]byte("cu???c ?????i l?? nh???ng chuy???n ??i.md")},
		},
		{
			desc:          "non-latin language",
			query:         "?????? 'foo'.md",
			expectedFiles: [][]byte{[]byte("?????? 'foo'.md")},
		},
		{
			desc:          "filter file with quote",
			query:         ".",
			filter:        "^\"file.*",
			expectedFiles: [][]byte{[]byte("\"file with quote.txt")},
		},
		{
			desc:          "filter dotfiles",
			query:         ".",
			filter:        "^\\..*",
			expectedFiles: [][]byte{[]byte(".vimrc")},
		},
		{
			desc:          "filter latin-base language",
			query:         ".",
			filter:        "cu???c ?????i .*\\.md",
			expectedFiles: [][]byte{[]byte("cu???c ?????i l?? nh???ng chuy???n ??i.md")},
		},
		{
			desc:          "filter non-latin language",
			query:         ".",
			filter:        "?????? 'foo'\\.(md|txt|rdoc)",
			expectedFiles: [][]byte{[]byte("?????? 'foo'.md")},
		},
		{
			desc:   "wildcard filter",
			query:  ".",
			filter: ".*",
			expectedFiles: [][]byte{
				[]byte("\"file with quote.txt"),
				[]byte(".vimrc"),
				[]byte("cu???c ?????i l?? nh???ng chuy???n ??i.md"),
				[]byte("?????? 'foo'.md"),
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			stream, err := client.SearchFilesByName(ctx, &gitalypb.SearchFilesByNameRequest{
				Repository: repo,
				Ref:        ref,
				Query:      tc.query,
				Filter:     tc.filter,
			})
			require.NoError(t, err)

			var files [][]byte
			files, err = consumeFilenameByName(stream)
			require.NoError(t, err)
			require.Equal(t, tc.expectedFiles, files)
		})
	}
}

func TestSearchFilesByNamePaginationSuccessful(t *testing.T) {
	t.Parallel()
	ctx := testhelper.Context(t)

	cfg, repo, repoPath, client := setupRepositoryService(t, ctx)

	ref := []byte("pagination")
	gittest.WriteCommit(t, cfg, repoPath,
		gittest.WithBranch(string(ref)),
		gittest.WithMessage("commit message"),
		gittest.WithTreeEntries(
			gittest.TreeEntry{Path: "file1.md", Mode: "100644", Content: "file1"},
			gittest.TreeEntry{Path: "file2.md", Mode: "100644", Content: "file2"},
			gittest.TreeEntry{Path: "file3.md", Mode: "100644", Content: "file3"},
			gittest.TreeEntry{Path: "file4.md", Mode: "100644", Content: "file4"},
			gittest.TreeEntry{Path: "file5.md", Mode: "100644", Content: "file5"},
			gittest.TreeEntry{Path: "new_file1.md", Mode: "100644", Content: "new_file1"},
			gittest.TreeEntry{Path: "new_file2.md", Mode: "100644", Content: "new_file2"},
			gittest.TreeEntry{Path: "new_file3.md", Mode: "100644", Content: "new_file3"},
		),
	)

	testCases := []struct {
		desc          string
		query         string
		filter        string
		offset        uint32
		limit         uint32
		expectedFiles [][]byte
	}{
		{
			desc:          "only limit is set",
			query:         ".",
			limit:         3,
			expectedFiles: [][]byte{[]byte("file1.md"), []byte("file2.md"), []byte("file3.md")},
		},
		{
			desc:          "only offset is set",
			query:         ".",
			offset:        2,
			expectedFiles: [][]byte{[]byte("file3.md"), []byte("file4.md"), []byte("file5.md"), []byte("new_file1.md"), []byte("new_file2.md"), []byte("new_file3.md")},
		},
		{
			desc:          "both limit and offset are set",
			query:         ".",
			offset:        2,
			limit:         2,
			expectedFiles: [][]byte{[]byte("file3.md"), []byte("file4.md")},
		},
		{
			desc:          "offset exceeds the total files",
			query:         ".",
			offset:        8,
			expectedFiles: nil,
		},
		{
			desc:          "offset + limit exceeds the total files",
			query:         ".",
			offset:        6,
			limit:         5,
			expectedFiles: [][]byte{[]byte("new_file2.md"), []byte("new_file3.md")},
		},
		{
			desc:          "limit and offset combine with filter",
			query:         ".",
			filter:        "new.*",
			offset:        1,
			limit:         2,
			expectedFiles: [][]byte{[]byte("new_file2.md"), []byte("new_file3.md")},
		},
		{
			desc:          "limit and offset combine with unmatched filter",
			query:         ".",
			filter:        "not_matched.*",
			offset:        1,
			limit:         2,
			expectedFiles: nil,
		},
		{
			desc:          "limit and offset combine with matched query",
			query:         "new_file2.md",
			offset:        0,
			limit:         2,
			expectedFiles: [][]byte{[]byte("new_file2.md")},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			stream, err := client.SearchFilesByName(ctx, &gitalypb.SearchFilesByNameRequest{
				Repository: repo,
				Ref:        ref,
				Query:      tc.query,
				Filter:     tc.filter,
				Offset:     tc.offset,
				Limit:      tc.limit,
			})
			require.NoError(t, err)

			var files [][]byte
			files, err = consumeFilenameByName(stream)
			require.NoError(t, err)
			require.Equal(t, tc.expectedFiles, files)
		})
	}
}

func TestSearchFilesByNameFailure(t *testing.T) {
	t.Parallel()
	cfg := testcfg.Build(t)
	gitCommandFactory := gittest.NewCommandFactory(t, cfg)
	catfileCache := catfile.NewCache(cfg)
	t.Cleanup(catfileCache.Stop)

	locator := config.NewLocator(cfg)

	connsPool := client.NewPool()
	defer testhelper.MustClose(t, connsPool)

	git2goExecutor := git2go.NewExecutor(cfg, gitCommandFactory, locator)
	txManager := transaction.NewManager(cfg, backchannel.NewRegistry())
	housekeepingManager := housekeeping.NewManager(cfg.Prometheus, txManager)

	server := NewServer(
		cfg,
		nil,
		locator,
		txManager,
		gitCommandFactory,
		catfileCache,
		connsPool,
		git2goExecutor,
		housekeepingManager,
	)

	testCases := []struct {
		desc   string
		repo   *gitalypb.Repository
		query  string
		filter string
		ref    string
		offset uint32
		limit  uint32
		code   codes.Code
		msg    string
	}{
		{
			desc: "repository not initialized",
			repo: &gitalypb.Repository{},
			code: codes.InvalidArgument,
			msg:  "empty StorageName",
		},
		{
			desc: "empty request",
			repo: &gitalypb.Repository{RelativePath: "stub", StorageName: "stub"},
			code: codes.InvalidArgument,
			msg:  "no query given",
		},
		{
			desc:  "only query given",
			repo:  &gitalypb.Repository{RelativePath: "stub", StorageName: "stub"},
			query: "foo",
			code:  codes.InvalidArgument,
			msg:   "no ref given",
		},
		{
			desc:  "no repo",
			query: "foo",
			ref:   "master",
			code:  codes.InvalidArgument,
			msg:   "empty Repo",
		},
		{
			desc:   "invalid filter",
			repo:   &gitalypb.Repository{RelativePath: "stub", StorageName: "stub"},
			query:  "foo",
			ref:    "master",
			filter: "+*.",
			code:   codes.InvalidArgument,
			msg:    "filter did not compile: error parsing regexp:",
		},
		{
			desc:   "filter longer than max",
			repo:   &gitalypb.Repository{RelativePath: "stub", StorageName: "stub"},
			query:  "foo",
			ref:    "master",
			filter: strings.Repeat(".", searchFilesFilterMaxLength+1),
			code:   codes.InvalidArgument,
			msg:    "filter exceeds maximum length",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			err := server.SearchFilesByName(&gitalypb.SearchFilesByNameRequest{
				Repository: tc.repo,
				Query:      tc.query,
				Filter:     tc.filter,
				Ref:        []byte(tc.ref),
				Offset:     tc.offset,
				Limit:      tc.limit,
			}, nil)

			testhelper.RequireGrpcCode(t, err, tc.code)
			require.Contains(t, err.Error(), tc.msg)
		})
	}
}

func consumeFilenameByContentChunked(stream gitalypb.RepositoryService_SearchFilesByContentClient) ([][]byte, error) {
	var ret [][]byte
	var match []byte

	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		match = append(match, resp.MatchData...)
		if resp.EndOfMatch {
			ret = append(ret, match)
			match = nil
		}
	}

	return ret, nil
}

func consumeFilenameByName(stream gitalypb.RepositoryService_SearchFilesByNameClient) ([][]byte, error) {
	var ret [][]byte

	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		ret = append(ret, resp.Files...)
	}
	return ret, nil
}
