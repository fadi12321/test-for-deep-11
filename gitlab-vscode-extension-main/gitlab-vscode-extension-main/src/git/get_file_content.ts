import { join } from 'path';
import { Repository } from '../api/git';

export const getFileContent = (
  rawRepository: Repository,
  path: string,
  sha: string,
): Promise<string | null> => {
  // even on Windows, the git show command accepts only POSIX paths
  const absolutePath = join(rawRepository.rootUri.fsPath, path).replace(/\\/g, '/');
  // null sufficiently signalises that the file has not been found
  // this scenario is going to happen often (for open and squashed MRs)
  return rawRepository.show(sha, absolutePath).catch(() => null);
};
