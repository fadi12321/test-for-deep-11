import * as vscode from 'vscode';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getJobMetadata } from '../../gitlab/ci_status_metadata';
import { ItemModel } from './item_model';
import { openInBrowserCommand } from '../../utils/open_in_browser_command';
import { JobProvider } from './job_provider';
import { ProjectInRepository } from '../../gitlab/new_project';
import { hasDownloadableArtifacts } from '../../utils/has_downloadable_artifacts';
import { toJobLogUri } from '../../ci/job_log_uri';
import { USER_COMMANDS, VS_COMMANDS } from '../../command_names';
import { hasTraceAvailable } from '../../utils/has_trace_available';

dayjs.extend(relativeTime);

const getJobItemContextValue = (job: RestJob) => {
  if (job.stage === 'external') {
    return '';
  }

  const contextValue: string[] = [];

  const { contextAction } = getJobMetadata(job);
  contextValue.push(`${contextAction ?? 'inactive'}-job`);
  if (hasDownloadableArtifacts([job])) {
    contextValue.push('with-artifacts');
  }
  if (hasTraceAvailable(job)) {
    contextValue.push('with-trace');
  } else {
    contextValue.push('pending-job');
  }
  if (job.web_url) {
    contextValue.push('with-url');
  }
  return contextValue.join(',');
};

export class JobItemModel extends ItemModel implements JobProvider {
  projectInRepository: ProjectInRepository;

  job: RestJob;

  constructor(projectInRepository: ProjectInRepository, job: RestJob) {
    super();
    this.projectInRepository = projectInRepository;
    this.job = job;
  }

  get jobs(): RestJob[] {
    return [this.job];
  }

  getTreeItem(): vscode.TreeItem {
    const { job } = this;
    const item = new vscode.TreeItem(job.name);
    const jobStatusMetadata = getJobMetadata(job);
    const displayTime = job.finished_at ?? job.started_at ?? job.created_at;
    item.iconPath = jobStatusMetadata.icon;
    item.tooltip = `${job.name} · ${jobStatusMetadata.name} · ${dayjs(displayTime).fromNow()}`;
    if (job.description) item.tooltip += `\n${job.description}`;
    item.description = jobStatusMetadata.name;
    item.contextValue = getJobItemContextValue(job);

    if (job.target_url) {
      item.command = openInBrowserCommand(job.target_url);
    } else if (item.contextValue.indexOf('with-trace') !== -1) {
      const uri = toJobLogUri(this.projectInRepository.pointer.repository.rootFsPath, job.id);
      const options: vscode.TextDocumentShowOptions = { preview: true };
      item.command = {
        title: 'Display log',
        command: VS_COMMANDS.OPEN,
        arguments: [uri, options],
      };
    } else if (item.contextValue.indexOf('pending-job') !== -1) {
      item.command = {
        title: 'Display log',
        command: USER_COMMANDS.WAIT_FOR_PENDING_JOB,
        arguments: [this],
      };
    }
    return item;
  }

  // eslint-disable-next-line class-methods-use-this
  async getChildren(): Promise<ItemModel[]> {
    return [];
  }
}
