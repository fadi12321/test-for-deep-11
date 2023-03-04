import { Repository } from '../api/git';

export const getLastCommitSha = (rawRepository: Repository): string | undefined =>
  rawRepository.state.HEAD?.commit;
