import * as vscode from 'vscode';
import { openCurrentPipeline } from './openers';
import { ProjectCommand } from './run_with_valid_project';
import { USER_COMMANDS } from '../command_names';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { getTrackingBranchName } from '../git/get_tracking_branch_name';
import { currentBranchRefresher } from '../current_branch_refresher';
import { JobProvider } from '../tree_view/items/job_provider';
import { PipelineProvider } from '../tree_view/items/pipeline_provider';
import { ProjectInRepositoryProvider } from '../gitlab/new_project';
import { DetachedHeadError } from '../errors/detached_head_error';

type PipelineAction = 'view' | 'download' | 'create' | 'retry' | 'cancel';

export const triggerPipelineAction: ProjectCommand = async projectInRepository => {
  const items: { label: string; action: PipelineAction }[] = [
    {
      label: 'View Latest Pipeline on GitLab',
      action: 'view',
    },
    {
      label: 'Download Artifacts from Latest Pipeline',
      action: 'download',
    },
    {
      label: 'Create New Pipeline from Current Branch',
      action: 'create',
    },
    {
      label: 'Retry Last Pipeline',
      action: 'retry',
    },
    {
      label: 'Cancel Last Pipeline',
      action: 'cancel',
    },
  ];

  const selected = await vscode.window.showQuickPick(items);

  if (selected) {
    if (selected.action === 'view') {
      await openCurrentPipeline(projectInRepository);
      return;
    }

    const { project } = projectInRepository;
    const { repository } = projectInRepository.pointer;
    const gitlabService = getGitLabService(projectInRepository);

    if (selected.action === 'create') {
      const branchName = await getTrackingBranchName(repository.rawRepository);
      if (!branchName) throw new DetachedHeadError();
      const result = await gitlabService.createPipeline(branchName, project);
      if (result) await vscode.commands.executeCommand(USER_COMMANDS.REFRESH_SIDEBAR);
      return;
    }

    const branchState = await currentBranchRefresher.getOrRetrieveState();

    if (branchState.type === 'invalid') {
      await vscode.window.showErrorMessage(
        "Can't fetch pipeline for current repository. Check that your project is correctly initialized.",
      );
      return;
    }

    const { pipeline } = branchState;

    if (!pipeline) {
      await vscode.window.showErrorMessage('GitLab Workflow: No project or pipeline found.');
      return;
    }

    const command = {
      download: USER_COMMANDS.DOWNLOAD_ARTIFACTS,
      retry: USER_COMMANDS.RETRY_FAILED_PIPELINE_JOBS,
      cancel: USER_COMMANDS.CANCEL_PIPELINE,
    }[selected.action];

    const pipelineJobsAndProject: PipelineProvider & JobProvider & ProjectInRepositoryProvider = {
      projectInRepository,
      pipeline,
      jobs: branchState.jobs,
    };

    await vscode.commands.executeCommand(command, pipelineJobsAndProject);
  }
};
