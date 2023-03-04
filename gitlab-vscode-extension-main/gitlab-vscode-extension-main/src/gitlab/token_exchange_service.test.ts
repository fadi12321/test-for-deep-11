import { ExtensionContext } from 'vscode';
import { AccountService } from '../accounts/account_service';
import { asMock } from '../test_utils/as_mock';
import {
  createExtensionContext,
  createOAuthAccount,
  createTokenAccount,
} from '../test_utils/entities';
import { GitLabService } from './gitlab_service';
import { TokenExchangeService } from './token_exchange_service';

jest.mock('./gitlab_service');

const unixTimestampNow = () => Math.floor(new Date().getTime() / 1000);

describe('TokenExchangeService', () => {
  describe('refreshing token', () => {
    let extensionContext: ExtensionContext;
    let accountService: AccountService;
    let tokenExchangeService: TokenExchangeService;
    const tokenExpiresIn = 7200;

    beforeEach(async () => {
      accountService = new AccountService();
      extensionContext = createExtensionContext();
      await accountService.init(extensionContext);
      tokenExchangeService = new TokenExchangeService(accountService);
    });
    it('returns unchanged TokenAccount', async () => {
      const tokenAccount = createTokenAccount();
      await accountService.addAccount(tokenAccount);

      const result = await tokenExchangeService.refreshIfNeeded(tokenAccount.id);

      expect(result).toEqual(tokenAccount);
    });

    it('returns valid OAuth account without change', async () => {
      const oauthAccount = createOAuthAccount();
      await accountService.addAccount(oauthAccount);

      const result = await tokenExchangeService.refreshIfNeeded(oauthAccount.id);

      expect(result).toEqual(oauthAccount);
    });

    it('refreshes expired OAuth account', async () => {
      const timestampNow = unixTimestampNow();

      const expiredAccount = {
        ...createOAuthAccount(),
        refreshToken: 'def',
        codeVerifier: 'abc',
        expiresAtTimestampInSeconds: timestampNow - 60, // expired 60s ago
      };
      await accountService.addAccount(expiredAccount);
      // mock API token refresh response
      asMock(GitLabService.exchangeToken).mockResolvedValue({
        access_token: 'new_token',
        refresh_token: 'new_refresh_token',
        expires_in: tokenExpiresIn,
        created_at: timestampNow,
      });

      const result = await tokenExchangeService.refreshIfNeeded(expiredAccount.id);

      // account has been refreshed
      expect(result).toEqual({
        ...expiredAccount,
        refreshToken: 'new_refresh_token',
        token: 'new_token',
        expiresAtTimestampInSeconds: timestampNow + tokenExpiresIn,
      });
      // verify that we called API with correct parameters
      const { refreshToken, instanceUrl } = expiredAccount;
      expect(GitLabService.exchangeToken).toHaveBeenCalledWith({
        grantType: 'refresh_token',
        refreshToken,
        instanceUrl,
      });
    });

    it('reloads secrets from OS Keychain before refreshing expired OAuth account', async () => {
      const timestampNow = unixTimestampNow();

      const expiredAccount = {
        ...createOAuthAccount(),
        refreshToken: 'def',
        codeVerifier: 'abc',
        expiresAtTimestampInSeconds: timestampNow - 60, // expired 60s ago
      };
      await accountService.addAccount(expiredAccount);

      // simulate another VS Code instance on the OS refreshing the token
      const secondAccountService = new AccountService();
      await secondAccountService.init(extensionContext);
      await secondAccountService.updateAccountSecret({
        ...expiredAccount,
        token: 'new_token',
        refreshToken: 'new_refresh_token',
        expiresAtTimestampInSeconds: timestampNow + tokenExpiresIn,
      });

      const result = await tokenExchangeService.refreshIfNeeded(expiredAccount.id);

      // refreshed account has been loaded from the secure storage
      expect(result).toEqual({
        ...expiredAccount,
        refreshToken: 'new_refresh_token',
        token: 'new_token',
        expiresAtTimestampInSeconds: timestampNow + tokenExpiresIn,
      });
      expect(GitLabService.exchangeToken).not.toHaveBeenCalled();
    });
  });
});
