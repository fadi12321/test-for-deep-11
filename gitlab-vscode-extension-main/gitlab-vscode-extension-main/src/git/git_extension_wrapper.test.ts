import * as vscode from 'vscode';
import { GitExtensionWrapper } from './git_extension_wrapper';
import { GitLabRemoteSourceProviderRepository } from '../gitlab/clone/gitlab_remote_source_provider_repository';
import { gitlabCredentialsProvider } from '../gitlab/clone/gitlab_credentials_provider';
import { createFakeRepository, FakeGitExtension } from '../test_utils/fake_git_extension';
import { GitRepositoryImpl } from './new_git';

jest.mock('../gitlab/clone/gitlab_credentials_provider');
jest.mock('../gitlab/clone/gitlab_remote_source_provider_repository');

describe('GitExtensionWrapper', () => {
  let fakeExtension: FakeGitExtension;
  let wrapper: GitExtensionWrapper;

  beforeEach(async () => {
    wrapper = new GitExtensionWrapper();
    fakeExtension = new FakeGitExtension();
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue({ exports: fakeExtension });
  });

  describe('initialization', () => {
    it('creates a new GitLabRemoteSourceProviderRepository', async () => {
      await wrapper.init();

      expect(GitLabRemoteSourceProviderRepository).toHaveBeenCalledWith(fakeExtension.gitApi);
    });

    it('adds credentials provider to the Git Extension', async () => {
      await wrapper.init();

      expect(fakeExtension.gitApi.credentialsProviders).toEqual([gitlabCredentialsProvider]);
    });
  });

  describe('repositories', () => {
    const fakeRepository = createFakeRepository({ rootUriPath: '/repository/root/path/' });
    const fakeRepository2 = createFakeRepository({ rootUriPath: '/repository/root/path2/' });
    const createPromiseThatResolvesWhenRepoCountChanges = () =>
      new Promise<void>(resolve => {
        const sub = wrapper.onRepositoryCountChanged(() => {
          sub.dispose();
          resolve(undefined);
        });
      });

    it('returns no repositories when the extension is disabled', async () => {
      fakeExtension.gitApi.repositories = [fakeRepository];
      fakeExtension.enabled = false;

      await wrapper.init();

      expect(wrapper.gitRepositories).toEqual([]);
    });

    it('returns git repositories when the extension is enabled', async () => {
      fakeExtension.gitApi.repositories = [fakeRepository];

      await wrapper.init();

      expect(wrapper.gitRepositories).toEqual([new GitRepositoryImpl(fakeRepository)]);
    });

    describe('reacts to changes to repository count', () => {
      it.each`
        scenario                    | fireEvent
        ${'repository was opened'}  | ${() => fakeExtension.gitApi.onDidOpenRepositoryEmitter.fire(fakeRepository)}
        ${'repository was closed'}  | ${() => fakeExtension.gitApi.onDidCloseRepositoryEmitter.fire(fakeRepository)}
        ${'extension was disabled'} | ${() => fakeExtension.onDidChangeEnablementEmitter.fire(false)}
        ${'extension was enabled'}  | ${() => fakeExtension.onDidChangeEnablementEmitter.fire(true)}
      `('calls onRepositoryCountChanged listener when $scenario', async ({ fireEvent }) => {
        const onRepositoryCountChangedListener = jest.fn();
        await wrapper.init();
        wrapper.onRepositoryCountChanged(onRepositoryCountChangedListener);

        const countChangedPromise = createPromiseThatResolvesWhenRepoCountChanges();
        await fireEvent();
        await countChangedPromise;

        expect(onRepositoryCountChangedListener).toHaveBeenCalled();
      });
    });

    it('adds a new wrapped repository when repository is opened', async () => {
      fakeExtension.gitApi.repositories = [fakeRepository];
      await wrapper.init();

      const countChangedPromise = createPromiseThatResolvesWhenRepoCountChanges();
      fakeExtension.gitApi.onDidOpenRepositoryEmitter.fire(fakeRepository2);
      await countChangedPromise;

      expect(wrapper.gitRepositories.map(r => r.rootFsPath)).toEqual([
        fakeRepository.rootUri.fsPath,
        fakeRepository2.rootUri.fsPath,
      ]);
    });

    it('removes wrapped repository when repository is closed', async () => {
      fakeExtension.gitApi.repositories = [fakeRepository, fakeRepository2];
      await wrapper.init();

      fakeExtension.gitApi.onDidCloseRepositoryEmitter.fire(fakeRepository);

      expect(wrapper.gitRepositories.map(r => r.rootFsPath)).toEqual([
        fakeRepository2.rootUri.fsPath,
      ]);
    });

    it('adds all repositories when the git extension gets enabled', async () => {
      fakeExtension.gitApi.repositories = [fakeRepository, fakeRepository2];
      fakeExtension.enabled = false;
      await wrapper.init();

      const countChangedPromise = createPromiseThatResolvesWhenRepoCountChanges();
      fakeExtension.onDidChangeEnablementEmitter.fire(true);
      await countChangedPromise;

      expect(wrapper.gitRepositories.map(r => r.rootFsPath)).toEqual([
        fakeRepository.rootUri.fsPath,
        fakeRepository2.rootUri.fsPath,
      ]);
    });
  });
});
