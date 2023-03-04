import * as vscode from 'vscode';
import assert = require('assert');
import * as openers from './commands/openers';
import { UserFriendlyError } from './errors/user_friendly_error';
import { log } from './log';
import { PROGRAMMATIC_COMMANDS, USER_COMMANDS } from './command_names';
import { currentBranchRefresher, TreeState } from './current_branch_refresher';
import { ProjectInRepository } from './gitlab/new_project';

const MAXIMUM_DISPLAYED_JOBS = 4;

// FIXME: if you are touching this configuration statement, move the configuration to extension_configuration.ts
const {
  showStatusBarLinks,
  showIssueLinkOnStatusBar,
  showMrStatusOnStatusBar,
  showPipelineUpdateNotifications,
} = vscode.workspace.getConfiguration('gitlab');

const iconForStatus: Record<string, { icon: string; text?: string } | undefined> = {
  running: { icon: 'pulse' },
  pending: { icon: 'clock' },
  success: { icon: 'check', text: 'passed' },
  failed: { icon: 'x' },
  canceled: { icon: 'circle-slash' },
  skipped: { icon: 'diff-renamed' },
};

const getStatusText = (status: string) => iconForStatus[status]?.text || status;

const createStatusTextFromJobs = (jobs: RestJob[], status: string) => {
  let statusText = getStatusText(status);
  const jobNames = jobs.filter(job => job.status === status).map(job => job.name);
  if (jobNames.length > MAXIMUM_DISPLAYED_JOBS) {
    statusText += ' (';
    statusText += jobNames.slice(0, MAXIMUM_DISPLAYED_JOBS).join(', ');
    statusText += `, +${jobNames.length - MAXIMUM_DISPLAYED_JOBS} jobs`;
    statusText += ')';
  } else if (jobNames.length > 0) {
    statusText += ` (${jobNames.join(', ')})`;
  }
  return statusText;
};

const createStatusBarItem = (
  priority: number,
  id: string,
  name: string,
  initialText: string,
  command?: string | vscode.Command,
) => {
  const statusBarItem = vscode.window.createStatusBarItem(
    id,
    vscode.StatusBarAlignment.Left,
    priority,
  );
  statusBarItem.name = name;
  statusBarItem.text = initialText;
  statusBarItem.show();

  if (command) {
    statusBarItem.command = command;
  }

  return statusBarItem;
};

const openIssuableInWebview = (issuable: RestIssuable, rootFsPath: string): vscode.Command => ({
  title: '',
  command: PROGRAMMATIC_COMMANDS.SHOW_RICH_CONTENT,
  arguments: [issuable, rootFsPath],
});

const sortAndDeduplicate = (jobs: RestJob[]): RestJob[] => {
  const alreadyProcessedJob = new Set();
  const compareTimeNewFirst = (a: RestJob, b: RestJob) =>
    Date.parse(a.created_at) < Date.parse(b.created_at) ? -1 : 1;
  return jobs.sort(compareTimeNewFirst).filter(job => {
    if (alreadyProcessedJob.has(job.name)) {
      return false;
    }
    alreadyProcessedJob.add(job.name);
    return true;
  });
};

export class StatusBar {
  pipelineStatusBarItem?: vscode.StatusBarItem;

  mrStatusBarItem?: vscode.StatusBarItem;

  mrIssueStatusBarItem?: vscode.StatusBarItem;

  #refreshSubscription?: vscode.Disposable;

  firstRun = true;

  async refresh(state: TreeState) {
    if (state.type === 'branch') {
      const { rootFsPath } = state.projectInRepository.pointer.repository;
      await this.updatePipelineItem(state.pipeline, state.jobs, state.projectInRepository);
      this.updateMrItem(state.mr, rootFsPath);
      this.fetchMrClosingIssue(state.mr, state.issues, rootFsPath);
    } else if (state.type === 'tag') {
      await this.updatePipelineItem(state.pipeline, state.jobs, state.projectInRepository);
      this.mrStatusBarItem?.hide();
      this.mrIssueStatusBarItem?.hide();
    } else {
      this.hideAllItems();
    }
  }

  hideAllItems(): void {
    this.pipelineStatusBarItem?.hide();
    this.mrStatusBarItem?.hide();
    this.mrIssueStatusBarItem?.hide();
  }

