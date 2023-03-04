import { Uri } from 'vscode';
import { Credentials, CredentialsProvider } from '../../api/git';
import { accountService } from '../../accounts/account_service';

export const gitlabCredentialsProvider: CredentialsProvider = {
  async getCredentials(host: Uri): Promise<Credentials | undefined> {
    const matchingInstance = accountService.getInstanceUrls().find(url => {
      const instanceURI = Uri.parse(url);
      return host.scheme === instanceURI.scheme && host.authority === instanceURI.authority;
    });
    if (matchingInstance) {
      const account = accountService.getOneAccountForInstance(matchingInstance);
      if (account) {
        return {
          username: 'arbitrary_username_ignored_by_gitlab',
          password: account.token,
        };
      }
    }

    return undefined;
  },
};
