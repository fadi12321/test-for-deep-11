import * as vscode from 'vscode';
import { ItemModel } from './items/item_model';
import { extensionState } from '../extension_state';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';
import { getExtensionConfiguration } from '../utils/extension_configuration';
import { onSidebarViewStateChange } from './sidebar_view_state';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { MultipleProjectsItem } from './items/multiple_projects_item';
import { NoProjectItem } from './items/no_project_item';
import { ProjectItemModel } from './items/project_item_model';

export class IssuableDataProvider implements vscode.TreeDataProvider<ItemModel | vscode.TreeItem> {
  private eventEmitter = new vscode.EventEmitter<void>();

  private children: ItemModel[] = [];

  onDidChangeTreeData = this.eventEmitter.event;

  constructor() {
    extensionState.onDidChangeValid(this.refresh, this);
    gitlabProjectRepository.onProjectChange(this.refresh, this);
    onSidebarViewStateChange(this.refresh, this);
  }

  async getChildren(el: ItemModel | undefined): Promise<(ItemModel | vscode.TreeItem)[]> {
    if (el) return el.getChildren();

    this.children.forEach(ch => ch.dispose());
    if (!extensionState.isValid()) return []; // show welcome screen
    const { customQueries } = getExtensionConfiguration();
    const children = gitExtensionWrapper.gitRepositories.map(r => {
      const selected = gitlabProjectRepository.getSelectedOrDefaultForRepository(r.rootFsPath);
      if (selected) {
        const shouldExpandItem = gitExtensionWrapper.gitRepositories.length === 1;
        return new ProjectItemModel(selected, customQueries, shouldExpandItem);
      }
      if (gitlabProjectRepository.repositoryHasAmbiguousProjects(r.rootFsPath)) {
        return new MultipleProjectsItem(r);
      }
      return new NoProjectItem(r);
    });
    this.children = children.filter((c): c is ProjectItemModel => c instanceof ProjectItemModel);
    return children;
  }

  // eslint-disable-next-line class-methods-use-this
  getParent(): null {
    return null;
  }

  // eslint-disable-next-line class-methods-use-this
  getTreeItem(item: vscode.TreeItem | ItemModel) {
    if (item instanceof ItemModel) return item.getTreeItem();
    return item;
  }

  refresh(): void {
    this.eventEmitter.fire();
  }
}

export const issuableDataProvider = new IssuableDataProvider();
