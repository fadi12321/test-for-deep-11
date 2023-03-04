const sinon = require('sinon');
const vscode = require('vscode');
const { getServer, createPostEndpoint } = require('./test_infrastructure/mock_server');
const { GITLAB_URL } = require('./test_infrastructure/constants');
const {
  createAndOpenFile,
  closeAndDeleteFile,
  simulateQuickPickChoice,
  getRepositoryRoot,
} = require('./test_infrastructure/helpers');
const { USER_COMMANDS } = require('../../src/command_names');

describe('Create snippet', async () => {
  let server;
  let testFileUri;
  const sandbox = sinon.createSandbox();
  const snippetUrl = `${GITLAB_URL}/gitlab-org/gitlab/snippets/1`;

  before(async () => {
    server = getServer([
      createPostEndpoint('/projects/278964/snippets', {
        web_url: snippetUrl,
      }),
    ]);
  });

  beforeEach(async () => {
    server.resetHandlers();
    testFileUri = vscode.Uri.file(`${getRepositoryRoot()}/newfile.js`);
    await createAndOpenFile(testFileUri);
  });

  afterEach(async () => {
    sandbox.restore();
    await closeAndDeleteFile(testFileUri);
  });

  after(async () => {
    server.close();
  });

  it('creates snippet form the file', async () => {
    simulateQuickPickChoice(sandbox, 0);
    const originalExecuteCommand = vscode.commands.executeCommand;
    const expectation = sandbox
      .mock(vscode.commands)
      .expects('executeCommand')
      .once()
      .withArgs('vscode.open', snippetUrl);

    await originalExecuteCommand(USER_COMMANDS.CREATE_SNIPPET);
    expectation.verify();
  });
});
