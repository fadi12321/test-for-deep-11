import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import assert from 'assert';
import { currentBranchRefresher, TreeState } from '../current_branch_refresher';
import { getJobMetadata } from '../gitlab/ci_status_metadata';
import { JobItemModel } from '../tree_view/items/job_item_model';
import { cancelJob, executeJob, retryJob } from '../commands/job_actions';
import { toJobLogUri } from './job_log_uri';
import { log } from '../log';
import { hasTraceAvailable } from '../utils/has_trace_available';

const buttonTexts = {
  executable: 'Trigger this manual action',
  retryable: 'Retry this job',
  cancellable: 'Cancel this job',
};

type WebViewPanelWithData = vscode.WebviewPanel & {
  jobItemModel: JobItemModel;
};

const openAndShowTextDocument = async (
  uri: vscode.Uri,
  viewColumn: vscode.ViewColumn | undefined,
) => {
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, {
    preserveFocus: true,
    viewColumn,
  });
};

const replaceWebviewWithTraceview = async (
  jobItemModel: JobItemModel,
  existingPanel: WebViewPanelWithData,
) => {
  if (!existingPanel.visible) {
    // eslint-disable-next-line no-param-reassign
    existingPanel.jobItemModel = jobItemModel;
    return;
  }
  const { job, projectInRepository } = jobItemModel;

  const uri = toJobLogUri(projectInRepository.pointer.repository.rootFsPath, job.id);
  await openAndShowTextDocument(uri, existingPanel.viewColumn);
  existingPanel.dispose();
};

export class PendingJobWebviewController {
  async init(context: vscode.ExtensionContext) {
    this.#context = context;

    currentBranchRefresher.onStateChanged(state =>
      this.refresh(state).catch(err => log.error(err)),
    );
    this.#htmlContent = await fs.readFile(
      path.join(this.#context.extensionPath, 'src/webview/public/pendingjob.html'),
      'utf-8',
    );
  }

  #context?: vscode.ExtensionContext;

  #panel?: WebViewPanelWithData;

  #htmlContent = '';

  async refresh(state: TreeState) {
    const panel = this.#panel;
    if (state.type === 'invalid' || !panel) return;

    const updatedPanelJob = state.jobs.find(j => j.id === panel.jobItemModel.job.id);
    if (updatedPanelJob && panel.jobItemModel.job.status !== updatedPanelJob.status) {
      const jobItemModel = new JobItemModel(state.projectInRepository, updatedPanelJob);
      if (hasTraceAvailable(updatedPanelJob)) {
        await replaceWebviewWithTraceview(jobItemModel, panel);
      } else {
        await this.createOrUpdateWebview(jobItemModel, panel);
      }
    }
  }

  async #createEmptyPanel(): Promise<WebViewPanelWithData> {
    const panel = vscode.window.createWebviewPanel(
      'gitlab.waitForPendingJob',
      '',
      vscode.ViewColumn.Active,
      { enableScripts: true },
    ) as WebViewPanelWithData;

    this.#panel = panel;
    panel.webview.onDidReceiveMessage(async () => {
      const { job, projectInRepository } = panel.jobItemModel;
      try {
        switch (getJobMetadata(job).contextAction) {
          case 'retryable':
            {
              // GitLab will create a new job when we ask for a retry. The result of
              // `retryJob()` is used to track the newly created job in the existing panel.
              const newJob = await retryJob(panel.jobItemModel);
              if (newJob) {
                await this.createOrUpdateWebview(
                  new JobItemModel(projectInRepository, newJob),
                  panel,
                );
              }
            }
            break;
          case 'cancellable':
            await cancelJob(panel.jobItemModel);
            break;
          case 'executable':
            // Executing a manual job will update the existing job, so updating the webview
            // is not required here.
            await executeJob(panel.jobItemModel);
            break;
          default:
            break;
        }
      } finally {
        await panel.webview.postMessage('resetButton');
      }
    });

    panel.onDidDispose(() => {
      if (this.#panel === panel) {
        this.#panel = undefined;
      }
    });

    panel.onDidChangeViewState(async () => {
      if (!panel.visible) return;

      const { job: newJob } = panel.jobItemModel;
      if (hasTraceAvailable(newJob)) {
        await replaceWebviewWithTraceview(panel.jobItemModel, panel);
      }
    });

    return panel;
  }

  async createOrUpdateWebview(
    jobItemModel: JobItemModel,
    existingPanel?: WebViewPanelWithData,
  ): Promise<WebViewPanelWithData> {
    assert(this.#context);
    const { job } = jobItemModel;
    const existingPanelStatus = existingPanel?.jobItemModel.job.status;
    const panel = existingPanel ?? (await this.#createEmptyPanel());

    panel.title = `Job ${job.id}`;
    panel.jobItemModel = jobItemModel;

    if (job.status !== existingPanelStatus) {
      const status = getJobMetadata(job);

      const imgTag = status.illustration?.image
        ? `<img src="${panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(this.#context.extensionPath, status.illustration?.image)),
          )}" />`
        : '';

      const buttonTag = status.contextAction
        ? `<button id="button" onclick="onButtonPress()">${
            buttonTexts[status.contextAction]
          }</button>`
        : '';

      panel.webview.html = this.#htmlContent
        .replace('{{title}}', status.illustration?.title ?? status.name)
        .replace('{{description}}', status.illustration?.description ?? '')
        .replace('{{image}}', imgTag)
        .replace('{{button}}', buttonTag);
    }

    return panel;
  }

  async waitForPendingJob(item: JobItemModel): Promise<WebViewPanelWithData> {
    const panel = await this.createOrUpdateWebview(item, this.#panel);
    panel.reveal();
    return panel;
  }
}

export const pendingWebviewController = new PendingJobWebviewController();
