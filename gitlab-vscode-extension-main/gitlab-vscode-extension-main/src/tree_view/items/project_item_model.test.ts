import * as vscode from 'vscode';
import { CustomQueryItemModel } from './custom_query_item_model';
import { customQuery, projectInRepository } from '../../test_utils/entities';
import { ProjectItemModel } from './project_item_model';

describe('RepositoryItemModel', () => {
  let item: ProjectItemModel;

  beforeEach(() => {
    item = new ProjectItemModel(projectInRepository, [customQuery]);
  });

  it('should use project name to create collapsed item', async () => {
    const treeItem = await item.getTreeItem();
    expect(treeItem.label).toBe('gitlab-vscode-extension');
    expect(treeItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
  });

  it('should return custom query children', async () => {
    const [a] = await item.getChildren();
    expect(a).toBeInstanceOf(CustomQueryItemModel);
    expect(await a.getTreeItem().label).toBe(customQuery.name);
  });

  describe('item labeled as a project', () => {
    it('should have project name as a label', () => {
      expect(item.getTreeItem().label).toBe(projectInRepository.project.name);
    });

    it('should have project icon', () => {
      expect(item.getTreeItem().iconPath).toEqual(new vscode.ThemeIcon('project'));
    });
  });
});
