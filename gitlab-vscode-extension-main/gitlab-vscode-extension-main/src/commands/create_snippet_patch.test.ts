import * as vscode from 'vscode';
import { createSnippetPatch } from './create_snippet_patch';
import { project } from '../test_utils/entities';
import { asMock } from '../test_utils/as_mock';
import { openUrl } from './openers';
import { GitLabProject } from '../gitlab/gitlab_project';
import { getTrackingBranchName } from '../git/get_tracking_branch_name';
import { getLastCommitSha } from '../git/get_last_commit_sha';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { ProjectInRepository } from '../gitlab/new_project';

jest.mock('../git/git_extension_wrapper');
jest.mock('./openers');
jest.mock('../git/get_tracking_branch_name');
jest.mock('../git/get_last_commit_sha');
jest.mock('../gitlab/get_gitlab_service');

const SNIPPET_URL = 'https://gitlab.com/test-group/test-project/-/snippets/2146265';
const DIFF_OUTPUT = 'diff --git a/.gitlab-ci.yml b/.gitlab-ci.yml';

describe('create snippet patch', () => {
  let createSnippet: jest.Mock;
  const pointer = { repository: { rawRepository: { diff: async () => DIFF_OUTPUT } } };

  beforeEach(() => {
    createSnippet = jest.fn();
    asMock(getTrackingBranchName).mockReturnValue('tracking-branch-name');
    asMock(getLastCommitSha).mockReturnValue('abcd1234567');
    asMock(getGitLabService).mockReturnValue({ createSnippet });
    asMock(vscode.window.showInputBox).mockResolvedValue('snippet_name');
    asMock(vscode.window.showQuickPick).mockImplementation(options =>
      options.filter((o: any) => o.type === 'private').pop(),
    );
    asMock(createSnippet).mockResolvedValue({
      web_url: SNIPPET_URL,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a snippet patch and opens it in a browser', async () => {
    await createSnippetPatch({ pointer, project } as unknown as ProjectInRepository);
    expect(openUrl).toHaveBeenCalledWith(SNIPPET_URL);
  });

  describe('populating the create snippet request', () => {
    let formData: Record<string, string>;
    let projectArgument: GitLabProject;
    beforeEach(async () => {
      await createSnippetPatch({ pointer, project } as unknown as ProjectInRepository);
      [[projectArgument, formData]] = asMock(createSnippet).mock.calls;
    });

    it('creates snippet for the right project', () => {
      expect(projectArgument).toBe(project);
    });

    it('prepends "patch: " to the user input to create snippet title', () => {
      expect(formData.title).toBe('patch: snippet_name');
    });

    it('appends ".patch" to the user input to create snippet file name', () => {
      expect(formData.file_name).toBe('snippet_name.patch');
    });

    it("sets user's choice of visibility (private selected in test setup)", () => {
      expect(formData.visibility).toBe('private');
    });

    it('sets the diff command output as the blob content', () => {
      expect(formData.content).toBe(DIFF_OUTPUT);
    });
  });
});
