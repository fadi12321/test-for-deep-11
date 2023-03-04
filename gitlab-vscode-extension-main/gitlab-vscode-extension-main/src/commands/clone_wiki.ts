import * as vscode from 'vscode';
import { VS_COMMANDS } from '../command_names';
import { remoteForProject } from '../gitlab/clone/gitlab_remote_source_provider';
import { getGitLabServiceForAccount } from '../gitlab/get_gitlab_service';
import { pickAccount } from '../gitlab/pick_account';
import { pickProject } from '../gitlab/pick_project';

export async function cloneWiki(): Promise<void> {
  const account = await pickAccount();
  if (!account) {
    return;
  }

  const project = await pickProject(getGitLabServiceForAccount(account));
  if (!project) {
    return;
  }

  const selectedUrl = await vscode.window.showQuickPick(remoteForProject(project).wikiUrl, {
    ignoreFocusOut: true,
    placeHolder: 'Select URL to clone from',
  });

  if (!selectedUrl) {
    return;
  }

  await vscode.commands.executeCommand(VS_COMMANDS.GIT_CLONE, selectedUrl);
}
