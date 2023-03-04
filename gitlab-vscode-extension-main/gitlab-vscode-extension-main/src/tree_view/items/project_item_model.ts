import * as vscode from 'vscode';
import { CustomQueryItemModel } from './custom_query_item_model';
import { CustomQuery } from '../../gitlab/custom_query';
import { ItemModel } from './item_model';
import { ProjectInRepository } from '../../gitlab/new_project';

export class ProjectItemModel extends ItemModel {
  readonly projectInRepository: ProjectInRepository;

  #customQueries: CustomQuery[];

  #startExpanded: boolean;

  constructor(
    projectInRepository: ProjectInRepository,
    customQueries: CustomQuery[],
    startExpanded = false,
  ) {
    super();
    this.projectInRepository = projectInRepository;
    this.#customQueries = customQueries;
    this.#startExpanded = startExpanded;
  }

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      this.projectInRepository.project.name,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    item.iconPath = new vscode.ThemeIcon('project');
    item.contextValue =
      this.projectInRepository.initializationType === 'selected' ? 'selected-project' : '';
    const { Expanded, Collapsed } = vscode.TreeItemCollapsibleState;
    item.collapsibleState = this.#startExpanded ? Expanded : Collapsed;
    return item;
  }

  async getChildren(): Promise<ItemModel[]> {
    const children = this.#customQueries.map(
      q => new CustomQueryItemModel(q, this.projectInRepository),
    );
    this.setDisposableChildren(children);
    return children;
  }
}
