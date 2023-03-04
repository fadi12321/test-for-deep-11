import { ExtensionContext } from 'vscode';
import { log } from '../log';
import { notNullOrUndefined } from '../utils/not_null_or_undefined';
import { removeTrailingSlash } from '../utils/remove_trailing_slash';
import { makeAccountId } from './account';
import { AccountService } from './account_service';
import { getUserForCredentialsOrFail } from './get_user_for_credentials_or_fail';

const TOKENS_KEY = 'glTokens';
const MIGRATED_CREDENTIALS = 'glMigratedCredentials';

export const migrateCredentials = async (
  context: ExtensionContext,
  accountService: AccountService,
  getUser = getUserForCredentialsOrFail,
): Promise<void> => {
  const getGlTokenMap = (): Record<string, string> => context.globalState.get(TOKENS_KEY, {});
  const migratedCredentials: string[] = context.globalState.get(MIGRATED_CREDENTIALS, []);
  const allCredentials = Object.entries(getGlTokenMap()).map(([instanceUrl, token]) => ({
    instanceUrl: removeTrailingSlash(instanceUrl),
    token,
  }));
  const unmigratedCredentials = allCredentials.filter(
    c => !migratedCredentials.includes(`${c.instanceUrl}${c.token}`),
  );
  const accounts = (
    await Promise.all(
      unmigratedCredentials.map(async credentials => {
        try {
          const user = await getUser(credentials);
          return {
            id: makeAccountId(credentials.instanceUrl, user.id),
            instanceUrl: credentials.instanceUrl,
            token: credentials.token,
            username: user.username,
            type: 'token' as const,
          };
        } catch (e) {
          log.error('Failed to migrate credentials', e);
        }
        return undefined;
      }),
    )
  ).filter(notNullOrUndefined);
  await Promise.all(
    accounts.map(async a => {
      const account = accountService.getAccount(a.id);
      if (account) {
        log.warn(
          `Account ${account.id}- ${account.username} already exists in DB. Skipping migration.`,
        );
        return;
      }
      await accountService.addAccount(a);
    }),
  );
  await context.globalState.update(MIGRATED_CREDENTIALS, [
    ...migratedCredentials,
    ...accounts.map(a => `${a.instanceUrl}${a.token}`),
  ]);
};
