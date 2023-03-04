import { Disposable } from 'vscode';
import { API } from '../../api/git';
import { accountService } from '../../accounts/account_service';
import { GitLabRemoteSourceProvider } from './gitlab_remote_source_provider';

/**
 * This class manages the creation and deletion of RemoteSourceProviders for the git.clone command for each configured instance url
 */
export class GitLabRemoteSourceProviderRepository implements Disposable {
  remoteSourceProviders = new Map<
    string,
    { provider: GitLabRemoteSourceProvider; disposable: Disposable }
  >();

  private accountServiceListener: Disposable;

  #gitAPI: API;

  constructor(gitAPI: API) {
    this.#gitAPI = gitAPI;
    this.update();
    this.accountServiceListener = accountService.onDidChange(this.update, this);
  }

  update(): void {
    const accounts = accountService.getAllAccounts();
    // create provider(s) for the missing url(s)
    accounts.forEach(account => {
      if (!this.remoteSourceProviders.has(account.id)) {
        const provider = new GitLabRemoteSourceProvider(account);
        const disposable = this.#gitAPI.registerRemoteSourceProvider(provider);
        this.remoteSourceProviders.set(account.id, { provider, disposable });
      }
    });
    // delete provider(s) for removed url(s)
    const accountIds = accounts.map(a => a.id);
    this.remoteSourceProviders.forEach((provider, accountId) => {
      if (!accountIds.includes(accountId)) {
        this.remoteSourceProviders.delete(accountId);
        provider.disposable.dispose();
      }
    });
  }

  dispose(): void {
    this.remoteSourceProviders.forEach(({ disposable }) => disposable?.dispose());
    this.remoteSourceProviders.clear();
    this.accountServiceListener.dispose();
  }
}
