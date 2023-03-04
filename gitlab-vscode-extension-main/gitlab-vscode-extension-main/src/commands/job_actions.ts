import * as vscode from 'vscode';
import { USER_COMMANDS } from '../command_names';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { JobItemModel } from '../tree_view/items/job_item_model';

async function retryOrCancelJobItemModel(
  action: 'retry' | 'cancel' | 'play',
  item: JobItemModel,
): Promise<RestJob | undefined> {
  const { job, projectInRepository } = item;
  const gitlabService = getGitLabService(projectInRepository);
  const result = await gitlabService.cancelOrRetryJob(action, projectInRepository.project, job);
  if (result) await vscode.commands.executeCommand(USER_COMMANDS.REFRESH_SIDEBAR);
  return result;
}

export function executeJob(item: JobItemModel): Promise<RestJob | undefined> {
  return retryOrCancelJobItemModel('play', item);
}

export function retryJob(item: JobItemModel): Promise<RestJob | undefined> {
  return retryOrCancelJobItemModel('retry', item);
}

export function cancelJob(item: JobItemModel): Promise<RestJob | undefined> {
  return retryOrCancelJobItemModel('cancel', item);
}
