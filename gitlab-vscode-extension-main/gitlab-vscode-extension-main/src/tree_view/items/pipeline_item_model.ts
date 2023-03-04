import * as vscode from 'vscode';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getJobMetadata, getPipelineMetadata } from '../../gitlab/ci_status_metadata';
import { ItemModel } from './item_model';
import { StageItemModel } from './stage_item_model';
import { compareBy } from '../../utils/compare_by';
import { hasDownloadableArtifacts } from '../../utils/has_downloadable_artifacts';
import { JobProvider } from './job_provider';
import { PipelineProvider } from './pipeline_provider';
import { ProjectInRepository, ProjectInRepositoryProvider } from '../../gitlab/new_project';

dayjs.extend(relativeTime);
/** removes duplicates based on === equality. Can be replaced with lodash. */
const uniq = <T>(duplicated: T[]): T[] => [...new Set(duplicated)];

const getUniqueStages = (jobs: RestJob[]): string[] => uniq(jobs.map(j => j.stage));

const getPipelineItemContextValue = (jobs: RestJob[]) => {
  const contextValue: string[] = ['with-url'];
  if (jobs.find(job => getJobMetadata(job).contextAction === 'cancellable')) {
    contextValue.push('cancellable-pipeline');
  }
  if (jobs.find(job => getJobMetadata(job).contextAction === 'retryable')) {
    contextValue.push('retryable-pipeline');
  }
  if (hasDownloadableArtifacts(jobs)) {
    contextValue.push('with-artifacts');
  }
  return contextValue.join(',');
};

export class PipelineItemModel
  extends ItemModel
  implements JobProvider, PipelineProvider, ProjectInRepositoryProvider
{
  projectInRepository: ProjectInRepository;

  pipeline: RestPipeline;

  jobs: RestJob[];

  #isTag: boolean;

  constructor(
    projectInRepository: ProjectInRepository,
    pipeline: RestPipeline,
    jobs: RestJob[],
    isTag: boolean,
  ) {
    super();
    this.projectInRepository = projectInRepository;
    this.pipeline = pipeline;
    this.jobs = jobs;
    this.#isTag = isTag;
  }

  getTreeItem(): vscode.TreeItem {
    const timeAgo = dayjs(this.pipeline.updated_at).fromNow();
    const label = `${this.#isTag ? 'Tag ' : ''}Pipeline #${this.pipeline.id}`;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
    const statusMetadata = getPipelineMetadata(this.pipeline);
    item.tooltip = `${label} · ${statusMetadata.name} · ${timeAgo}`;
    item.description = statusMetadata.name;
    item.iconPath = statusMetadata.icon;
    item.contextValue = getPipelineItemContextValue(this.jobs);
    return item;
  }

  async getChildren(): Promise<ItemModel[]> {
    const jobsAsc = this.jobs.sort(compareBy('id'));
    const stages = getUniqueStages(jobsAsc);
    const stagesWithJobs = stages.map(stageName => ({
      name: stageName,
      jobs: jobsAsc.filter(j => j.stage === stageName),
    }));
    return stagesWithJobs.map(sj => new StageItemModel(this.projectInRepository, sj.name, sj.jobs));
  }
}
