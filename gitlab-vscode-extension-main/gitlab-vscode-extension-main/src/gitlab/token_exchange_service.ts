import assert from 'assert';
import { Account, makeAccountId, OAuthAccount, serializeAccountSafe } from '../accounts/account';
import { accountService, AccountService } from '../accounts/account_service';
import { GITLAB_COM_URL } from '../constants';
import { log } from '../log';
import {
  AuthorizationCodeTokenExchangeParams,
  ExchangeTokenResponse,
  GitLabService,
} from './gitlab_service';

/**
  We'll refresh the token 10s before it expires. On two hours it won't make a difference and
  I'd rather not rely on the local and server clocks being perfectly in sync. Otherwise we would
  risk making unauthorized requests.

  Note: change this value to 7170 to simulate token expiration every 30s
*/
const SMALL_GRACE_DURATION_JUST_TO_BE_SURE = 10;

const needsRefresh = (account: Account) => {
  if (account.type === 'token') return false;
  const unixTimestampNow = Math.floor(new Date().getTime() / 1000);
  return (
    account.expiresAtTimestampInSeconds - SMALL_GRACE_DURATION_JUST_TO_BE_SURE <= unixTimestampNow
  );
};

const createExpiresTimestamp = (etr: ExchangeTokenResponse): number =>
  etr.created_at + etr.expires_in;

export class TokenExchangeService {
  #accountService: AccountService;

  #refreshesInProgress: Record<string, Promise<Account> | undefined> = {};

  constructor(as = accountService) {
    this.#accountService = as;
  }

  async createOAuthAccountFromCode(
    params: AuthorizationCodeTokenExchangeParams & { scopes: readonly string[] },
  ): Promise<OAuthAccount> {
    const { code, codeVerifier } = params;
    const tokenResponse = await GitLabService.exchangeToken({
      instanceUrl: GITLAB_COM_URL,
      grantType: 'authorization_code',
      code,
      codeVerifier,
    });
    const user = await new GitLabService({
      instanceUrl: GITLAB_COM_URL,
      token: tokenResponse.access_token,
    }).getCurrentUser();
    const account: OAuthAccount = {
      instanceUrl: GITLAB_COM_URL,
      token: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAtTimestampInSeconds: createExpiresTimestamp(tokenResponse),
      id: makeAccountId(GITLAB_COM_URL, user.id),
      type: 'oauth',
      username: user.username,
      scopes: [...params.scopes],
    };
    await this.#accountService.addAccount(account);
    return account;
  }

  async refreshIfNeeded(accountId: string): Promise<Account> {
    const latestAccount = this.#accountService.getAccount(accountId);
    assert(latestAccount, `Account with id ${accountId} doesn't exist.`);
    if (!needsRefresh(latestAccount)) {
      log.debug(`Using non-expired account ${latestAccount.id}.`);
      return latestAccount;
    }
    // before we start refreshing token, let's check if some other VS Code instance already has refreshed it
    await this.#accountService.reloadCache();
    const reloadedAccount = this.#accountService.getAccount(accountId);
    assert(reloadedAccount, `Account with id ${accountId} doesn't exist.`);
    if (!needsRefresh(reloadedAccount)) {
      log.debug(`Using non-expired reloaded account ${serializeAccountSafe(latestAccount)}`);
      return reloadedAccount;
    }
    const refreshInProgress = this.#refreshesInProgress[accountId];
    if (refreshInProgress) return refreshInProgress;
    assert(latestAccount.type === 'oauth');
    log.info(`Refreshing expired token for account ${latestAccount.id}.`);
    log.debug(`Refreshing expired token for account ${serializeAccountSafe(latestAccount)}.`);
    const refresh = this.#refreshToken(latestAccount).finally(() => {
      delete this.#refreshesInProgress[accountId];
    });
    this.#refreshesInProgress[accountId] = refresh;
    return refresh;
  }

  async #refreshToken(account: OAuthAccount): Promise<OAuthAccount> {
    const { instanceUrl, refreshToken } = account;
    const response = await GitLabService.exchangeToken({
      grantType: 'refresh_token',
      instanceUrl,
      refreshToken,
    });
    const refreshedAccount: OAuthAccount = {
      ...account,
      token: response.access_token,
      refreshToken: response.refresh_token,
      expiresAtTimestampInSeconds: createExpiresTimestamp(response),
    };
    await this.#accountService.updateAccountSecret(refreshedAccount);
    log.info(`Saved refreshed token for account ${refreshedAccount.id}.`);
    log.debug(`Saved refreshed token for account ${serializeAccountSafe(refreshedAccount)}.`);
    return refreshedAccount;
  }
}

export const tokenExchangeService = new TokenExchangeService();
