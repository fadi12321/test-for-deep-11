import assert from 'assert';
import { Remote, Repository } from '../api/git';
import { hasPresentKey } from '../utils/has_present_key';

type RemoteUrlType = 'fetch' | 'push' | 'both';

export interface GitRemoteUrlEntry {
  url: string;
  type: RemoteUrlType;
}

export interface GitRemote {
  name: string;
  urlEntries: GitRemoteUrlEntry[];
}

export interface GitRepository {
  rootFsPath: string;
  remotes: GitRemote[];
  hasSameRootAs(repository: Repository): boolean;
  readonly rawRepository: Repository;
}

/**
 * GitRemoteUrlPointer represents a git remote URL (e.g. git@gitlab.com:gitlab-org/gitlab-vscode-extension.git)
 * that comes from a repository.
 *
 * This pointer helps us trace where did we get the remote URL from.
 */
export interface GitRemoteUrlPointer {
  urlEntry: GitRemoteUrlEntry;
  remote: GitRemote;
  repository: GitRepository;
}

export const createRemoteUrlPointers = (repository: GitRepository): GitRemoteUrlPointer[] =>
  repository.remotes.flatMap(remote =>
    remote.urlEntries.map(urlEntry => ({ repository, remote, urlEntry })),
  );

const getRemoteUrlEntries = (remote: Remote): GitRemoteUrlEntry[] => {
  assert(remote.fetchUrl || remote.pushUrl, `git remote ${remote.name} doesn't have any URLs.`);
  if (remote.fetchUrl === remote.pushUrl) {
    return [{ url: remote.fetchUrl!, type: 'both' }];
  }
  const urls = [
    { url: remote.fetchUrl, type: 'fetch' as const },
    { url: remote.pushUrl, type: 'push' as const },
  ].filter(hasPresentKey('url'));

  return urls;
};

export class GitRepositoryImpl implements GitRepository {
  readonly rawRepository: Repository;

  constructor(rawRepository: Repository) {
    this.rawRepository = rawRepository;
  }

  get rootFsPath() {
    return this.rawRepository.rootUri.fsPath;
  }

  get remotes() {
    return this.rawRepository.state.remotes.map(r => ({
      name: r.name,
      urlEntries: getRemoteUrlEntries(r),
    }));
  }

  /**
   * Compares, whether this wrapper contains repository for the
   * same folder as the method argument.
   *
   * The VS Code Git extension can produce more instances of `Repository`
   * interface for the same git folder. We can't simply compare references with `===`.
   */
  hasSameRootAs(repository: Repository): boolean {
    return this.rootFsPath === repository.rootUri.fsPath;
  }
}
