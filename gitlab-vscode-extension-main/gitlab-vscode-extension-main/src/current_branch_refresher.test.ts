import { BranchState, CurrentBranchRefresher, TagState } from './current_branch_refresher';
import { asMock } from './test_utils/as_mock';
import {
  pipeline,
  mr,
  issue,
  job,
  projectInRepository,
  externalStatus,
} from './test_utils/entities';
import { getGitLabService } from './gitlab/get_gitlab_service';
import { getTrackingBranchName } from './git/get_tracking_branch_name';
import { getTagsForHead } from './git/get_tags_for_head';

jest.mock('./gitlab/get_gitlab_service');
jest.mock('./git/get_tracking_branch_name');
jest.mock('./git/get_tags_for_head');

describe('CurrentBranchRefrehser', () => {
  describe('invalid state', () => {
    it('returns invalid state if the current repo does not contain GitLab project', async () => {
      const state = await CurrentBranchRefresher.getState(undefined, false);
      expect(state.type).toBe('invalid');
    });

    it('returns invalid state if fetching the mr and pipelines fails', async () => {
      asMock(getGitLabService).mockReturnValue({
        getPipelineAndMrForCurrentBranch: () => Promise.reject(new Error()),
      });
      asMock(getTrackingBranchName).mockResolvedValue('branch');
      const state = await CurrentBranchRefresher.getState(projectInRepository, false);
      expect(state.type).toBe('invalid');
    });
  });

  describe('valid state', () => {
    beforeEach(() => {
      asMock(getGitLabService).mockReturnValue({
        getMrClosingIssues: () => [{ iid: 123 }],
        getSingleProjectIssue: () => issue,
        getPipelineAndMrForCurrentBranch: () => ({ pipeline, mr }),
        getLastPipelineForCurrentBranch: () => pipeline,
        getJobsForPipeline: () => [job],
        getExternalStatusForCommit: () => [externalStatus],
      });
    });

    it('returns valid state if GitLab service returns pipeline and mr', async () => {
      asMock(getTrackingBranchName).mockResolvedValue('branch');
      const state = await CurrentBranchRefresher.getState(projectInRepository, false);

      expect(state.type).toBe('branch');
      expect((state as BranchState).pipeline).toEqual(pipeline);
      expect((state as BranchState).mr).toEqual(mr);
      expect((state as BranchState).issues).toEqual([issue]);
    });

    it('returns valid state if repository has checked out a tag', async () => {
      asMock(getTrackingBranchName).mockResolvedValue(undefined);
      asMock(getTagsForHead).mockResolvedValue(['tag1']);
      const state = await CurrentBranchRefresher.getState(projectInRepository, false);

      expect(state.type).toBe('tag');
      expect((state as TagState).pipeline).toEqual(pipeline);
    });

    it('returns pipeline jobs and external statuses', async () => {
      asMock(getTrackingBranchName).mockResolvedValue('branch');
      const state = await CurrentBranchRefresher.getState(projectInRepository, false);

      expect(state.type).toBe('branch');
      expect((state as BranchState).jobs).toEqual([job, externalStatus]);
    });
  });
});
