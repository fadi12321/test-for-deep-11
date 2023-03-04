const assert = require('assert');
const { graphql } = require('msw');
const projectsResponse = require('./fixtures/graphql/projects.json');
const { getServer } = require('./test_infrastructure/mock_server');
const {
  GitLabRemoteSourceProvider,
} = require('../../src/gitlab/clone/gitlab_remote_source_provider');
const { accountService } = require('../../src/accounts/account_service');

const validateRemoteSource = remoteSources => {
  assert.strictEqual(remoteSources.length, 1);

  const [remoteSource] = remoteSources;
  assert.strictEqual(remoteSource.name, '$(repo) gitlab-org/gitlab');
  assert.strictEqual(remoteSource.description, 'The Gitlab Project');
  assert.deepStrictEqual(remoteSource.url, [
    'git@test.gitlab.com:gitlab-org/gitlab.git',
    'https://test.gitlab.com/gitlab-org/gitlab.git',
  ]);
  assert.deepStrictEqual(remoteSource.wikiUrl, [
    'git@test.gitlab.com:gitlab-org/gitlab.wiki.git',
    'https://test.gitlab.com/gitlab-org/gitlab.wiki.git',
  ]);
  assert.strictEqual(remoteSource.project.gqlId, 'gid://gitlab/Project/278964');
};

describe('GitLab Remote Source provider', () => {
  let server;

  const [account] = accountService.getAllAccounts();

  before(async () => {
    server = getServer([
      graphql.query('GetProjects', (req, res, ctx) => {
        if (req.variables.search === 'GitLab') return res(ctx.data(projectsResponse));
        if (req.variables.search === 'nonexistent') return res(ctx.data({ projects: null }));
        return res(ctx.data(projectsResponse));
      }),
    ]);
  });

  after(async () => {
    server.close();
  });

  it('projects are fetched with full search', async () => {
    const sourceProvider = new GitLabRemoteSourceProvider(account);

    const remoteSources = await sourceProvider.getRemoteSources();

    validateRemoteSource(remoteSources);
  });

  it('project search returns one result', async () => {
    const sourceProvider = new GitLabRemoteSourceProvider(account);

    const remoteSources = await sourceProvider.getRemoteSources('GitLab');

    validateRemoteSource(remoteSources);
  });

  it('projects search with nonexistent project returns no result', async () => {
    const sourceProvider = new GitLabRemoteSourceProvider(account);

    assert.deepStrictEqual(
      await sourceProvider.getRemoteSources('nonexistent'),
      [],
      'search for "nonexistent" repository should return no result',
    );
  });
});
