import vscode from 'vscode';
import { FetchError } from './errors/fetch_error';
import { GitLabService } from './gitlab/gitlab_service';
import { accountService } from './accounts/account_service';
import { asMock } from './test_utils/as_mock';
import { addAccount } from './token_input';

jest.mock('./gitlab/gitlab_service');
jest.mock('./accounts/account_service');

describe('token input', () => {
  describe('addAccount', () => {
    const mockGetCurrentUserResponse = (response: any) => {
      asMock(GitLabService).mockImplementation(() => ({
        getCurrentUser: () => response,
      }));
    };

    beforeEach(() => {
      // simulate user filling in instance URL and token
      asMock(vscode.window.showInputBox).mockImplementation(async (options: any) =>
        options.password ? 'token' : 'https://gitlab.com',
      );
    });
    it('adds account', async () => {
      // simulate API returning user for the instance url and token
      mockGetCurrentUserResponse({ id: 1, username: 'testname' });

      await addAccount();

      expect(GitLabService).toHaveBeenCalledWith({
        instanceUrl: 'https://gitlab.com',
        token: 'token',
      });
      expect(accountService.addAccount).toHaveBeenCalledWith({
        id: 'https://gitlab.com|1',
        token: 'token',
        instanceUrl: 'https://gitlab.com',
        username: 'testname',
        type: 'token',
      });
    });

    it('removes trailing slash from the instanceUrl', async () => {
      // simulate user filling in instance URL and token
      asMock(vscode.window.showInputBox).mockImplementation(async (options: any) =>
        options.password ? 'token' : 'https://gitlab.com/',
      );
      // simulate API returning user for the instance url and token
      mockGetCurrentUserResponse({ id: 1, username: 'testname' });

      await addAccount();

      expect(accountService.addAccount).toHaveBeenCalledWith({
        id: 'https://gitlab.com|1',
        instanceUrl: 'https://gitlab.com',
        token: 'token',
        username: 'testname',
        type: 'token',
      });
    });

    it('handles Unauthorized error', async () => {
      // simulate API failing with Unauthorized
      mockGetCurrentUserResponse(Promise.reject(new FetchError('', { status: 401 } as Response)));

      await expect(addAccount()).rejects.toThrowError(/.*Unauthorized.*/);
    });
    it('handles fetch error', async () => {
      // simulate API returning error response
      mockGetCurrentUserResponse(Promise.reject(new FetchError('', { status: 404 } as Response)));

      await expect(addAccount()).rejects.toThrowError(/.*Request failed.*/);
    });
  });
});
