const assert = require('assert');
const vscode = require('vscode');
const { IssuableDataProvider } = require('../../src/tree_view/issuable_data_provider');
const openIssueResponse = require('./fixtures/rest/open_issue.json');
const openMergeRequestResponse = require('./fixtures/rest/open_mr.json');
const userResponse = require('./fixtures/rest/user.json');
const { getServer, createQueryJsonEndpoint } = require('./test_infrastructure/mock_server');
const { GITLAB_URL } = require('./test_infrastructure/constants');
const { gitlabProjectRepository } = require('../../src/gitlab/gitlab_project_repository');

describe('GitLab tree view', () => {
  let server;
  let dataProvider;

  const customQuerySettings = [
    {
      name: 'Issues assigned to me',
      type: 'issues',
      scope: 'assigned_to_me',
      state: 'opened',
      noItemText: 'There is no issue assigned to you.',
    },
    {
      name: 'Merge requests assigned to me',
      type: 'merge_requests',
      scope: 'assigned_to_me',
      state: 'opened',
      noItemText: 'There is no MR assigned to you.',
    },
    {
      name: 'Custom GitLab Query for MR',
      type: 'merge_requests',
      scope: 'assigned_to_me',
      state: 'all',
      noItemText: 'There is no MR assigned to you.',
      maxResults: 30,
      labels: ['frontend', 'backend'],
      milestone: '13.6',
      author: 'johndoe',
      assignee: 'johndoe',
      search: 'query',
      createdBefore: '2020-10-11T03:45:40Z',
      createdAfter: '2018-11-01T03:45:40Z',
      updatedBefore: '2020-10-30T03:45:40Z',
      updatedAfter: '2018-11-01T03:45:40Z',
      wip: 'yes',
      orderBy: 'updated_at',
      sort: 'asc',
    },
    {
      name: 'Custom GitLab Query for issues',
      type: 'issues',
      scope: 'assigned_to_me',
      state: 'opened',
      noItemText: 'There is no Issue assigned to you.',
      confidential: true,
      excludeLabels: ['backstage'],
      excludeMilestone: ['13.5'],
      excludeAuthor: 'johndoe',
      excludeAssignee: 'johndoe',
      excludeSearch: 'bug',
      excludeSearchIn: 'description',
    },
  ];

  before(async () => {
    server = getServer([
      createQueryJsonEndpoint('/users', {
        '?username=johndoe': [userResponse],
      }),
      createQueryJsonEndpoint('/projects/278964/merge_requests', {
        '?scope=assigned_to_me&state=opened': [openMergeRequestResponse],
        '?scope=assigned_to_me&state=all&author_id=7237201&assignee_id=7237201&wip=yes&labels=frontend,backend&milestone=13.6&search=query&created_before=2020-10-11T03:45:40Z&created_after=2018-11-01T03:45:40Z&updated_before=2020-10-30T03:45:40Z&updated_after=2018-11-01T03:45:40Z&order_by=updated_at&sort=asc&per_page=30':
          [{ ...openMergeRequestResponse, title: 'Custom Query MR' }],
      }),
      createQueryJsonEndpoint('/projects/278964/issues', {
        '?scope=assigned_to_me&state=opened': [openIssueResponse],
        '?scope=assigned_to_me&state=opened&confidential=true&not[labels]=backstage&not[milestone]=13.5&not[author_username]=johndoe&not[assignee_username]=johndoe&not[search]=bug&not[in]=description':
          [{ ...openIssueResponse, title: 'Custom Query Issue' }],
      }),
    ]);
    // FIXME: if you are touching this configuration statement, move the configuration to extension_configuration.ts
    await vscode.workspace.getConfiguration().update('gitlab.customQueries', customQuerySettings);
  });

  beforeEach(async () => {
    server.resetHandlers();
    dataProvider = new IssuableDataProvider();
    await gitlabProjectRepository.reload();
  });

  after(async () => {
    server.close();
    // FIXME: if you are touching this configuration statement, move the configuration to extension_configuration.ts
    await vscode.workspace.getConfiguration().update('gitlab.customQueries', undefined);
  });

  const getTreeItem = model => dataProvider.getTreeItem(model);

  /**
   * Opens a top level category from the extension issues tree view
   */
  async function openCategory(label) {
    const [projectItem] = await dataProvider.getChildren();
    const categories = await projectItem.getChildren();
    const [chosenCategory] = categories.filter(c => getTreeItem(c).label === label);
    assert(
      chosenCategory,
      `Can't open category ${label} because it's not present in ${categories.map(
        c => getTreeItem(c).label,
      )}`,
    );
    return await dataProvider.getChildren(chosenCategory);
  }

  it('shows project issues assigned to me', async () => {
    const issuesAssignedToMe = await openCategory('Issues assigned to me');

    assert.strictEqual(issuesAssignedToMe.length, 1);
    assert.strictEqual(
      issuesAssignedToMe[0].label,
      '#219925 · Change primary button for editing on files',
    );
  });

  it('shows project merge requests assigned to me', async () => {
    const mergeRequestsAssignedToMe = await openCategory('Merge requests assigned to me');

    assert.strictEqual(mergeRequestsAssignedToMe.length, 1);
    const mrItemModel = mergeRequestsAssignedToMe[0];
    const mrItem = getTreeItem(mrItemModel);
    assert.strictEqual(mrItem.label, '!33824 · Web IDE - remove unused actions (mappings)');
    assert.strictEqual(
      mrItem.iconPath.toString(true),
      `${GITLAB_URL}/uploads/-/system/user/avatar/2398164/avatar.png`,
    );
  });

  it('handles full custom query for MR', async () => {
    const customMergeRequests = await openCategory('Custom GitLab Query for MR');

    assert.strictEqual(customMergeRequests.length, 1);
    assert.strictEqual(getTreeItem(customMergeRequests[0]).label, '!33824 · Custom Query MR');
  });

  it('handles full custom query for issues', async () => {
    const customMergeRequests = await openCategory('Custom GitLab Query for issues');

    assert.strictEqual(customMergeRequests.length, 1);
    assert.strictEqual(getTreeItem(customMergeRequests[0]).label, '#219925 · Custom Query Issue');
  });
});
