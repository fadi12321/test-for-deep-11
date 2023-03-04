import * as vscode from 'vscode';
import { getJobMetadata } from '../../gitlab/ci_status_metadata';
import { compareBy } from '../../utils/compare_by';
import { JobItemModel } from './job_item_model';
import { ItemModel } from './item_model';
import { JobProvider } from './job_provider';
import { hasDownloadableArtifacts } from '../../utils/has_downloadable_artifacts';
import { ProjectInRepository } from '../../gitlab/new_project';

const first = <T>(a: T[]): T | undefined => a[0];

export class StageItemModel extends ItemModel implements JobProvider {
  #projectInRepository: ProjectInRepository;

  #stageName: string;

  jobs: RestJob[];

  constructor(projectInRepository: ProjectInRepository, stageName: string, jobs: RestJob[]) {
    super();
    this.#projectInRepository = projectInRepository;
    this.#stageName = stageName;
    this.jobs = jobs;
  }

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.#stageName, vscode.TreeItemCollapsibleState.Expanded);
    const mostSevereStatusMetadata = first(
      this.jobs.map(getJobMetadata).sort(compareBy('priority')).reverse(),
    );
    item.iconPath = mostSevereStatusMetadata?.icon;
    item.tooltip = mostSevereStatusMetadata?.name;
    if (hasDownloadableArtifacts(this.jobs)) {
      item.contextValue = 'with-artifacts';
    }
    return item;
  }

  async getChildren(): Promise<vscode.TreeItem[] | ItemModel[]> {
    return this.jobs.map(j => new JobItemModel(this.#projectInRepository, j));
  }
}
