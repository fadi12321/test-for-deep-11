import { parseGitLabRemote } from './git_remote_parser';

describe('git_remote_parser', () => {
  it.each([
    [
      'git@gitlab.com:fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'gitlab-ci@gitlab-mydomain.com:fatihacet/gitlab-vscode-extension.git',
      ['gitlab-mydomain.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'ssh://git@gitlab.com:fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'git://git@gitlab.com:fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'http://git@gitlab.com/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'http://gitlab.com/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'https://git@gitlab.com/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'https://gitlab.com/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'git@gitlab.com:group/subgroup/gitlab-vscode-extension.git',
      ['gitlab.com', 'group/subgroup', 'gitlab-vscode-extension'],
    ],
    [
      'http://gitlab.com/group/subgroup/gitlab-vscode-extension.git',
      ['gitlab.com', 'group/subgroup', 'gitlab-vscode-extension'],
    ],
    [
      'https://gitlab.com/fatihacet/gitlab-vscode-extension',
      ['gitlab.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'https://gitlab.company.com/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.company.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'https://gitlab.company.com:8443/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.company.com:8443', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      // trailing / can be present if user copied the repo URL from the browser navigation bar
      'https://gitlab.company.com:8443/fatihacet/gitlab-vscode-extension/',
      ['gitlab.company.com:8443', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      // For more details see: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/309
      '[git@example.com:2222]:fatihacet/gitlab-vscode-extension.git',
      ['example.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      // For more details see: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/611
      'git@example.com:2222/fatihacet/gitlab-vscode-extension.git',
      ['example.com', '2222/fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      // For more details see: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/644
      'ssh://git@example.com:2222/fatihacet/gitlab-vscode-extension.git',
      ['example.com', 'fatihacet', 'gitlab-vscode-extension'],
    ],
  ])('should parse %s', (remote, parsed) => {
    const [host, namespace, projectPath] = parsed;
    expect(parseGitLabRemote(remote, 'https://gitlab.com')).toEqual({
      host,
      namespace,
      projectPath,
      namespaceWithPath: `${namespace}/${projectPath}`,
    });
  });

  // For more details see https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/11
  it('should support self managed GitLab on a custom path', () => {
    expect(
      parseGitLabRemote(
        'https://example.com/gitlab/fatihacet/gitlab-vscode-extension',
        'https://example.com/gitlab',
      ),
    ).toEqual({
      host: 'example.com',
      namespace: 'fatihacet',
      projectPath: 'gitlab-vscode-extension',
      namespaceWithPath: 'fatihacet/gitlab-vscode-extension',
    });
  });
  // For more details see: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/103
  it('should parse remote URLs without custom path even if the instance has custom path', () => {
    expect(
      parseGitLabRemote(
        'git@example.com:fatihacet/gitlab-vscode-extension.git',
        'https://example.com/gitlab',
      ),
    ).toEqual({
      host: 'example.com',
      namespace: 'fatihacet',
      projectPath: 'gitlab-vscode-extension',
      namespaceWithPath: 'fatihacet/gitlab-vscode-extension',
    });
  });

  it('fails to parse remote URL without namespace', () => {
    expect(parseGitLabRemote('git@host:no-namespace-repo.git')).toBeUndefined();
  });
});
