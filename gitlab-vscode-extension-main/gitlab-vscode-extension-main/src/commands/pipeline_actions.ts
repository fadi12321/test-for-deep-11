import * as vscode from 'vscode';
import { USER_COMMANDS } from '../command_names';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { ProjectInRepositoryProvider } from '../gitlab/new_project';
import { PipelineProvider } from '../tree_view/items/pipeline_provider';
import { PipelineItemModel } from '../tree_view/items/pipeline_item_model';

async function retryOrCancelPipeline(
  action: 'retry' | 'cancel',
  provider: PipelineProvider & ProjectInRepositoryProvider,
): Promise<RestPipeline | undefined> {
  const { pipeline, projectInRepository } = provider;
  const gitlabService = getGitLabService(projectInRepository);
  const result = await gitlabService.cancelOrRetryPipeline(
    action,
    projectInRepository.project,
    pipeline,
  );
  if (result) await vscode.commands.executeCommand(USER_COMMANDS.REFRESH_SIDEBAR);
  return result;
}

export function retryPipeline(item: PipelineItemModel): Promise<RestPipeline | undefined> {
  return retryOrCancelPipeline('retry', item);
}

export function cancelPipeline(item: PipelineItemModel): Promise<RestPipeline | undefined> {
  return retryOrCancelPipeline('cancel', item);
}
