const vscode = require('vscode');
const { USER_COMMANDS } = require('../../../src/command_names');
const { extensionState } = require('../../../src/extension_state');
const { gitExtensionWrapper } = require('../../../src/git/git_extension_wrapper');
const { gitlabProjectRepository } = require('../../../src/gitlab/gitlab_project_repository');
const { selectedProjectStore } = require('../../../src/gitlab/selected_project_store');
const { accountService } = require('../../../src/accounts/account_service');
const { webviewController } = require('../../../src/webview_controller');
const { GITLAB_URL } = require('./constants');
const { InMemoryMemento } = require('./in_memory_memento');
const { getServer } = require('./mock_server');

const rejectAfter = (reason, durationInMs) =>
  new Promise((res, rej) => {
    setTimeout(() => rej(new Error(reason)), durationInMs);
  });

const ensureProject = async () => {
  await gitExtensionWrapper.init();
  await gitlabProjectRepository.init();
  const projects = gitlabProjectRepository.getDefaultAndSelectedProjects();
  if (projects.length > 0) return undefined;
  const createPromiseThatResolvesWhenRepoCountChanges = () =>
    new Promise(resolve => {
      const sub = gitlabProjectRepository.onProjectChange(() => {
        sub.dispose();
        resolve(undefined);
      });
    });
  return createPromiseThatResolvesWhenRepoCountChanges();
};

const initializeTestEnvironment = async testRoot => {
  accountService.init({ globalState: new InMemoryMemento() });
  process.env.GITLAB_WORKFLOW_INSTANCE_URL = GITLAB_URL;
  process.env.GITLAB_WORKFLOW_TOKEN = 'abcd-secret';
  extensionState.init(accountService);
  webviewController.init({ extensionPath: `${testRoot}/../../..` });
  selectedProjectStore.init({ globalState: new InMemoryMemento() });
  const ext = vscode.extensions.getExtension('gitlab.gitlab-workflow');
  // run the extension activation and project load with a mock server
  const server = getServer();
  await ext.activate();
  await Promise.race([ensureProject(), rejectAfter('No project after 5s', 5000)]);
  await vscode.commands.executeCommand(USER_COMMANDS.REFRESH_SIDEBAR);
  server.close();
};

module.exports = { initializeTestEnvironment };
