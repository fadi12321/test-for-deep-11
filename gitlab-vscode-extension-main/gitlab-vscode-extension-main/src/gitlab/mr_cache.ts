import { jsonStringifyWithSortedKeys } from '../utils/json_stringify_with_sorted_keys';
import { getGitLabService } from './get_gitlab_service';
import { ProjectInRepository } from './new_project';
import { convertProjectToSetting } from './selected_project_store';

export interface CachedMr {
  mr: RestMr;
  mrVersion: RestMrVersion;
}

export interface MrCache {
  reloadMr(mr: RestMr, projectInRepository: ProjectInRepository): Promise<CachedMr>;
  getMr(id: number, projectInRepository: ProjectInRepository): CachedMr | undefined;
}

const getId = (mrId: number, projectInRepository: ProjectInRepository): string => {
  const projectId = jsonStringifyWithSortedKeys({
    ...convertProjectToSetting(projectInRepository),
  });
  return `${projectId}-${mrId}`;
};

export class MrCacheImpl implements MrCache {
  private mrCache: Record<string, CachedMr> = {};

  async reloadMr(mr: RestMr, projectInRepository: ProjectInRepository): Promise<CachedMr> {
    const mrVersion = await getGitLabService(projectInRepository).getMrDiff(mr);
    const cachedMr = {
      mr,
      mrVersion,
    };
    this.mrCache[getId(mr.id, projectInRepository)] = cachedMr;
    return cachedMr;
  }

  getMr(id: number, projectInRepository: ProjectInRepository): CachedMr | undefined {
    return this.mrCache[getId(id, projectInRepository)];
  }
}

export const mrCache: MrCache = new MrCacheImpl();
