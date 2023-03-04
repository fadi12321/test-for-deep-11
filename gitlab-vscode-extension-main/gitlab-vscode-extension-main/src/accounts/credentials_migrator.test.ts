import { ExtensionContext } from 'vscode';
import { createTokenAccount, user } from '../test_utils/entities';
import { SecretStorage } from '../test_utils/secret_storage';
import { AccountService } from './account_service';
import { Credentials } from './credentials';
import { migrateCredentials } from './credentials_migrator';

/*
  These keys are not imported from the production code because they are
  already present on users' computers and can't be changed. We want tests
  to fail if they change.
*/
const TOKENS_KEY = 'glTokens';
const MIGRATED_CREDENTIALS = 'glMigratedCredentials';

describe('CredentialsMigrator', () => {
  let globalStateContent: Record<string, any>;
  let accountService: AccountService;
  let fakeContext: ExtensionContext;
  let users: Record<string, RestUser>;

  const getUser = async (c: Credentials) => {
    const user = users[`${c.instanceUrl}-${c.token}`];
    if (!user) throw new Error('no user');
    return user;
  };

  beforeEach(async () => {
    globalStateContent = { [TOKENS_KEY]: [], [MIGRATED_CREDENTIALS]: [] };
    fakeContext = {
      globalState: {
        get: (key: string, defaultVal: any) => globalStateContent[key] || defaultVal,
        update: async (key: string, value: any) => {
          globalStateContent[key] = value;
        },
      },
      secrets: new SecretStorage(),
    } as unknown as ExtensionContext;
    users = {};
    accountService = new AccountService();
    await accountService.init(fakeContext);
  });

  it('migrates credentials', async () => {
    globalStateContent[TOKENS_KEY] = { 'https://gitlab.com': 'abc' };
    users = { 'https://gitlab.com-abc': user };

    await migrateCredentials(fakeContext, accountService, getUser);

    expect(accountService.getAllAccounts()).toHaveLength(1);
    const [account] = accountService.getAllAccounts();
    expect(account.id).toBe('https://gitlab.com|123');
    expect(account.instanceUrl).toBe('https://gitlab.com');
  });

  it('removes trailing slash for token instance URL', async () => {
    globalStateContent[TOKENS_KEY] = { 'https://gitlab.com/': 'abc' };
    users = { 'https://gitlab.com-abc': user };

    await migrateCredentials(fakeContext, accountService, getUser);

    expect(accountService.getAllAccounts()).toHaveLength(1);
    const [account] = accountService.getAllAccounts();
    expect(account.instanceUrl).toBe('https://gitlab.com');
  });

  it('does not migrate credentials twice', async () => {
    globalStateContent[TOKENS_KEY] = { 'https://gitlab.com': 'abc' };
    users = { 'https://gitlab.com-abc': user };

    await migrateCredentials(fakeContext, accountService, getUser);

    expect(accountService.getAllAccounts()).toHaveLength(1);

    await migrateCredentials(fakeContext, accountService, getUser);

    expect(accountService.getAllAccounts()).toHaveLength(1);
  });

  it('does not override existing account', async () => {
    globalStateContent[TOKENS_KEY] = { 'https://gitlab.com': 'abc' };
    users = { 'https://gitlab.com-abc': user };

    await accountService.addAccount(createTokenAccount('https://gitlab.com', user.id, 'oldToken'));

    await migrateCredentials(fakeContext, accountService, getUser);

    expect(accountService.getAllAccounts()).toHaveLength(1);

    const [account] = accountService.getAllAccounts();
    expect(account.token).toBe('oldToken');
  });

  it('tries to migrate credentials until it succeeds', async () => {
    globalStateContent[TOKENS_KEY] = { 'https://gitlab.com/': 'abc' };

    await migrateCredentials(fakeContext, accountService, getUser); // the API call to get user will fail

    expect(accountService.getAllAccounts()).toHaveLength(0);

    users = { 'https://gitlab.com-abc': user }; // now we add the user

    await migrateCredentials(fakeContext, accountService, getUser);

    expect(accountService.getAllAccounts()).toHaveLength(1);
  });
});
