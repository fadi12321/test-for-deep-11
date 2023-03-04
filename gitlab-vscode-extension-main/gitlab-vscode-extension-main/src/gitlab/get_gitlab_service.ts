import { Account } from '../accounts/account';
import { GitLabService } from './gitlab_service';
import { ProjectInRepository } from './new_project';
import { RefreshingGitLabService } from './refreshing_gitlab_service';

export const getGitLabService: (p: ProjectInRepository) => GitLabService = projectInRepository =>
  new RefreshingGitLabService(projectInRepository.account);

export const getGitLabServiceForAccount: (a: Account) => GitLabService = account =>
  new RefreshingGitLabService(account);
