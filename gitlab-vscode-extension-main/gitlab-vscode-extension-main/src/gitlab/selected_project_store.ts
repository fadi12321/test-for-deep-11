import assert from 'assert';
import vscode, { ExtensionContext } from 'vscode';
import { ProjectInRepository, SelectedProjectSetting } from './new_project';

const SELECTED_PROJECT_SETTINGS_KEY = 'selectedProjectSettings';

export const convertProjectToSetting = ({
  account,
  project,
  pointer,
}: ProjectInRepository): SelectedProjectSetting => ({
  accountId: account.id,
  namespaceWithPath: project.namespaceWithPath,
  remoteName: pointer.remote.name,
  remoteUrl: pointer.urlEntry.url,
  repositoryRootPath: pointer.repository.rootFsPath,
});

export interface SelectedProjectStore {
  addSelectedProject(selectedProject: SelectedProjectSetting): Promise<void>;
  clearSelectedProjects(rootFsPath: string): Promise<void>;
  init(context: ExtensionContext): void;
  readonly onSelectedProjectsChange: vscode.Event<readonly SelectedProjectSetting[]>;
  readonly selectedProjectSettings: SelectedProjectSetting[];
}

export class SelectedProjectStoreImpl implements SelectedProjectStore {
  #emitter = new vscode.EventEmitter<SelectedProjectSetting[]>();

  #context: ExtensionContext | undefined;

  init(context: ExtensionContext): void {
    this.#context = context;
  }

  async addSelectedProject(preferences: SelectedProjectSetting): Promise<void> {
    const selectedProjectSettings = [...this.selectedProjectSettings, preferences];
    await this.#setSelectedProjectSettings(selectedProjectSettings);
    this.#emitter.fire(selectedProjectSettings);
  }

  async clearSelectedProjects(rootFsPath: string): Promise<void> {
    const selectedProjectSettings = this.selectedProjectSettings.filter(
      pc => pc.repositoryRootPath !== rootFsPath,
    );
    await this.#setSelectedProjectSettings(selectedProjectSettings);
    this.#emitter.fire(selectedProjectSettings);
  }

  onSelectedProjectsChange = this.#emitter.event;

  async #setSelectedProjectSettings(settings: SelectedProjectSetting[]) {
    assert(this.#context);
    await this.#context.globalState.update(SELECTED_PROJECT_SETTINGS_KEY, settings);
  }

  get selectedProjectSettings(): SelectedProjectSetting[] {
    assert(this.#context);
    return this.#context.globalState.get(SELECTED_PROJECT_SETTINGS_KEY) || [];
  }
}

export const selectedProjectStore: SelectedProjectStore = new SelectedProjectStoreImpl();
