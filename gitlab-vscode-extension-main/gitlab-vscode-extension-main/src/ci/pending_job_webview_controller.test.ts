import * as vscode from 'vscode';
import { cancelJob, executeJob, retryJob } from '../commands/job_actions';
import { TreeState } from '../current_branch_refresher';
import { asMock } from '../test_utils/as_mock';
import { job, projectInRepository, createExtensionContext } from '../test_utils/entities';
import { JobItemModel } from '../tree_view/items/job_item_model';
import { PendingJobWebviewController } from './pending_job_webview_controller';

jest.mock('../commands/job_actions');
jest.mock('../gitlab/get_gitlab_service');
jest.mock('../gitlab/gitlab_project_repository');

const callFirstListener = async (mock: any) => asMock(mock).mock.lastCall[0]();

describe('PendingJobWebviewController', () => {
  let controller: PendingJobWebviewController;

  const pendingJobModel = new JobItemModel(projectInRepository, {
    ...job,
    status: 'pending',
    started_at: undefined,
  });

  beforeEach(async () => {
    asMock(vscode.window.createWebviewPanel).mockImplementation(() => ({
      webview: {
        onDidReceiveMessage: jest.fn(),
        asWebviewUri: jest.fn().mockImplementation(url => url),
        postMessage: jest.fn(),
      },
      onDidDispose: jest.fn(),
      onDidChangeViewState: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn(),
    }));

    controller = new PendingJobWebviewController();
    await controller.init(createExtensionContext());
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a new panel', async () => {
    const panel = await controller.waitForPendingJob(pendingJobModel);
    expect(panel.jobItemModel.job.status).toBe('pending');
    expect(panel.title).toBe('Job 1');
    expect(panel.webview.html).toContain('This job has not started yet');
  });

  describe('Button', () => {
    it('can cancel a job', async () => {
      const panel = await controller.waitForPendingJob(pendingJobModel);
      await callFirstListener(panel.webview.onDidReceiveMessage);

      expect(cancelJob).toBeCalled();
    });
    it('can execute a manual job', async () => {
      const manualJobModel = new JobItemModel(projectInRepository, { ...job, status: 'manual' });
      const panel = await controller.waitForPendingJob(manualJobModel);
      await callFirstListener(panel.webview.onDidReceiveMessage);

      expect(executeJob).toBeCalled();
    });
    it('can retry a job', async () => {
      const canceledJob: RestJob = { ...job, status: 'canceled' };
      const retriedJob: RestJob = { ...canceledJob, id: canceledJob.id + 1, status: 'pending' };
      const canceledJobModel = new JobItemModel(projectInRepository, canceledJob);
      asMock(retryJob).mockResolvedValue(retriedJob);

      const panel = await controller.waitForPendingJob(canceledJobModel);
      expect(panel.jobItemModel.job.id).toBe(canceledJob.id);
      expect(panel.webview.html).toContain('This job has been canceled');
      expect(panel.webview.html).toContain(
        '<button id="button" onclick="onButtonPress()">Retry this job</button>',
      );
      await callFirstListener(panel.webview.onDidReceiveMessage);

      expect(retryJob).toBeCalled();
      expect(panel.jobItemModel.job.id).toBe(retriedJob.id);
      expect(panel.webview.html).toContain('This job has not started yet');
    });
  });

  describe('refresh', () => {
    const treeState: TreeState = {
      type: 'branch',
      projectInRepository,
      issues: [],
      userInitiated: false,
      jobs: [],
    };

    it('does nothing when no panels exist', async () => {
      await controller.refresh(treeState);
      expect(vscode.window.createWebviewPanel).not.toBeCalled();
    });
    it('changes the status of active panel', async () => {
      const panel = await controller.waitForPendingJob(pendingJobModel);

      await controller.refresh({
        ...treeState,
        jobs: [{ ...job, started_at: undefined, status: 'canceled' }],
      });

      expect(panel.jobItemModel.job.status).toBe('canceled');
    });
    it('replaces active panel', async () => {
      const panel = await controller.waitForPendingJob(pendingJobModel);
      (panel as any).visible = true;

      await controller.refresh({
        ...treeState,
        jobs: [job],
      });
      expect(panel.dispose).toBeCalled();
      expect(vscode.window.showTextDocument).toBeCalled();
    });
    it('ignores other changes', async () => {
      const panel = await controller.waitForPendingJob(pendingJobModel);

      await controller.refresh({
        ...treeState,
        jobs: [{ ...job, id: job.id + 1, status: 'canceled' }],
      });

      expect(panel.jobItemModel.job.status).toBe('pending');
    });

    describe('replacing webview with job trace', () => {
      it('works for visible tabs', async () => {
        const panel = await controller.waitForPendingJob(pendingJobModel);
        (panel as any).visible = true;

        await controller.refresh({
          ...treeState,
          jobs: [{ ...job, status: 'running' }],
        });
        expect(panel.dispose).toBeCalled();
        expect(vscode.window.showTextDocument).toBeCalled();
      });
      it('works for background tabs', async () => {
        const panel = await controller.waitForPendingJob(pendingJobModel);
        await controller.refresh({
          ...treeState,
          jobs: [{ ...job, status: 'running' }],
        });

        expect(asMock(panel.dispose)).not.toBeCalled();

        (panel as any).visible = true;
        await callFirstListener(panel.onDidChangeViewState);

        expect(panel.dispose).toBeCalled();
        expect(vscode.window.showTextDocument).toBeCalled();
      });
    });
  });
});
