import * as vscode from 'vscode';

export const getUserAgentHeader = (): Record<string, string> => {
  const extension = vscode.extensions.getExtension('GitLab.gitlab-workflow');
  const extensionVersion = extension?.packageJSON?.version;
  const nodePlatform = `Node.js/${process.version.substr(1)} (${process.platform}; ${
    process.arch
  })`;
  const vsCodeVersion = vscode.version;
  return {
    'User-Agent': `vs-code-gitlab-workflow/${extensionVersion} VSCode/${vsCodeVersion} ${nodePlatform}`,
  };
};
