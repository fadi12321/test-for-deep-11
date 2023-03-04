import * as vscode from 'vscode';
import { USER_COMMANDS } from '../command_names';
import { currentBranchRefresher, BranchState } from '../current_branch_refresher';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { GitLabService } from '../gitlab/gitlab_service';
import { asMock } from '../test_utils/as_mock';
import { job, pipeline, projectInRepository } from '../test_utils/entities';
import { triggerPipelineAction } from './trigger_pipeline_action';

jest.mock('../current_branch_refresher');
jest.mock('../gitlab/get_gitlab_service');

describe('triggerPipelineAction', () => {
  const jobs = [job];
  const gitLabService: Partial<GitLabService> = {
    cancelOrRetryPipeline: jest.fn(),
  };

  beforeEach(() => {
    const branchState: BranchState = {
      type: 'branch',
      issues: [],
      jobs,
      userInitiated: false,
      projectInRepository,
      pipeline,
    };
    asMock(currentBranchRefresher.getOrRetrieveState).mockReturnValue(branchState);
    asMock(getGitLabService).mockReturnValue(gitLabService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('can download artifacts', async () => {
    asMock(vscode.window.showQuickPick).mockImplementation(options => options[1]);

    await triggerPipelineAction(projectInRepository);
    expect(vscode.commands.executeCommand).toBeCalled();

    const [command, jobProvider] = asMock(vscode.commands.executeCommand).mock.lastCall;
    expect(command).toBe(USER_COMMANDS.DOWNLOAD_ARTIFACTS);
    expect(jobProvider.jobs).toBe(jobs);
  });

  it('can retry pipelines', async () => {
    asMock(vscode.window.showQuickPick).mockImplementation(options => options[3]);

    await triggerPipelineAction(projectInRepository);
    expect(vscode.commands.executeCommand).toBeCalled();

    const [command, itemModel] = asMock(vscode.commands.executeCommand).mock.lastCall;
    expect(command).toBe(USER_COMMANDS.RETRY_FAILED_PIPELINE_JOBS);
    expect(itemModel.pipeline).toBe(pipeline);
  });

  it('can cancel pipelines', async () => {
    asMock(vscode.window.showQuickPick).mockImplementation(options => options[4]);

    await triggerPipelineAction(projectInRepository);
    expect(vscode.commands.executeCommand).toBeCalled();

    const [command, itemModel] = asMock(vscode.commands.executeCommand).mock.lastCall;
    expect(command).toBe(USER_COMMANDS.CANCEL_PIPELINE);
    expect(itemModel.pipeline).toBe(pipeline);
  });
});
