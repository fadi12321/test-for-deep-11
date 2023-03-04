import assert from 'assert';
import vscode from 'vscode';
import { URLSearchParams } from 'url';
import { GitLabService } from '../../gitlab/gitlab_service';
import { GitLabUriHandler } from '../../gitlab_uri_handler';
import { openUrl } from '../../commands/openers';
import { asMock } from '../../test_utils/as_mock';
import { createExtensionContext, createOAuthAccount } from '../../test_utils/entities';
import { AccountService } from '../account_service';
import { GitLabAuthenticationProvider } from './gitlab_authentication_provider';
import { TokenExchangeService } from '../../gitlab/token_exchange_service';

jest.mock('../../commands/openers');
jest.mock('../../gitlab/gitlab_service');
jest.useFakeTimers();

/* This method simulates the first response from GitLab OAuth, it accepts the authentication URL and returns redirect URL */
const fakeOAuthService = (urlString: string): string => {
  const url = new URL(urlString);
  const params = Object.fromEntries(new URLSearchParams(url.search).entries());
  assert.strictEqual(
    params.client_id,
    '36f2a70cddeb5a0889d4fd8295c241b7e9848e89cf9e599d0eed2d8e5350fbf5',
  );
  assert.strictEqual(params.redirect_uri, 'vscode://gitlab.gitlab-workflow/authentication');
  assert.strictEqual(params.response_type, 'code');
  assert.strictEqual(params.scope, 'read_user api');
  assert.strictEqual(params.code_challenge_method, 'S256');
  assert(params.state);
  assert(params.code_challenge);

  const responseParams = new URLSearchParams({ state: params.state, code: 'abc' });
  return `${params.redirect_uri}?${responseParams}`;
};

describe('GitLabAuthenticationProvider', () => {
  let uriHandler: GitLabUriHandler;
  let accountService: AccountService;
  let tokenExchangeService: TokenExchangeService;

  beforeEach(async () => {
    uriHandler = new GitLabUriHandler();
    accountService = new AccountService();
    await accountService.init(createExtensionContext());
    tokenExchangeService = new TokenExchangeService(accountService);
    asMock(GitLabService.exchangeToken).mockReturnValue({ access_token: 'test_token' });
    asMock(GitLabService).mockImplementation(
      ({ instanceUrl, token }: { instanceUrl: string; token: string }) => {
        assert.strictEqual(instanceUrl, 'https://gitlab.com');
        assert.strictEqual(token, 'test_token');
        return {
          getCurrentUser: async () => ({ id: 123, username: 'test_user' }),
        };
      },
    );
  });

  describe('getting existing session', () => {
    it('gets a session if there is existing oauth account', async () => {
      await accountService.addAccount(createOAuthAccount());
      const provider = new GitLabAuthenticationProvider(
        accountService,
        uriHandler,
        tokenExchangeService,
      );

      const sessions = await provider.getSessions(['read_user', 'api']);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].accessToken).toBe(createOAuthAccount().token);
    });
  });

  describe('when user authenticates the request', () => {
    beforeEach(() => {
      asMock(openUrl).mockImplementationOnce(async urlString => {
        uriHandler.fire(vscode.Uri.parse(fakeOAuthService(urlString)));
      });
    });

    it('authenticates', async () => {
      const provider = new GitLabAuthenticationProvider(
        accountService,
        uriHandler,
        tokenExchangeService,
      );

      const session = await provider.createSession(['read_user', 'api']);

      expect(session.account.id).toEqual('https://gitlab.com|123');
      expect(session.accessToken).toEqual('test_token');
      expect(session.scopes).toEqual(['read_user', 'api']);
      expect(accountService.getAllAccounts()).toHaveLength(1);
      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        {
          title: 'Waiting for OAuth redirect from GitLab.com.',
          location: vscode.ProgressLocation.Notification,
        },
        expect.any(Function),
      );
    });
  });

  describe('when user does not authenticate the request', () => {
    beforeEach(() => {
      asMock(openUrl).mockImplementation(async () => {
        /* noop */
      });
    });

    it('cancels OAuth login after 60s', async () => {
      const provider = new GitLabAuthenticationProvider(accountService, uriHandler);

      const result = provider.createSession(['read_user', 'api']);

      // When combining setTimeout with promises, we need to run jest.runAllTimers() asynchronously.
      // https://stackoverflow.com/a/51132058/606571
      await Promise.resolve().then(() => jest.advanceTimersByTime(61000));
      await expect(result).rejects.toThrowError(/Cancelling the GitLab OAuth login after 60s/);
    });
  });
});
