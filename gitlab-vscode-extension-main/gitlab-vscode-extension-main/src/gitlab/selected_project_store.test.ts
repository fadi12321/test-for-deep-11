import { ExtensionContext } from 'vscode';
import { SelectedProjectSetting } from './new_project';
import { SelectedProjectStoreImpl } from './selected_project_store';

describe('SelectedProjectStoreImpl', () => {
  let store = new SelectedProjectStoreImpl();

  const testSelectedProject: SelectedProjectSetting = {
    accountId: 'https://gitlab.com',
    namespaceWithPath: 'gitlab-org/gitlab',
    remoteName: 'origin',
    remoteUrl: 'git@gitlab.com:gitlab-org/gitlab.git',
    repositoryRootPath: '/path/to/repo',
  };

  beforeEach(() => {
    store = new SelectedProjectStoreImpl();
    let selectedProjectSettings: SelectedProjectSetting[] = [];
    const fakeContext = {
      globalState: {
        get: () => selectedProjectSettings,
        update: (name: string, settings: SelectedProjectSetting[]) => {
          selectedProjectSettings = settings;
        },
      },
    };
    store.init(fakeContext as unknown as ExtensionContext);
  });

  it('can add selected project', async () => {
    await store.addSelectedProject(testSelectedProject);
    expect(store.selectedProjectSettings[0]).toEqual(testSelectedProject);
  });

  it('can delete selected projects', async () => {
    await store.addSelectedProject(testSelectedProject);
    await store.clearSelectedProjects('/path/to/repo');
    expect(store.selectedProjectSettings).toHaveLength(0);
  });

  it('notifies when settings change', async () => {
    const listener = jest.fn();
    store.onSelectedProjectsChange(listener);

    await store.addSelectedProject(testSelectedProject);
    expect(listener).toHaveBeenCalledWith([testSelectedProject]);

    await store.clearSelectedProjects('/path/to/repo');
    expect(listener).toHaveBeenCalledWith([]);
  });
});
