import { RemoteSource, RemoteSourceProvider } from '../../api/git';
import { GitLabService } from '../gitlab_service';
import { GitLabProject } from '../gitlab_project';
import { Account } from '../../accounts/account';
import { getGitLabServiceForAccount } from '../get_gitlab_service';

export function convertUrlToWikiUrl(url: string): string {
  return url.replace(/\.git$/, '.wiki.git');
}

export type GitLabRemote = RemoteSource & {
  project: GitLabProject;
  url: string[];
  wikiUrl: string[];
};

export function remoteForProject(project: GitLabProject): GitLabRemote {
  const url = [project.sshUrlToRepo, project.httpUrlToRepo];

  return {
    name: `$(repo) ${project.namespaceWithPath}`,
    description: project.description,
    url,
    wikiUrl: url.map(convertUrlToWikiUrl),
    project,
  };
}

export class GitLabRemoteSourceProvider implements RemoteSourceProvider {
  name: string;

  readonly icon = 'project';

  readonly supportsQuery = true;

  private gitlabService: GitLabService;

  constructor(account: Account) {
    this.name = `GitLab (${account.instanceUrl})`;
    this.gitlabService = getGitLabServiceForAccount(account);
  }

  async lookupByPath(path: string): Promise<GitLabRemote | undefined> {
    const project = await this.gitlabService.getProject(path);
    if (!project) return undefined;

    return remoteForProject(project);
  }

  async getRemoteSources(query?: string): Promise<GitLabRemote[]> {
    const projects = await this.gitlabService.getProjects({
      search: query,
    });

    return projects.filter(project => !project.empty).map(project => remoteForProject(project));
  }
}
