import * as vscode from 'vscode';
import { createProject } from '../test_utils/entities';
import { showQuickPick } from '../utils/show_quickpick';
import { GitLabProject } from './gitlab_project';
import { GitLabService } from './gitlab_service';
import { pickProject } from './pick_project';

jest.mock('../utils/show_quickpick');
jest.mock('./clone/gitlab_remote_source_provider');

describe('pickProject', () => {
  const projects: GitLabProject[] = [
    createProject('a/b'),
    createProject('c/d'),
    createProject('e/f'),
  ];
  const partialGitLabService: Partial<GitLabService> = {
    getProjects: async ({ search }) => {
      if (!search) return projects;
      return projects.filter(p => p.namespaceWithPath.indexOf(search) >= 0);
    },
    getProject: async path => projects.find(p => p.namespaceWithPath === path),
  };
  const gitLabService = partialGitLabService as GitLabService;

  const alwaysPickOptionN = (n: number, v?: string) => {
    (showQuickPick as jest.Mock).mockImplementation(async picker => {
      // Wait for a moment for the list to be populated
      await new Promise(r => {
        setTimeout(r, 1);
      });
      // eslint-disable-next-line no-param-reassign
      if (v) picker.value = v;
      return picker.items[n];
    });
  };

  const alwaysInput = (answer: string | undefined) => {
    (vscode.window.showInputBox as jest.Mock).mockImplementation(() => answer);
  };

  beforeEach(() => {
    (vscode.window.createQuickPick as jest.Mock).mockImplementation(() => ({
      onDidChangeValue: jest.fn(),
      items: [],
    }));
  });

  it('returns undefined when the picker is canceled', async () => {
    alwaysPickOptionN(-1);
    const r = await pickProject(gitLabService);
    expect(r).toBeUndefined();
  });

  it('returns the selected item', async () => {
    alwaysPickOptionN(1);
    const r = await pickProject(gitLabService);
    expect(r).toStrictEqual(projects[0]);
  });

  describe('when other is selected', () => {
    beforeEach(() => alwaysPickOptionN(0));

    it('resolves the user-provided value', async () => {
      alwaysInput(projects[2].namespaceWithPath);
      const r = await pickProject(gitLabService);
      expect(r).toStrictEqual(projects[2]);
    });

    describe('when a value is provided', () => {
      beforeEach(() => alwaysPickOptionN(0, projects[2].name));

      it('does not show an input box', async () => {
        await pickProject(gitLabService);
        expect(vscode.window.showInputBox).toHaveBeenCalledTimes(0);
      });
    });

    describe('when no value is provided', () => {
      beforeEach(() => alwaysInput(undefined));

      it('shows an input box', async () => {
        await pickProject(gitLabService);
        expect(vscode.window.showInputBox).toHaveBeenCalledTimes(1);
      });

      it('returns undefined when the input box is canceled', async () => {
        const r = await pickProject(gitLabService);
        expect(vscode.window.showInputBox).toHaveBeenCalledTimes(1);
        expect(r).toStrictEqual(undefined);
      });
    });
  });
});
