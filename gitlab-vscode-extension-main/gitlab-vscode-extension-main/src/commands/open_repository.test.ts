import * as vscode from 'vscode';
import { REMOTE_URI_SCHEME } from '../constants';
import { HelpError } from '../errors/help_error';
import { pickGitRef } from '../gitlab/pick_git_ref';
import { pickAccount } from '../gitlab/pick_account';
import { pickProject } from '../gitlab/pick_project';
import { accountService } from '../accounts/account_service';
import { project } from '../test_utils/entities';
import { testCredentials } from '../test_utils/test_credentials';
import { openRepository } from './open_repository';

jest.mock('../accounts/account_service');
jest.mock('../gitlab/pick_account');
jest.mock('../gitlab/pick_project');
jest.mock('../gitlab/pick_git_ref');

describe('openRepository', () => {
  const cancelOnce = () =>
    (vscode.window.showQuickPick as jest.Mock).mockImplementationOnce(() => undefined);
  const pickOnce = (label: string) =>
    (vscode.window.showQuickPick as jest.Mock).mockImplementationOnce(
      (items: vscode.QuickPickItem[]) => {
        const item = items.find(i => i.label.indexOf(label) >= 0);
        if (!item) throw new Error(`There is no item labeled ${label}!`);
        return item;
      },
    );
  const alwaysInput = (url: string | undefined) =>
    (vscode.window.showInputBox as jest.Mock).mockImplementation(() => url);

  beforeEach(() => {
    accountService.getInstanceUrls = () => ['https://gitlab.com', 'https://example.com'];

    (vscode.window.createQuickPick as jest.Mock).mockImplementation(() => ({
      onDidChangeValue: jest.fn(),
      items: [],
    }));
  });

  it('stops if the open action quick pick is canceled', async () => {
    cancelOnce();
    await openRepository();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  describe('enter a URL', () => {
    beforeEach(() => {
      pickOnce('Open in current window');
      pickOnce('Enter gitlab-remote URL');
    });

    it('stops if the URL input is canceled', async () => {
      alwaysInput(undefined);
      await openRepository();
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('opens the selected URL', async () => {
      const uri = `${REMOTE_URI_SCHEME}://gitlab.com/GitLab?project=gitlab-org/gitlab&ref=main`;
      alwaysInput(uri);
      await openRepository();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.openFolder',
        vscode.Uri.parse(uri),
        false,
      );
    });

    it('does not open a window for an invalid URL', async () => {
      const uri = `not-${REMOTE_URI_SCHEME}://gitlab.com/GitLab?project=gitlab-org/gitlab&ref=main`;
      alwaysInput(uri);
      await expect(openRepository).rejects.toThrow(HelpError);
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('choose a project', () => {
    beforeEach(() => {
      pickOnce('Open in current window');
      pickOnce('Choose a project');
    });

    const branch: Partial<RestBranch> & { refType: 'branch' } = {
      refType: 'branch',
      name: 'main',
    };

    it('constructs and opens the correct URL', async () => {
      (pickAccount as jest.Mock).mockImplementation(() => testCredentials('https://example.com'));
      (pickProject as jest.Mock).mockImplementation(() => project);
      (pickGitRef as jest.Mock).mockImplementation(() => branch);
      alwaysInput('FooBar');

      await openRepository();

      expect(pickAccount).toHaveBeenCalled();
      expect(pickProject).toHaveBeenCalled();
      expect(pickGitRef).toHaveBeenCalled();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.openFolder',
        vscode.Uri.parse('gitlab-remote://example.com/FooBar?project=5261717&ref=main'),
        false,
      );
    });
  });
});
