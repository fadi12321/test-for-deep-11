import * as vscode from 'vscode';
import dayjs from 'dayjs';
import { artifact, job, pipeline, projectInRepository } from '../../test_utils/entities';
import { PipelineItemModel } from './pipeline_item_model';
import { JobItemModel } from './job_item_model';

const fourYearsAgo = dayjs().subtract(4, 'year');

describe('PipelineItemModel', () => {
  describe('tree item', () => {
    let item: vscode.TreeItem;
    beforeEach(() => {
      item = new PipelineItemModel(
        projectInRepository,
        {
          ...pipeline,
          id: 123,
          status: 'success',
          updated_at: fourYearsAgo.toString(),
        },
        [{ ...job, artifacts: [artifact] }],
        false,
      ).getTreeItem();
    });

    it('has label', () => {
      expect(item.label).toBe('Pipeline #123');
    });

    it('prepends "Tag " for tag pipelines', () => {
      item = new PipelineItemModel(
        projectInRepository,
        {
          ...pipeline,
          status: 'success',
        },
        [],
        true,
      ).getTreeItem();

      expect(item.label).toMatch(/^Tag Pipeline/);
    });

    it('has tooltip', () => {
      expect(item.tooltip).toBe('Pipeline #123 · Passed · 4 years ago');
    });

    it('has description', () => {
      expect(item.description).toBe('Passed');
    });

    it('has icon', () => {
      const iconId = (item.iconPath as vscode.ThemeIcon).id;
      expect(iconId).toBe('pass');
    });

    it('has a contextValue if downloadable artifacts exist', () => {
      expect(item.contextValue).toMatch(/with-artifacts/);
    });

    it('has no contextValue if no downloadable artifacts exist', () => {
      const itemWithoutContextValue = new PipelineItemModel(
        projectInRepository,
        pipeline,
        [{ ...job, artifacts: [{ ...artifact, file_type: 'trace' }] }],
        false,
      ).getTreeItem();
      expect(itemWithoutContextValue.contextValue).not.toMatch(/with-artifacts/);
    });

    it('has a contextValue if retryable jobs exist', () => {
      expect(item.contextValue).toMatch(/retryable-pipeline/);
    });

    it('has a contextValue if cancellable jobs exist', () => {
      const itemWithCancellable = new PipelineItemModel(
        projectInRepository,
        pipeline,
        [{ ...job, status: 'running' }],
        false,
      ).getTreeItem();
      expect(itemWithCancellable.contextValue).toMatch(/cancellable-pipeline/);
    });

    it('has a contextValue if cancellable and retryable jobs exist', () => {
      const itemWithJobs = new PipelineItemModel(
        projectInRepository,
        pipeline,
        [job, { ...job, status: 'running' }],
        false,
      ).getTreeItem();
      expect(itemWithJobs.contextValue).toMatch(/retryable-pipeline/);
      expect(itemWithJobs.contextValue).toMatch(/cancellable-pipeline/);
    });
  });

  describe('children', () => {
    let pipelineItem: PipelineItemModel;
    const unitTestJob = { ...job, stage: 'test', name: 'unit test' };
    const integrationTestJob = { ...job, stage: 'test', name: 'integration test' };
    const packageJob = { ...job, stage: 'package', name: 'package task' };
    const jobs = [unitTestJob, integrationTestJob, packageJob];

    beforeEach(() => {
      pipelineItem = new PipelineItemModel(projectInRepository, pipeline, jobs, false);
    });

    it('exposes jobs', () => {
      expect(pipelineItem.jobs).toBe(jobs);
    });

    it('returns unique stages', async () => {
      const children = await pipelineItem.getChildren();

      const labels = children.map(ch => ch.getTreeItem()).map(i => i.label);
      expect(labels).toEqual(['test', 'package']);
    });

    it('returns stages based on job order (asc id)', async () => {
      const jobsWithIds = [
        { ...unitTestJob, id: 3 },
        { ...integrationTestJob, id: 2 },
        { ...packageJob, id: 1 },
      ];

      pipelineItem = new PipelineItemModel(projectInRepository, pipeline, jobsWithIds, false);
      const children = await pipelineItem.getChildren();
      const labels = children.map(ch => ch.getTreeItem()).map(i => i.label);

      expect(labels).toEqual(['package', 'test']);
    });

    it('passes jobs to each unique stage', async () => {
      const childrenModels = await pipelineItem.getChildren();

      const [testStageModel, packageStageModel] = childrenModels;
      const testJobItems = (await testStageModel.getChildren()) as JobItemModel[];
      const packageJobItems = (await packageStageModel.getChildren()) as JobItemModel[];
      expect(testJobItems.map(i => i.getTreeItem().label)).toEqual([
        'unit test',
        'integration test',
      ]);
      expect(packageJobItems.map(i => i.getTreeItem().label)).toEqual(['package task']);
    });
  });
});
