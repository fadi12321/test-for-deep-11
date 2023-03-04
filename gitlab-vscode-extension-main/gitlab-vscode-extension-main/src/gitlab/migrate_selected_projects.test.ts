import { ExtensionContext } from 'vscode';
import { InMemoryMemento } from '../../test/integration/test_infrastructure/in_memory_memento';
import { makeAccountId } from '../accounts/account';
import { AccountService } from '../accounts/account_service';
import { createTokenAccount } from '../test_utils/entities';
import { SecretStorage } from '../test_utils/secret_storage';
import { migrateSelectedProjects } from './migrate_selected_projects';
import { SelectedProjectStore, SelectedProjectStoreImpl } from './selected_project_store';

describe('migrateSelectedProjects', () => {
  let fakeContext: ExtensionContext;
  let accountService: AccountService;
  let selectedProjectStore: SelectedProjectStore;

  beforeEach(async () => {
    fakeContext = {
      globalState: new InMemoryMemento(),
      secrets: new SecretStorage(),
    } as unknown as ExtensionContext;
    accountService = new AccountService();
    await accountService.init(fakeContext);
    selectedProjectStore = new SelectedProjectStoreImpl();
    selectedProjectStore.init(fakeContext);
  });

  const oldSetting = {
    accountId: 'https://gitlab.com',
    namespaceWithPath: 'group/project',
    remoteName: 'origin',
    remoteUrl: 'git@gitlab.com:group/path.git',
    repositoryRootPath: '/path/to/repo',
  };

  it('migrates old selected project', async () => {
    await accountService.addAccount(createTokenAccount('https://gitlab.com', 123));
    await selectedProjectStore.addSelectedProject(oldSetting);

    await migrateSelectedProjects(selectedProjectStore, accountService);

    expect(selectedProjectStore.selectedProjectSettings).toHaveLength(1);

    const [setting] = selectedProjectStore.selectedProjectSettings;

    expect(setting).toEqual({ ...oldSetting, accountId: makeAccountId('https://gitlab.com', 123) });
  });

  it('does not migrate setting when there is no account for it', async () => {
    await selectedProjectStore.addSelectedProject(oldSetting);

    await migrateSelectedProjects(selectedProjectStore, accountService);

    expect(selectedProjectStore.selectedProjectSettings).toHaveLength(1);

    const [setting] = selectedProjectStore.selectedProjectSettings;

    expect(setting).toEqual(oldSetting);
  });
});
