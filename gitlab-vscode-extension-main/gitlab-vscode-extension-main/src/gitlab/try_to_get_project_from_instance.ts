import { Account } from '../accounts/account';
import { log } from '../log';
import { getGitLabServiceForAccount } from './get_gitlab_service';
import { GitLabProject } from './gitlab_project';

export const tryToGetProjectFromInstance = async (
  account: Account,
  namespaceWithPath: string,
): Promise<GitLabProject | undefined> =>
  getGitLabServiceForAccount(account)
    .getProject(namespaceWithPath)
    .catch(e => {
      log.error(e);
      return undefined;
    });
