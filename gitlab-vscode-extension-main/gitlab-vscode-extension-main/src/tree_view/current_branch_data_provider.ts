import * as vscode from 'vscode';
import { ErrorItem } from './items/error_item';
import { ItemModel } from './items/item_model';
import { MrItemModel } from './items/mr_item_model';
import { IssueItem } from './items/issue_item';
import { PipelineItemModel } from './items/pipeline_item_model';
import {
  TreeState,
  BranchState,
  InvalidState,
  TagState,
  currentBranchRefresher,
} from '../current_branch_refresher';
import { onSidebarViewStateChange } from './sidebar_view_state';
import { DetachedHeadError } from '../errors/detached_head_error';

export class CurrentBranchDataProvider
  implements vscode.TreeDataProvider<ItemModel | vscode.TreeItem>
{
  private eventEmitter = new vscode.EventEmitter<void>();

  onDidChangeTreeData = this.eventEmitter.event;

  private state: TreeState = { type: 'invalid' };

  private pipelineItem?: PipelineItemModel;

  private mrState?: { mr: RestMr; item: MrItemModel };

  constructor() {
    onSidebarViewStateChange(() => this.refresh(this.state), this);
    currentBranchRefresher.onStateChanged(e => this.refresh(e));
  }

  createPipelineItem(state: BranchState | TagState) {
    if (!state.pipeline) {
      return new vscode.TreeItem('No pipeline found');
    }
    this.pipelineItem = new PipelineItemModel(
      state.projectInRepository,
      state.pipeline,
      state.jobs,
      state.type === 'tag',
    );
    return this.pipelineItem;
  }

  disposeMrItem() {
    this.mrState?.item.dispose();
    this.mrState = undefined;
  }

  createMrItem(state: BranchState): vscode.TreeItem | ItemModel {
    if (!state.userInitiated && this.mrState && this.mrState.mr.id === state.mr?.id)
      return this.mrState.item;
    this.disposeMrItem();
    if (!state.mr) return new vscode.TreeItem('No merge request found');
    const item = new MrItemModel(state.mr, state.projectInRepository);
    this.mrState = { mr: state.mr, item };
    return item;
  }

  static createClosingIssueItems(rootFsPath: string, issues: RestIssuable[]) {
    if (issues.length === 0) return [new vscode.TreeItem('No closing issue found')];
    return issues.map(issue => new IssueItem(issue, rootFsPath));
  }

  static renderInvalidState(state: InvalidState): vscode.TreeItem[] {
    if (state.error) {
      if (state.error instanceof DetachedHeadError) {
        return [new ErrorItem(state.error.message)];
      }
      return [new ErrorItem()];
    }
    return [];
  }

  async getChildren(item: ItemModel | undefined): Promise<(ItemModel | vscode.TreeItem)[]> {
    if (item) return item.getChildren();
    this.pipelineItem?.dispose();
    this.pipelineItem = undefined;
    if (this.state.type === 'invalid') {
      this.disposeMrItem();
      return CurrentBranchDataProvider.renderInvalidState(this.state);
    }
    if (this.state.type === 'branch') {
      const mrItem = this.createMrItem(this.state);
      const pipelineItem = this.createPipelineItem(this.state);
      const closingIssuesItems = CurrentBranchDataProvider.createClosingIssueItems(
        this.state.projectInRepository.pointer.repository.rootFsPath,
        this.state.issues,
      );
      return [pipelineItem, mrItem, ...closingIssuesItems];
    }
    if (this.state.type === 'tag') {
      this.disposeMrItem();
      const pipelineItem = this.createPipelineItem(this.state);
      return [pipelineItem];
    }
    throw new Error('Unknown head ref state type');
  }

  // eslint-disable-next-line class-methods-use-this
  getTreeItem(item: ItemModel | vscode.TreeItem) {
    if (item instanceof ItemModel) return item.getTreeItem();
    return item;
  }

  refresh(state: TreeState) {
    this.state = state;
    this.eventEmitter.fire();
  }
}

export const currentBranchDataProvider = new CurrentBranchDataProvider();
