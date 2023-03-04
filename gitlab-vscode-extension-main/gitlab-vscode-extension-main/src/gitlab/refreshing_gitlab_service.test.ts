import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account_service';
import { createExtensionContext, createOAuthAccount } from '../test_utils/entities';
import { RefreshingGitLabService } from './refreshing_gitlab_service';
import { TokenExchangeService } from './token_exchange_service';

describe('RefreshingGitLabService', () => {
  let accountService: AccountService;
  let service: RefreshingGitLabService;
  let account: Account;

  beforeEach(async () => {
    accountService = new AccountService();
    await accountService.init(createExtensionContext());
    account = createOAuthAccount();
    await accountService.addAccount(account);

    service = new RefreshingGitLabService(account, new TokenExchangeService(accountService));
  });

  it('uses account from AccountService', async () => {
    expect(await service.getCredentials()).toEqual(account);
  });

  it('loads the latest account from account service', async () => {
    const updatedAccount = { ...account, token: 'xyz' };
    await accountService.updateAccountSecret(updatedAccount);

    expect(await service.getCredentials()).toEqual(updatedAccount);
  });
});
