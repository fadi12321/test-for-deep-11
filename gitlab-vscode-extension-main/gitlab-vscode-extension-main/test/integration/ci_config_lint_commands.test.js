const sinon = require('sinon');
const assert = require('assert');
const vscode = require('vscode');
const { rest } = require('msw');
const { EOL } = require('os');
const validCiLintResponse = require('./fixtures/rest/ci_lint_valid.json');
const invalidCiLintResponse = require('./fixtures/rest/ci_lint_invalid.json');
const { getServer } = require('./test_infrastructure/mock_server');
const { API_URL_PREFIX } = require('./test_infrastructure/constants');
const {
  createAndOpenFile,
  closeAndDeleteFile,
  getRepositoryRoot,
  insertTextIntoActiveEditor,
} = require('./test_infrastructure/helpers');
const { USER_COMMANDS } = require('../../src/command_names');
const { fromMergedYamlUri } = require('../../src/ci/merged_yaml_uri');

describe('CI Lint commands', async () => {
  let server;
  let testFileUri;
  const VALID_CI_CONFIG = [`test:`, `  stage: test`, `  script:`, `    - echo 1`].join([EOL]);
  const INVALID_CI_CONFIG = [`test:`, `  stage: test`, `  scccript:`, `    - echo 1`].join([EOL]);
  const sandbox = sinon.createSandbox();

  before(async () => {
    server = getServer([
      rest.post(`${API_URL_PREFIX}/projects/278964/ci/lint`, (req, res, ctx) => {
        switch (req.body.content) {
          case VALID_CI_CONFIG:
            return res(ctx.status(200), ctx.json(validCiLintResponse));
          case INVALID_CI_CONFIG:
            return res(ctx.status(200), ctx.json(invalidCiLintResponse));
          default:
            return res(ctx.status(500), ctx.text('No response for the config'));
        }
      }),
    ]);
  });

  beforeEach(async () => {
    server.resetHandlers();
    testFileUri = vscode.Uri.file(`${getRepositoryRoot()}/.gitlab-ci.yml`);
    await createAndOpenFile(testFileUri);
  });

  afterEach(async () => {
    sandbox.restore();
    await closeAndDeleteFile(testFileUri);
  });

  after(async () => {
    server.close();
  });

  describe('validateCiConfig', () => {
    it('shows info message for valid config', async () => {
      const informationMessageMock = sandbox
        .mock(vscode.window)
        .expects('showInformationMessage')
        .withArgs('GitLab Workflow: Your CI configuration is valid.')
        .resolves();
      await insertTextIntoActiveEditor(VALID_CI_CONFIG);

      await vscode.commands.executeCommand(USER_COMMANDS.VALIDATE_CI_CONFIG);

      informationMessageMock.verify();
    });

    it('shows error message for invalid config', async () => {
      const errorMessages = [];
      sandbox.stub(vscode.window, 'showErrorMessage').callsFake(async msg => {
        errorMessages.push(msg);
      });
      await insertTextIntoActiveEditor(INVALID_CI_CONFIG);

      await vscode.commands.executeCommand(USER_COMMANDS.VALIDATE_CI_CONFIG);

      assert.deepStrictEqual(errorMessages, [
        'GitLab Workflow: Invalid CI configuration.',
        'jobs:test config contains unknown keys: scccript',
      ]);
    });
  });

  describe('showMergedCiConfig', () => {
    it('opens a TextDocument', async () => {
      let openedUri;

      sandbox.stub(vscode.workspace, 'openTextDocument').callsFake(async msg => {
        openedUri = msg;
      });

      await insertTextIntoActiveEditor(VALID_CI_CONFIG);

      await vscode.commands.executeCommand(USER_COMMANDS.SHOW_MERGED_CI_CONFIG);

      const params = fromMergedYamlUri(openedUri);
      assert.strictEqual(params.initial, '# Merged YAML');
    });

    it('shows error message for invalid config', async () => {
      const errorMessages = [];
      sandbox.stub(vscode.window, 'showErrorMessage').callsFake(async msg => {
        errorMessages.push(msg);
      });
      await insertTextIntoActiveEditor(INVALID_CI_CONFIG);

      await vscode.commands.executeCommand(USER_COMMANDS.SHOW_MERGED_CI_CONFIG);

      assert.deepStrictEqual(errorMessages.length, 1);
    });
  });
});
