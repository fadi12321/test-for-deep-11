const vscode = require('vscode');
const sinon = require('sinon');
const pipelinesResponse = require('./fixtures/rest/pipelines.json');
const {
  getServer,
  createTextEndpoint,
  createQueryJsonEndpoint,
  createPostEndpoint,
} = require('./test_infrastructure/mock_server');
const { simulateQuickPickChoice } = require('./test_infrastructure/helpers');
const { currentBranchRefresher } = require('../../src/current_branch_refresher');
const { USER_COMMANDS } = require('../../src/command_names');

describe('Pipeline actions', async () => {
  let server;
  const sandbox = sinon.createSandbox();

  before(async () => {
    server = getServer([
      createQueryJsonEndpoint('/projects/278964/pipelines', { '?ref=master': pipelinesResponse }),
      createTextEndpoint(
        '/projects/278964/snippets/222/files/master/test2.js/raw',
        'second blob content',
      ),
      createPostEndpoint('/projects/278964/pipeline', pipelinesResponse[0]), // simulating returning a newly created pipeline
    ]);
  });

  beforeEach(async () => {
    server.resetHandlers();
    // we don't want the periodic refreshing to interfere with the tests
    currentBranchRefresher.stopTimers();
  });

  afterEach(async () => {
    sandbox.restore();
  });

  after(async () => {
    server.close();
  });

  it('creates a new pipeline', async () => {
    simulateQuickPickChoice(sandbox, 2); // Create a new pipeline from current branch

    const originalExecuteCommand = vscode.commands.executeCommand;
    const expectation = sandbox
      .mock(vscode.commands)
      .expects('executeCommand')
      .once()
      .withArgs(USER_COMMANDS.REFRESH_SIDEBAR);

    await originalExecuteCommand(USER_COMMANDS.PIPELINE_ACTIONS);
    expectation.verify();
  });
});
