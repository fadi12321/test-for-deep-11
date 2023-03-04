import { log } from '../log';
import { AccountService } from '../accounts/account_service';
import { SelectedProjectSetting } from './new_project';
import { SelectedProjectStore } from './selected_project_store';

const isOldSetting = (setting: SelectedProjectSetting): boolean =>
  !setting.accountId.match(/.*\|\d+/);

export const migrateSelectedProjects = async (
  selectedProjectStore: SelectedProjectStore,
  accountService: AccountService,
) => {
  const oldSettings = selectedProjectStore.selectedProjectSettings.filter(isOldSetting);
  await Promise.all(
    oldSettings.map(async oldSetting => {
      const account = accountService.getOneAccountForInstance(oldSetting.accountId);
      if (!account) {
        log.warn(`Could not find migrated account for instance ${oldSetting.accountId}`);
        return;
      }
      const newSetting = {
        ...oldSetting,
        accountId: account.id,
      };
      await selectedProjectStore.clearSelectedProjects(oldSetting.repositoryRootPath);
      await selectedProjectStore.addSelectedProject(newSetting);
    }),
  );
};
