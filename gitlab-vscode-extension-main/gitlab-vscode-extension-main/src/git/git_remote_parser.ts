import * as url from 'url';

/**
 * GitLabRemote represents a parsed git remote URL that could potentially point to a GitLab project.
 */
export interface GitLabRemote {
  host: string;
  /**
   * Namespace is the group(s) or user to whom the project belongs: https://docs.gitlab.com/ee/api/projects.html#get-single-project
   *
   * e.g. `gitlab-org/security` in the `gitlab-org/security/gitlab-vscode-extension` project
   */
  namespace: string;
  /**
   * Path is the "project slug": https://docs.gitlab.com/ee/api/projects.html#get-single-project
   *
   * e.g. `gitlab-vscode-extension` in the `gitlab-org/gitlab-vscode-extension` project
   */
  projectPath: string;
  /**
   * Namespace with path is the full project identifier: https://docs.gitlab.com/ee/api/projects.html#get-single-project
   *
   * e.g. `gitlab-org/gitlab-vscode-extension`
   */
  namespaceWithPath: string;
}

// returns path without the trailing slash or empty string if there is no path
const getInstancePath = (instanceUrl: string) => {
  const { pathname } = url.parse(instanceUrl);
  return pathname ? pathname.replace(/\/$/, '') : '';
};

const escapeForRegExp = (str: string) => str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');

function normalizeSshRemote(remote: string): string {
  // Regex to match git SSH remotes with custom port.
  // Example: [git@dev.company.com:7999]:group/repo_name.git
  // For more information see:
  // https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/309
  const sshRemoteWithCustomPort = remote.match(`^\\[([a-zA-Z0-9_-]+@.*?):\\d+\\](.*)$`);
  if (sshRemoteWithCustomPort) {
    return `ssh://${sshRemoteWithCustomPort[1]}${sshRemoteWithCustomPort[2]}`;
  }

  // Regex to match git SSH remotes with URL scheme and a custom port
  // Example: ssh://git@example.com:2222/fatihacet/gitlab-vscode-extension.git
  // For more information see:
  // https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/644
  const sshRemoteWithSchemeAndCustomPort = remote.match(`^ssh://([a-zA-Z0-9_-]+@.*?):\\d+(.*)$`);
  if (sshRemoteWithSchemeAndCustomPort) {
    return `ssh://${sshRemoteWithSchemeAndCustomPort[1]}${sshRemoteWithSchemeAndCustomPort[2]}`;
  }

  // Regex to match git SSH remotes without URL scheme and no custom port
  // Example: git@example.com:2222/fatihacet/gitlab-vscode-extension.git
  // For more information see this comment:
  // https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/611#note_1154175809
  const sshRemoteWithPath = remote.match(`([a-zA-Z0-9_-]+@.*?):(.*)`);
  if (sshRemoteWithPath) {
    return `ssh://${sshRemoteWithPath[1]}/${sshRemoteWithPath[2]}`;
  }

  if (remote.match(`^[a-zA-Z0-9_-]+@`)) {
    // Regex to match gitlab potential starting names for ssh remotes.
    return `ssh://${remote}`;
  }
  return remote;
}

export function parseGitLabRemote(remote: string, instanceUrl?: string): GitLabRemote | undefined {
  const { host, pathname } = url.parse(normalizeSshRemote(remote));

  if (!host || !pathname) {
    return undefined;
  }
  // The instance url might have a custom route, i.e. www.company.com/gitlab. This route is
  // optional in the remote url. This regex extracts namespace and project from the remote
  // url while ignoring any custom route, if present. For more information see:
  // - https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/11
  // - https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/103
  const pathRegExp = instanceUrl ? escapeForRegExp(getInstancePath(instanceUrl)) : '';
  const match = pathname.match(`(?:${pathRegExp})?/:?(.+)/([^/]+?)(?:.git)?/?$`);
  if (!match) {
    return undefined;
  }

  const [namespace, projectPath] = match.slice(1, 3);
  const namespaceWithPath = `${namespace}/${projectPath}`;

  return { host, namespace, projectPath, namespaceWithPath };
}
