import * as vscode from 'vscode';
import { DO_NOT_SHOW_YAML_SUGGESTION } from './constants';

export const setupYamlSupport = (context: vscode.ExtensionContext) => {
  if (vscode.extensions.getExtension('redhat.vscode-yaml')) return;
  if (context.globalState.get(DO_NOT_SHOW_YAML_SUGGESTION)) return;
  vscode.workspace.onDidOpenTextDocument(async document => {
    if (context.globalState.get(DO_NOT_SHOW_YAML_SUGGESTION)) return;
    if (document.fileName.endsWith(`.gitlab-ci.yml`)) {
      const choice = await vscode.window.showInformationMessage(
        "Would you like to install Red Hat's YAML extension to get real-time linting on the .gitlab-ci.yml file?",
        'Yes',
        'Not now',
        "No. Don't ask again.",
      );
      if (choice === 'Yes') {
        await vscode.commands.executeCommand(
          'workbench.extensions.installExtension',
          'redhat.vscode-yaml',
        );
      } else if (choice === "No. Don't ask again.") {
        await context.globalState.update(DO_NOT_SHOW_YAML_SUGGESTION, true);
      }
    }
  });
};
