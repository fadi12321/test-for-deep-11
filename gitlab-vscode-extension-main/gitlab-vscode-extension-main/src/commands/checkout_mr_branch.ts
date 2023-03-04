import * as vscode from 'vscode';
import assert from 'assert';
import { MrItemModel } from '../tree_view/items/mr_item_model';
import { VS_COMMANDS } from '../command_names';
import { getLastCommitSha } from '../git/get_last_commit_sha';
import { checkout } from '../git/checkout';

const handleGitError = async (e: { stderr: string }) => {
  const SEE_GIT_LOG = 'See Git Log';
  const choice = await vscode.window.showErrorMessage(`Checkout failed: ${e.stderr}`, SEE_GIT_LOG);
  if (choice === SEE_GIT_LOG) {
    await vscode.commands.executeCommand(VS_COMMANDS.GIT_SHOW_OUTPUT);
  }
};
/**
 * Command will checkout source branch for merge request. Merge request must be from local branch.
 */
export const checkoutMrBranch = async (mrItemModel: MrItemModel): Promise<void> => {
  const { mr } = mrItemModel;
  assert(
    mr.target_project_id === mr.source_project_id,
    'this command is only available for same-project MRs',
  );
  try {
    const { projectInRepository } = mrItemModel;
    const { rawRepository } = projectInRepository.pointer.repository;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Checking out ${mr.source_branch}` },
      async () => {
        await rawRepository.fetch();
        await checkout(rawRepository, mr.source_branch);
      },
    );

    if (getLastCommitSha(rawRepository) !== mr.sha) {
      await vscode.window.showWarningMessage(
        `Branch changed to ${mr.source_branch}, but it's out of sync with the remote branch. Synchronize it by pushing or pulling.`,
      );
      return;
    }
    await vscode.window.showInformationMessage(`Branch changed to ${mr.source_branch}`);
  } catch (e) {
    if (e.gitErrorCode) {
      await handleGitError(e);
      return;
    }
    throw e;
  }
};
