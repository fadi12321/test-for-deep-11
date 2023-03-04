import { Repository } from '../api/git';

export const getCurrentBranchName = (rawRepository: Repository): string | undefined =>
  rawRepository.state.HEAD?.name;
