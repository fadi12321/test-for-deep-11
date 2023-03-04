import * as vscode from 'vscode';
import { doNotAwait } from '../utils/do_not_await';
import { ProjectCommand } from './run_with_valid_project';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { toMergedYamlUri } from '../ci/merged_yaml_uri';
import { log } from '../log';
import { USER_COMMANDS } from '../command_names';
import { prettyJson } from '../errors/common';

export const validateCiConfig: ProjectCommand = async projectInRepository => {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    await vscode.window.showInformationMessage('GitLab Workflow: No open file.');
    return;
  }

  const content = editor.document.getText();
  const { project } = projectInRepository;
  const { valid, errors } = await getGitLabService(projectInRepository).validateCIConfig(
    project,
    content,
  );

  if (valid) {
    doNotAwait(
      vscode.window.showInformationMessage('GitLab Workflow: Your CI configuration is valid.'),
    );
    return;
  }
  doNotAwait(vscode.window.showErrorMessage('GitLab Workflow: Invalid CI configuration.'));
  if (errors[0]) {
    doNotAwait(vscode.window.showErrorMessage(errors[0]));
  }
};

export const showMergedCiConfig: ProjectCommand = async projectInRepository => {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    await vscode.window.showInformationMessage('GitLab Workflow: No open file.');
    return;
  }

  const content = editor.document.getText();
  const { project, pointer } = projectInRepository;
  const { merged_yaml: initial, errors } = await getGitLabService(
    projectInRepository,
  ).validateCIConfig(project, content);

  if (!initial) {
    log.error(`CI Lint errors when merging: ${prettyJson(errors)}`);
    const result = await vscode.window.showErrorMessage(
      'GitLab Workflow: Cannot merge the CI configuration. Check your CI configuration files for errors.',
      'Validate GitLab CI Config',
    );
    if (result) {
      await vscode.commands.executeCommand(USER_COMMANDS.VALIDATE_CI_CONFIG);
    }
    return;
  }

  const uri = toMergedYamlUri({
    path: editor.document.uri.path,
    initial,
    repositoryRoot: pointer.repository.rootFsPath,
  });
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.Beside,
  });
};
