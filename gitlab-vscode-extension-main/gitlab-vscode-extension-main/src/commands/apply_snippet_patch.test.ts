import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { applySnippetPatch, NO_PATCH_SNIPPETS_MESSAGE } from './apply_snippet_patch';
import {
  patchSnippet,
  testSnippet1,
  testSnippet2,
} from '../../test/integration/fixtures/graphql/snippets.js';
import { asMock } from '../test_utils/as_mock';
import { GitLabService } from '../gitlab/gitlab_service';
import { getLastCommitSha } from '../git/get_last_commit_sha';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { ProjectInRepository } from '../gitlab/new_project';
import { project } from '../test_utils/entities';

jest.mock('../git/get_last_commit_sha');
jest.mock('../gitlab/get_gitlab_service');

const DIFF_OUTPUT = 'diff --git a/.gitlab-ci.yml b/.gitlab-ci.yml';

describe('apply snippet patch', () => {
  let gitlabService: Partial<GitLabService>;

  const getAppliedPatchContent = async () => {
    const [[patchFile]] = asMock(pointer.repository.rawRepository.apply).mock.calls;
    const patchContent = await fs.readFile(patchFile);
    return patchContent.toString();
  };

  const pointer = { repository: { rawRepository: { apply: jest.fn() } } };

  beforeEach(() => {
    gitlabService = {};
    asMock(getLastCommitSha).mockReturnValue('abcd1234567');
    asMock(getGitLabService).mockReturnValue(gitlabService);

    asMock(vscode.window.withProgress).mockImplementation((_, task) => task());
    asMock(vscode.window.showQuickPick).mockImplementation(options => options[0]);
    fs.unlink = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls git apply with the selected snippet patch', async () => {
    gitlabService.getSnippets = async () => [patchSnippet];
    gitlabService.getSnippetContent = async () => DIFF_OUTPUT;

    await applySnippetPatch({ pointer, project } as unknown as ProjectInRepository);

    expect(pointer.repository.rawRepository.apply).toHaveBeenCalled();
    expect(await getAppliedPatchContent()).toBe(DIFF_OUTPUT);
    expect(fs.unlink).toHaveBeenCalled();
  });

  it('shows information message when it cannot find any snippets', async () => {
    gitlabService.getSnippets = async () => [];

    await applySnippetPatch({ pointer, project } as unknown as ProjectInRepository);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(NO_PATCH_SNIPPETS_MESSAGE);
  });

  it('shows information message when returned snippets are not patch snippets', async () => {
    gitlabService.getSnippets = async () => [testSnippet1, testSnippet2];

    await applySnippetPatch({ pointer, project } as unknown as ProjectInRepository);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(NO_PATCH_SNIPPETS_MESSAGE);
  });
});
