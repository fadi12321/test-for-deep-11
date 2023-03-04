import { accountService } from '../../accounts/account_service';
import { API } from '../../api/git';
import { GitLabRemoteSourceProviderRepository } from './gitlab_remote_source_provider_repository';
import { FakeGitExtension } from '../../test_utils/fake_git_extension';
import { createTokenAccount } from '../../test_utils/entities';

jest.mock('../../accounts/account_service');

describe('GitLabRemoteSourceProviderRepository', () => {
  let fakeExtension: FakeGitExtension;
  let tokenChangeListener: () => unknown;

  beforeEach(async () => {
    fakeExtension = new FakeGitExtension();
    (accountService as any).onDidChange = (listener: () => unknown, bindThis: unknown) => {
      tokenChangeListener = () => listener.call(bindThis);
    };
  });

  it('remote source provider created for new token', async () => {
    accountService.getAllAccounts = () => [createTokenAccount('https://test2.gitlab.com', 1)];
    // TODO: maybe introduce something like an initialize method instead of doing the work in constructor
    // eslint-disable-next-line no-new
    new GitLabRemoteSourceProviderRepository(fakeExtension.gitApi as unknown as API);

    expect(fakeExtension.gitApi.remoteSourceProviders.length).toBe(1);

    accountService.getAllAccounts = () => [
      createTokenAccount('https://test2.gitlab.com', 1),
      createTokenAccount('https://test2.gitlab.com', 2),
      createTokenAccount('https://test3.gitlab.com'),
    ];

    tokenChangeListener();

    expect(fakeExtension.gitApi.remoteSourceProviders.length).toBe(3);
  });

  it('remote source providers disposed after token removal', async () => {
    accountService.getAllAccounts = () => [
      createTokenAccount('https://test2.gitlab.com'),
      createTokenAccount('https://test3.gitlab.com'),
    ];
    // TODO: maybe introduce something like an initialize method instead of doing the work in constructor
    // eslint-disable-next-line no-new
    new GitLabRemoteSourceProviderRepository(fakeExtension.gitApi as unknown as API);

    expect(fakeExtension.gitApi.remoteSourceProviders.length).toBe(2);

    accountService.getAllAccounts = () => [createTokenAccount('https://test2.gitlab.com')];

    tokenChangeListener();

    expect(fakeExtension.gitApi.remoteSourceProviders.length).toBe(1);
  });
});
