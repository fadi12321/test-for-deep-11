import * as vscode from 'vscode';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { GitLabService, ValidationResponse } from '../gitlab/gitlab_service';
import { asMock } from '../test_utils/as_mock';
import { projectInRepository } from '../test_utils/entities';
import { MergedYamlContentProvider } from './merged_yaml_content_provider';
import { toMergedYamlUri } from './merged_yaml_uri';

jest.mock('../gitlab/get_gitlab_service');
jest.mock('../gitlab/gitlab_project_repository');

describe('MergedYamlContentProvider', () => {
  const content = '# Initial Merged YAML content';
  const remoteContent = '# Updated Merged YAML content';
  const uri = toMergedYamlUri({
    path: '/.gitlab-ci.yml',
    repositoryRoot: '/',
    initial: content,
  });

  const gitlabService: Partial<GitLabService> = {
    async validateCIConfig(): Promise<ValidationResponse> {
      return { valid: true, errors: [], merged_yaml: remoteContent };
    },
  };

  beforeEach(() => {
    asMock(getGitLabService).mockReturnValue(gitlabService);
    asMock(gitlabProjectRepository.getProjectOrFail).mockReturnValue(projectInRepository);
    asMock(vscode.workspace.onDidCloseTextDocument).mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('loads the initial content', async () => {
    asMock(vscode.workspace.onDidOpenTextDocument).mockImplementation(() => undefined);
    const provider = new MergedYamlContentProvider();

    const cancel = new vscode.CancellationTokenSource();
    const result = await provider.provideTextDocumentContent(uri, cancel.token);
    expect(result).toBe(content);
  });

  it('contacts the GitLab service on changes', async () => {
    asMock(vscode.workspace.onDidOpenTextDocument).mockImplementation(cb => cb({ uri }));
    asMock(vscode.workspace.createFileSystemWatcher).mockImplementation(() => ({
      onDidChange(cb: () => unknown) {
        // Call the file change callback immediately.
        cb();
      },
    }));
    const provider = new MergedYamlContentProvider();

    const cancel = new vscode.CancellationTokenSource();
    const result = await provider.provideTextDocumentContent(uri, cancel.token);
    expect(result).toBe(remoteContent);
  });
});
