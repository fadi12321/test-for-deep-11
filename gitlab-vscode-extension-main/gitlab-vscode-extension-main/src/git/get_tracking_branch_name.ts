import { Repository } from '../api/git';

export const getTrackingBranchName = async (
  rawRepository: Repository,
): Promise<string | undefined> => {
  const branchName = rawRepository.state.HEAD?.name;

  if (!branchName) return undefined;

  const trackingBranch = await rawRepository
    .getConfig(`branch.${branchName}.merge`)
    .catch(() => ''); // the tracking branch is going to be empty most of the time, we'll swallow the error instead of logging it every time

  return trackingBranch.replace('refs/heads/', '') || branchName;
};
