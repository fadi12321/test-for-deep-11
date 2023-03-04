import * as vscode from 'vscode';
import { DO_NOT_SHOW_VERSION_WARNING } from '../constants';
import { setupVersionCheck } from './check_version';
import { log } from '../log';
import { gitlabProjectRepository } from './gitlab_project_repository';
import { GitLabService } from './gitlab_service';
import SpyInstance = jest.SpyInstance;
import { createExtensionContext, createTokenAccount } from '../test_utils/entities';
import { accountService } from '../accounts/account_service';

describe('check_version', () => {
  describe('getVersionForEachRepo', () => {
    let mockedRepositories: any[];
    let context: any;
    let versions: Record<string, string | undefined>;
    let getVersionMock: SpyInstance<Promise<string | undefined>> | undefined;
    const createMockRepoAndMockVersionResponse = async (instanceVersion: string, url: string) => {
      versions[url] = instanceVersion;
      const account = createTokenAccount(url);
      await accountService.addAccount(account);
      return { account };
    };

    beforeEach(async () => {
      versions = {};
      context = createExtensionContext();
      await accountService.init(context);
      jest
        .spyOn(gitlabProjectRepository, 'getDefaultAndSelectedProjects')
        .mockImplementation(() => mockedRepositories);
      getVersionMock = jest
        .spyOn(GitLabService.prototype, 'getVersion')
        .mockImplementation(async function (this: GitLabService) {
          const { instanceUrl } = await this.getCredentials();
          return versions[instanceUrl];
        });

      jest.spyOn(log, 'warn');
    });

    it('does nothing when there are no repos', async () => {
      mockedRepositories = [];
      await setupVersionCheck(context);
      expect(getVersionMock).not.toHaveBeenCalled();
    });

    it.each`
      version
      ${'13.6.0'}
      ${'13.7.3'}
      ${'13.7.0-pre'}
      ${'13.7.0-pre-1'}
      ${'13.12.4'}
      ${'14.0.0'}
      ${'abc13.6def'}
    `('gets $version successfully', async ({ version }) => {
      mockedRepositories = [await createMockRepoAndMockVersionResponse(`${version}`, 'foo1')];

      await setupVersionCheck(context);
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it(`shows warning when version is below 13.6`, async () => {
      mockedRepositories = [await createMockRepoAndMockVersionResponse(`13.5.2`, 'foo2')];

      await setupVersionCheck(context);
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('stores user preference for not showing the warning', async () => {
      mockedRepositories = [await createMockRepoAndMockVersionResponse('13.4', 'foo3')];
      (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Do not show again');

      await setupVersionCheck(context);

      expect(context.workspaceState.get(DO_NOT_SHOW_VERSION_WARNING)).toStrictEqual({
        foo3: true,
      });
    });

    it('does not show warning if user said they do not want to see it', async () => {
      mockedRepositories = [await createMockRepoAndMockVersionResponse('13.4', 'foo4')];
      await context.workspaceState.update(DO_NOT_SHOW_VERSION_WARNING, { foo4: true });

      await setupVersionCheck(context);

      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
  });
});
