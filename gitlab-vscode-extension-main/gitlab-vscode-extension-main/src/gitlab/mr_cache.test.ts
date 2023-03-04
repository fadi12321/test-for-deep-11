import { asMock } from '../test_utils/as_mock';
import { mr, mrVersion, projectInRepository } from '../test_utils/entities';
import { getGitLabService } from './get_gitlab_service';
import { MrCacheImpl } from './mr_cache';

jest.mock('./get_gitlab_service');

describe('MrCacheImpl', () => {
  let mrCache: MrCacheImpl;
  beforeEach(() => {
    mrCache = new MrCacheImpl();
  });
  it('returns undefined if the MR is not cached', () => {
    expect(mrCache.getMr(1, projectInRepository)).toBe(undefined);
  });

  it('fetches MR versions when we reload MR', async () => {
    asMock(getGitLabService).mockReturnValue({
      getMrDiff: async () => mrVersion,
    });

    const result = await mrCache.reloadMr(mr, projectInRepository);

    expect(result).toEqual({ mr, mrVersion });
  });

  it('returns MR when it was cached', async () => {
    asMock(getGitLabService).mockReturnValue({
      getMrDiff: async () => mrVersion,
    });

    await mrCache.reloadMr(mr, projectInRepository);

    expect(mrCache.getMr(mr.id, projectInRepository)).toEqual({ mr, mrVersion });
  });
});
