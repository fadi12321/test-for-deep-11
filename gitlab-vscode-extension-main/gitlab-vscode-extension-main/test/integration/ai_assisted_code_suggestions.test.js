const assert = require('assert');
const sinon = require('sinon');
const vscode = require('vscode');
const aiAssistedCodeSuggestionsResponse = require('./fixtures/rest/ai_assisted_code_suggestions_response.json');
const {
  getServer,
  createQueryJsonEndpoint,
  createJsonPostEndpoint,
} = require('./test_infrastructure/mock_server');
const {
  createAndOpenFile,
  closeAndDeleteFile,
  insertTextIntoActiveEditor,
  getRepositoryRoot,
} = require('./test_infrastructure/helpers');

describe('AI Assist code completion', async () => {
  let server;
  let testFileUri;
  const sandbox = sinon.createSandbox();
  const config = vscode.workspace.getConfiguration('gitlab.aiAssistedCodeSuggestions');
  const beginEngine = config.get('engine');

  before(async () => {
    server = getServer([
      createQueryJsonEndpoint('/ai/aiassist', { user_is_allowed: true }),
      createJsonPostEndpoint(
        '/v1/completions',
        aiAssistedCodeSuggestionsResponse,
        'https://codesuggestions.gitlab.com',
      ),
    ]);
    config.update('engine', 'GitLab');
    config.update('manualTrigger', true);
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
    config.update('engine', beginEngine);
    config.update('manualTrigger', false);
  });

  // This test relies on timeout and is regularly failing integration tests
  // See https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/677
  xit('Insert AI Assist suggestion', async () => {
    await insertTextIntoActiveEditor('import pandas as pd');

    await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    // Sleep because otherwise it doesn't work
    // eslint-disable-next-line no-promise-executor-return
    await new Promise(r => setTimeout(r, 1500));

    // Accept suggestion
    await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');

    assert.strictEqual(
      // Convert windows break lines
      vscode.window.activeTextEditor.document.getText().replace(/\r\n/g, '\n'),
      'import pandas as pd\nimport numpy as np\nimport matplotlib.pyplot as pl',
    );
  });
});
