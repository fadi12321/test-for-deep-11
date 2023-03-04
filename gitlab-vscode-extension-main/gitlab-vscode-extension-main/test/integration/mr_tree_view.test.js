const assert = require('assert');
const path = require('path').posix;
const vscode = require('vscode');
const { graphql } = require('msw');

const { getServer, createJsonEndpoint } = require('./test_infrastructure/mock_server');

const { setSidebarViewState, SidebarViewState } = require('../../src/tree_view/sidebar_view_state');
const { IssuableDataProvider } = require('../../src/tree_view/issuable_data_provider');
const { MrItemModel } = require('../../src/tree_view/items/mr_item_model');

const { ChangedFolderItem } = require('../../src/tree_view/items/changed_folder_item');
const { ChangedFileItem } = require('../../src/tree_view/items/changed_file_item');

const openMergeRequestResponse = require('./fixtures/rest/open_mr.json');
const versionsResponse = require('./fixtures/rest/versions.json');
const mrPermissionsResponse = require('./fixtures/graphql/mr_permissions.json');
const { projectWithMrDiscussions } = require('./fixtures/graphql/discussions');

const onlyOneFolder = require('./fixtures/rest/mr_versions/only_one_folder.json');
const nestFolders = require('./fixtures/rest/mr_versions/nest_folders.json');
const onlyRootFiles = require('./fixtures/rest/mr_versions/only_root_files.json');
const multiFiles = require('./fixtures/rest/mr_versions/multi_files.json');
const { getRepositoryRoot } = require('./test_infrastructure/helpers');
const { gitlabProjectRepository } = require('../../src/gitlab/gitlab_project_repository');

const fileTestCase = (changedFileItem, filename, filepath) => {
  // this test case ensures file items list in the tree view is as same as they are in the list view
  assert.ok(changedFileItem instanceof ChangedFileItem);
  assert.strictEqual(changedFileItem.command.command, 'vscode.diff');
  assert.strictEqual(changedFileItem.command.arguments[2], `${filename} (!33824)`);
  assert.strictEqual(changedFileItem.resourceUri.path, path.join(filepath, filename));
};

const folderTestCase = (tree, { subfolders = [], files = [] }, folderPath = path.sep) => {
  const length = subfolders.length + files.length;
  assert.strictEqual(tree.length, length);

  for (let i = 0; i < subfolders.length; i += 1) {
    const subfolder = subfolders[i];
    const subfolderPath = path.join(folderPath, subfolder.name);

    assert.ok(tree[i] instanceof ChangedFolderItem);
    assert.strictEqual(tree[i].label, subfolder.name);
    assert.strictEqual(tree[i].collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
    assert.strictEqual(tree[i].iconPath, vscode.ThemeIcon.Folder);
    assert.strictEqual(tree[i].resourceUri.path, subfolderPath);

    folderTestCase(tree[i].getChildren(), subfolder, subfolderPath);
  }

  for (let i = 0; i < files.length; i += 1) {
    const file = tree[subfolders.length + i];
    fileTestCase(file, files[i], folderPath);
  }
};

describe('MR in tree view', () => {
  let folderTree;

  const getHandlers = versionResponse => [
    createJsonEndpoint('/projects/278964/merge_requests/33824/versions', versionsResponse),
    createJsonEndpoint('/projects/278964/merge_requests/33824/versions/127919672', versionResponse),
    graphql.query('GetMrPermissions', (req, res, ctx) => {
      if (req.variables.namespaceWithPath === 'gitlab-org/gitlab' && req.variables.iid === '33824')
        return res(ctx.data(mrPermissionsResponse));
      return res(ctx.data({ project: null }));
    }),
    graphql.query('GetMrDiscussions', (req, res, ctx) => {
      if (req.variables.namespaceWithPath === 'gitlab-org/gitlab' && req.variables.iid === '33824')
        return res(ctx.data(projectWithMrDiscussions));
      return res(ctx.data({ project: null }));
    }),
  ];

  before(async () => {
    setSidebarViewState(SidebarViewState.TreeView);
  });

  beforeEach(async () => {
    const dataProvider = new IssuableDataProvider();
    const mrItemModel = new MrItemModel(
      openMergeRequestResponse,
      await gitlabProjectRepository.getSelectedOrDefaultForRepository(getRepositoryRoot()),
    );

    const mrContent = await dataProvider.getChildren(mrItemModel);
    assert.strictEqual(mrContent[0].label, 'Overview');

    folderTree = mrContent.slice(1);
  });

  after(async () => {
    setSidebarViewState(SidebarViewState.ListView);
  });

  describe('only one folder', () => {
    let server;
    before(() => {
      server = getServer(getHandlers(onlyOneFolder));
    });
    after(() => {
      server.close();
    });

    it('should show diffs in the tree view', async () => {
      folderTestCase(folderTree, {
        subfolders: [
          {
            name: 'only-folder',
            files: ['test.js'],
          },
        ],
      });
    });
  });

  describe('nest folders', () => {
    let server;
    before(() => {
      server = getServer(getHandlers(nestFolders));
    });
    after(() => {
      server.close();
    });

    it('should show diffs in the tree view and concatenate all folder names', async () => {
      folderTestCase(folderTree, {
        subfolders: [
          {
            name: 'folder1/folder2/folder3/folder4/folder5',
            files: ['test.txt'],
          },
        ],
      });
    });
  });

  describe('only root files', () => {
    let server;
    before(() => {
      server = getServer(getHandlers(onlyRootFiles));
    });
    after(() => {
      server.close();
    });

    it('should show diffs in the tree view as same as in the list view', async () => {
      folderTestCase(folderTree, {
        files: ['file1', 'file2'],
      });
    });
  });

  describe('multi files', () => {
    let server;
    before(() => {
      server = getServer(getHandlers(multiFiles));
    });
    after(() => {
      server.close();
    });

    it('should show diffs in the tree view and concatenate folder names correctly', async () => {
      folderTestCase(folderTree, {
        subfolders: [
          {
            name: 'folder1',
            files: ['file1'],
          },
          {
            name: 'folder2/folder3',
            subfolders: [
              {
                name: 'folder4/folder5',
                files: ['file3'],
              },
            ],
            files: ['file2'],
          },
        ],
        files: ['file1'],
      });
    });
  });
});
