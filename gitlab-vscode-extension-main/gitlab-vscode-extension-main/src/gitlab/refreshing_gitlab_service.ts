import { Account } from '../accounts/account';
import { Credentials } from '../accounts/credentials';
import { GitLabService } from './gitlab_service';
import { TokenExchangeService, tokenExchangeService } from './token_exchange_service';

export class RefreshingGitLabService extends GitLabService {
  #accountId: string;

  #tokenExchangeService: TokenExchangeService;

  constructor(account: Account, tes = tokenExchangeService) {
    super({ instanceUrl: account.instanceUrl, token: account.token });
    this.#accountId = account.id;
    this.#tokenExchangeService = tes;
  }

  async getCredentials(): Promise<Credentials> {
    return this.#tokenExchangeService.refreshIfNeeded(this.#accountId);
  }
}
