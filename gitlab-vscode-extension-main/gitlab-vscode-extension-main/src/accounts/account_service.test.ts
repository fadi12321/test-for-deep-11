import { createOAuthAccount, createTokenAccount } from '../test_utils/entities';
import { SecretStorage } from '../test_utils/secret_storage';
import { Account, OAuthAccount } from './account';
import { AccountService } from './account_service';

const SECRETS_KEY = 'gitlab-tokens';

type AccountMap = Record<string, Account | undefined>;
describe('AccountService', () => {
  let accountMap: AccountMap;
  let accountService: AccountService;
  let secrets: SecretStorage;
  let fakeContext: any;

  beforeEach(async () => {
    accountMap = {};
    secrets = new SecretStorage();
    fakeContext = {
      globalState: {
        get: () => accountMap,
        update: (name: string, am: AccountMap) => {
          accountMap = am;
        },
      },
      secrets,
    };
    accountService = new AccountService();
    await accountService.init(fakeContext);
  });

  it('adds account', async () => {
    const account = createTokenAccount();
    await accountService.addAccount(account);

    expect(accountService.getAllAccounts()).toHaveLength(1);
    expect(accountService.getAllAccounts()).toEqual([account]);
  });

  it('does not add a duplicate account', async () => {
    const account = createTokenAccount('https://gitlab.com', 1, 'abc');
    await accountService.addAccount(account);
    const duplicateAccount = createTokenAccount('https://gitlab.com', 1, 'def');

    await expect(accountService.addAccount(duplicateAccount)).rejects.toThrowError(
      /already exists/,
    );
    expect(accountService.getAllAccounts()).toHaveLength(1);
    expect(accountService.getAllAccounts()).toEqual([account]);
  });

  describe('when other VS Code window changes the secrets', () => {
    let account: Account;
    beforeEach(async () => {
      account = createTokenAccount('https://gitlab.com', 1, 'abc');
      await accountService.addAccount(account);
      // other VS Code window manipulated the secrets
      await secrets.store('gitlab-tokens', '{"https://gitlab.com|1": {"token": "xyz"}}');
    });

    it('fails to write a secret when some other process changed the secret but refreshes the secrets cache', async () => {
      await expect(
        accountService.updateAccountSecret(createTokenAccount('https://gitlab.com', 1, 'def')),
      ).rejects.toThrow(/GitLab token .* has changed/);

      expect(accountService.getAccount(account.id)?.token).toBe('xyz');
    });

    it('reloads the cache', async () => {
      await accountService.reloadCache();

      expect(accountService.getAccount(account.id)?.token).toBe('xyz');
    });
  });

  it('removes account', async () => {
    const account = createTokenAccount();

    await accountService.addAccount(account);

    expect(accountService.getAllAccounts()).toHaveLength(1);

    await accountService.removeAccount(account.id);

    expect(accountService.getAllAccounts()).toHaveLength(0);
    expect(await secrets.get(SECRETS_KEY)).toBe('{}');
  });

  it('offers account for removal even if it does not have a token', async () => {
    const account = createTokenAccount();

    await accountService.addAccount(account);

    await secrets.store(SECRETS_KEY, '{}');
    await accountService.init(fakeContext); // reload secrets from the store

    expect(accountService.getAllAccounts()).toHaveLength(0); // the account can't be used
    expect(await accountService.getUpToDateRemovableAccounts()).toHaveLength(1); // but it can be removed
  });

  describe('account from environment variable', () => {
    afterEach(() => {
      delete process.env.GITLAB_WORKFLOW_INSTANCE_URL;
      delete process.env.GITLAB_WORKFLOW_TOKEN;
    });

    it('adds account', () => {
      process.env.GITLAB_WORKFLOW_INSTANCE_URL = 'https://gitlab.com';
      process.env.GITLAB_WORKFLOW_TOKEN = 'abc';

      expect(accountService.getAllAccounts()).toHaveLength(1);

      expect(accountService.getAllAccounts()[0]).toEqual({
        id: 'https://gitlab.com|environment-variables',
        instanceUrl: 'https://gitlab.com',
        token: 'abc',
        username: 'environment_variable_credentials',
        type: 'token',
      });
    });

    it('sanitizes instance URL from env', () => {
      process.env.GITLAB_WORKFLOW_INSTANCE_URL = 'https://gitlab.com/';
      process.env.GITLAB_WORKFLOW_TOKEN = 'abc';

      expect(accountService.getAllAccounts()).toHaveLength(1);

      expect(accountService.getAllAccounts()[0]).toEqual({
        id: 'https://gitlab.com|environment-variables',
        instanceUrl: 'https://gitlab.com',
        token: 'abc',
        username: 'environment_variable_credentials',
        type: 'token',
      });
    });
  });

  it('can set and get one account', async () => {
    expect(accountService.getOneAccountForInstance('https://gitlab.com')).toBeUndefined();

    await accountService.addAccount(createTokenAccount('https://gitlab.com', 1, 'abc'));
    expect(accountService.getOneAccountForInstance('https://gitlab.com')?.token).toBe('abc');
  });

  it('can retrieve all instance URLs', async () => {
    await accountService.addAccount(createTokenAccount('https://gitlab.com', 1, 'abc'));
    await accountService.addAccount(createTokenAccount('https://dev.gitlab.com', 1, 'def'));
    expect((await accountService.getUpToDateRemovableAccounts()).map(a => a.instanceUrl)).toEqual([
      'https://gitlab.com',
      'https://dev.gitlab.com',
    ]);
  });

  it('can get account based on ID', async () => {
    const firstAccount = createTokenAccount('https://gitlab.com', 1, 'abc');
    const secondAccount = createTokenAccount('https://dev.gitlab.com', 1, 'def');
    await accountService.addAccount(firstAccount);
    await accountService.addAccount(secondAccount);

    const result = accountService.getAccount(firstAccount.id);

    expect(result).toEqual(firstAccount);
  });

  describe('updateAccountSecret', () => {
    it('can update Token Account', async () => {
      const firstAccount = createTokenAccount('https://gitlab.com', 1, 'abc');
      const updatedTokenAccount = { ...firstAccount, token: 'xyz' };
      await accountService.addAccount(firstAccount);

      await accountService.updateAccountSecret(updatedTokenAccount);

      const result = accountService.getAccount(firstAccount.id);

      expect(result).toEqual(updatedTokenAccount);
    });

    it('can update OAuth Account', async () => {
      const nowTimestamp = Math.floor(new Date().getTime() / 1000);
      const account = createOAuthAccount();
      const updatedOAuthAccount = {
        ...account,
        token: 'xyz',
        refreshToken: 'z12',
        expiresAtTimestampInSeconds: nowTimestamp + 30,
      };
      await accountService.addAccount(account);

      await accountService.updateAccountSecret(updatedOAuthAccount);

      const result = accountService.getAccount(account.id);

      expect(result).toEqual(updatedOAuthAccount);
    });
  });
  describe('OAuth accounts', () => {
    let account: OAuthAccount;

    beforeEach(async () => {
      account = createOAuthAccount();
      await accountService.addAccount(account);
    });

    it('can store OAuth account', async () => {
      const result = accountService.getAccount(account.id);

      expect(result).toEqual(account);
    });

    it('does not store secrets in global state', async () => {
      expect(accountMap[account.id]).toEqual({
        ...account,
        token: undefined,
        refreshToken: undefined,
        expiresAtTimestampInSeconds: undefined,
      });
    });
  });
});