  async updatePipelineItem(
    pipeline: RestPipeline | undefined,
    jobs: RestJob[],
    projectInRepository: ProjectInRepository,
  ): Promise<void> {
    if (!this.pipelineStatusBarItem) return;
    if (!pipeline) {
      this.pipelineStatusBarItem.text = 'GitLab: No pipeline.';
      this.pipelineStatusBarItem.show();
      this.firstRun = false;
      return;
    }
    const { status } = pipeline;
    let statusText = getStatusText(status);

    if (status === 'running' || status === 'failed') {
      try {
        const processedJobs = sortAndDeduplicate(jobs);
        statusText = createStatusTextFromJobs(processedJobs, status);
      } catch (e) {
        log.error(new UserFriendlyError('Failed to fetch jobs for pipeline.', e));
      }
    }

    const msg = `$(${iconForStatus[status]?.icon}) GitLab: Pipeline ${statusText}`;

    if (
      showPipelineUpdateNotifications &&
      this.pipelineStatusBarItem.text !== msg &&
      !this.firstRun
    ) {
      const message = `Pipeline ${statusText}.`;

      await vscode.window
        .showInformationMessage(message, { modal: false }, 'View in Gitlab')
        .then(async selection => {
          if (selection === 'View in Gitlab') {
            await openers.openCurrentPipeline(projectInRepository);
          }
        });
    }

    this.pipelineStatusBarItem.text = msg;
    this.pipelineStatusBarItem.show();
    this.firstRun = false;
  }

  fetchMrClosingIssue(
    mr: RestMr | undefined,
    closingIssues: RestIssuable[],
    rootFsPath: string,
  ): void {
    if (!this.mrIssueStatusBarItem) return;
    if (mr) {
      let text = `$(code) GitLab: No issue.`;
      let command;

      const firstIssue = closingIssues[0];
      if (firstIssue) {
        text = `$(code) GitLab: Issue #${firstIssue.iid}`;
        command = openIssuableInWebview(firstIssue, rootFsPath);
      }

      this.mrIssueStatusBarItem.text = text;
      this.mrIssueStatusBarItem.command = command;
      this.mrIssueStatusBarItem.show();
    } else {
      this.mrIssueStatusBarItem.hide();
    }
  }

  updateMrItem(mr: RestMr | undefined, rootFsPath: string): void {
    if (!this.mrStatusBarItem) return;
    this.mrStatusBarItem.show();
    this.mrStatusBarItem.command = mr
      ? openIssuableInWebview(mr, rootFsPath)
      : USER_COMMANDS.OPEN_CREATE_NEW_MR;
    this.mrStatusBarItem.text = mr
      ? `$(git-pull-request) GitLab: MR !${mr.iid}`
      : '$(git-pull-request) GitLab: Create MR.';
  }

  init(): void {
    assert(!this.pipelineStatusBarItem, 'The status bar is already initialized');
    if (showStatusBarLinks) {
      this.#refreshSubscription = currentBranchRefresher.onStateChanged(e => this.refresh(e));
      this.pipelineStatusBarItem = createStatusBarItem(
        2,
        'gl.status.pipeline',
        'GitLab Workflow: Pipeline',
        '$(info) GitLab: Fetching pipeline...',
        USER_COMMANDS.PIPELINE_ACTIONS,
      );
      if (showMrStatusOnStatusBar) {
        this.mrStatusBarItem = createStatusBarItem(
          1,
          'gl.status.mr',
          'GitLab Workflow: Merge Request',
          '$(info) GitLab: Finding MR...',
        );
        if (showIssueLinkOnStatusBar) {
          this.mrIssueStatusBarItem = createStatusBarItem(
            0,
            'gl.status.issue',
            'GitLab Workflow: Issue',
            '$(info) GitLab: Fetching closing issue...',
          );
        }
      }
    }
  }

  dispose(): void {
    if (showStatusBarLinks) {
      this.#refreshSubscription?.dispose();
      this.pipelineStatusBarItem?.dispose();

      if (showIssueLinkOnStatusBar) {
        this.mrIssueStatusBarItem?.dispose();
      }
      if (showMrStatusOnStatusBar) {
        this.mrStatusBarItem?.dispose();
      }
    }
  }
}

export const statusBar = new StatusBar();
