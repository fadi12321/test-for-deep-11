import { Credentials } from './credentials';

export const makeAccountId = (instanceUrl: string, userId: string | number) =>
  `${instanceUrl}|${userId}`;

interface AccountBase extends Credentials {
  username: string;
  id: string;
}
export interface TokenAccount extends AccountBase {
  type: 'token';
}

export interface OAuthAccount extends AccountBase {
  type: 'oauth';
  scopes: string[];
  refreshToken: string;
  expiresAtTimestampInSeconds: number;
}

export type Account = TokenAccount | OAuthAccount;

export const serializeAccountSafe = (account: Account) =>
  JSON.stringify(account, ['instanceUrl', 'id', 'username', 'scopes']);
