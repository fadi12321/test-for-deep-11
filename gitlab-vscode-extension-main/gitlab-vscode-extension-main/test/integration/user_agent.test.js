const vscode = require('vscode');
const { setupServer } = require('msw/node');
const { graphql } = require('msw');
const assert = require('assert');
const { GITLAB_URL } = require('./test_infrastructure/constants');
const { GitLabService } = require('../../src/gitlab/gitlab_service');
const { snippetsResponse } = require('./fixtures/graphql/snippets');
const packageJson = require('../../package.json');

const validateUserAgent = req => {
  const userAgent = req.headers.get('User-Agent');
  const nodeJsVersion = `${process.version.substr(1)} (${process.platform}; ${process.arch})`;

  assert.strictEqual(
    userAgent,
    `vs-code-gitlab-workflow/${packageJson.version} VSCode/${vscode.version} Node.js/${nodeJsVersion}`,
  );
};

describe('User-Agent header', () => {
  let server;
  let capturedRequest;

  before(async () => {
    server = setupServer(
      graphql.query('GetSnippets', (req, res, ctx) => {
        capturedRequest = req;
        return res(ctx.data(snippetsResponse));
      }),
    );
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
    capturedRequest = undefined;
  });

  after(async () => {
    server.close();
  });

  it('is sent with requests from GitLabService', async () => {
    const subject = new GitLabService({ instanceUrl: GITLAB_URL, token: 'token' });
    await subject.getSnippets('gitlab-org/gitlab');
    validateUserAgent(capturedRequest);
  });
});
