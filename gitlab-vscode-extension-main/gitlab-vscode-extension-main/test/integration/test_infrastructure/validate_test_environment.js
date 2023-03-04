const vscode = require('vscode');

const validateTestEnvironment = () => {
  if (!vscode.workspace.workspaceFolders) {
    throw new Error(`
    Your test workspace is not properly setup!
    Please run "npm run create-test-workspace". You can also read the docs at:
    https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/developer/writing-tests.md#debugging-integration-tests
    `);
  }
};

module.exports = { validateTestEnvironment };
