import { GitRemoteUrlPointer } from '../git/new_git';
import { Account } from '../accounts/account';
import { GitLabProject } from './gitlab_project';

/**
 * Existing project represents a remote URL for which we were
 * able to fetch GitLab project from the GitLab instance using
 * a concrete set of credentials. (Different credentials will fetch
 * different ExistingProjects)
 */
export interface ExistingProject {
  remoteUrl: string;
  project: GitLabProject;
  account: Account;
}

export type InitializationType = 'selected';

/**
 * Project in repository is ExistingProject that we associate with a concrete
 * local Git repository and local Git remote (including URL). This relationship
 * is defined by the pointer.
 */
export interface ProjectInRepository {
  pointer: GitRemoteUrlPointer;
  account: Account;
  project: GitLabProject;
  initializationType?: InitializationType;
}

export interface ProjectInRepositoryProvider {
  projectInRepository: ProjectInRepository;
}

/**
 * SelectedProjectSetting to use specific ProjectInRepository for local Git repository.
 *
 * This setting might be needed in two scenarios:
 *
 * - Local Git repository contains multiple Existing projects. This can happen, for example, when
 *   user has upstream and fork remote.
 * - The remoteUrl in the local GitRepository couldn't be correctly associated with
 *   a set of credentials and the user had to manually define the relationship.
 */
export interface SelectedProjectSetting {
  namespaceWithPath: string;
  remoteUrl: string;
  repositoryRootPath: string;
  remoteName: string;
  accountId: string;
}
