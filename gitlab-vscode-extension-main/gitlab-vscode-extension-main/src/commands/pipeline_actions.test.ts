import { getGitLabService } from '../gitlab/get_gitlab_service';
import { GitLabService } from '../gitlab/gitlab_service';
import { asMock } from '../test_utils/as_mock';
import { job, pipeline, projectInRepository } from '../test_utils/entities';
import { PipelineItemModel } from '../tree_view/items/pipeline_item_model';
import { cancelPipeline, retryPipeline } from './pipeline_actions';

jest.mock('../gitlab/get_gitlab_service');

describe('retryOrCancelPipeline', () => {
  const item = new PipelineItemModel(projectInRepository, pipeline, [job], false);
  const gitLabService: Partial<GitLabService> = {
    cancelOrRetryPipeline: jest.fn(),
  };

  beforeEach(() => {
    asMock(getGitLabService).mockReturnValue(gitLabService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('can retry pipelines', async () => {
    await retryPipeline(item);

    expect(gitLabService.cancelOrRetryPipeline).toHaveBeenCalledWith(
      'retry',
      projectInRepository.project,
      pipeline,
    );
  });

  it('can cancel pipelines', async () => {
    await cancelPipeline(item);

    expect(gitLabService.cancelOrRetryPipeline).toHaveBeenCalledWith(
      'cancel',
      projectInRepository.project,
      pipeline,
    );
  });
});
