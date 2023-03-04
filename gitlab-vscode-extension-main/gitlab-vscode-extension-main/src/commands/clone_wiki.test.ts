import * as vscode from 'vscode';
import { cloneWiki } from './clone_wiki';
import { pickAccount } from '../gitlab/pick_account';
import { pickProject } from '../gitlab/pick_project';
import { createTokenAccount, project } from '../test_utils/entities';

jest.mock('../gitlab/pick_account');
jest.mock('../gitlab/pick_project');
jest.mock('../gitlab/gitlab_service');

describe('cloneWiki', () => {
  it('calls git.clone command with selected URL', async () => {
    (pickAccount as jest.Mock).mockImplementation(() => createTokenAccount());
    (pickProject as jest.Mock).mockImplementation(() => project);
    (vscode.window.showQuickPick as jest.Mock).mockImplementation(([option]) => option);

    await cloneWiki();

    expect(vscode.commands.executeCommand).toBeCalledWith(
      'git.clone',
      'git@gitlab.com:gitlab-org/gitlab-vscode-extension.wiki.git',
    );
  });
});
