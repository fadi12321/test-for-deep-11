import * as vscode from 'vscode';
import { accountService } from '../../accounts/account_service';
import { GITLAB_URL } from '../../../test/integration/test_infrastructure/constants';
import { gitlabCredentialsProvider } from './gitlab_credentials_provider';
import { createTokenAccount } from '../../test_utils/entities';

jest.mock('../../accounts/account_service');

describe('GitLab Credentials Provider', () => {
  beforeEach(() => {
    accountService.getInstanceUrls = () => [GITLAB_URL];
    accountService.getOneAccountForInstance = (url: string) =>
      url === GITLAB_URL ? createTokenAccount() : undefined;
  });

  it('getting credentials works', async () => {
    expect(
      (await gitlabCredentialsProvider.getCredentials(vscode.Uri.parse(GITLAB_URL)))?.password,
    ).toBe('abc');
  });

  it('returns undefined for url without token', async () => {
    expect(
      await gitlabCredentialsProvider.getCredentials(vscode.Uri.parse('https://invalid.com')),
    ).toBe(undefined);
  });
});
