import * as vscode from 'vscode';
import { artifact, job, projectInRepository } from '../../test_utils/entities';
import { JobItemModel } from './job_item_model';
import { StageItemModel } from './stage_item_model';

describe('StageItemModel', () => {
  const jobs: RestJob[] = [
    { ...job, name: 'short task', status: 'failed' },
    { ...job, name: 'long task', status: 'running' },
  ];
  const model = new StageItemModel(projectInRepository, 'test', jobs);
  describe('tree item', () => {
    it('has label', () => {
      expect(model.getTreeItem().label).toBe('test');
    });

    it('takes tooltip and icon after the job with highest priority (e.g. running)', () => {
      const item = model.getTreeItem();

      expect(item.tooltip).toBe('Running');
      expect((item.iconPath as vscode.ThemeIcon).id).toBe('play');
    });

    it('has no contextValue if no downloadable artifacts exist', () => {
      expect(model.getTreeItem().contextValue).not.toBe('with-artifacts');
    });

    it('has a contextValue if downloadable artifacts exist', () => {
      const modelWithContextValue = new StageItemModel(projectInRepository, 'test', [
        { ...job, artifacts: [artifact] },
      ]).getTreeItem();
      expect(modelWithContextValue.contextValue).toBe('with-artifacts');
    });
  });

  describe('children', () => {
    it('exposes jobs', () => {
      expect(model.jobs).toBe(jobs);
    });

    it('returns the jobs as children', async () => {
      const children = (await model.getChildren()) as JobItemModel[];
      expect(children.map(ch => ch.getTreeItem().label)).toEqual(['short task', 'long task']);
    });
  });
});
