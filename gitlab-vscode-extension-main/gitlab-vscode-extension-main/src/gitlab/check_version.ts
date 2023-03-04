import * as vscode from 'vscode';
import { DO_NOT_SHOW_VERSION_WARNING, MINIMUM_VERSION } from '../constants';
import { log } from '../log';
import { ifVersionGte } from '../utils/if_version_gte';
import { ProjectInRepository } from './new_project';
import { getGitLabService } from './get_gitlab_service';
import { gitlabProjectRepository } from './gitlab_project_repository';
import { groupBy } from '../utils/group_by';
import { notNullOrUndefined } from '../utils/not_null_or_undefined';

const instanceUrlsWithShownWarnings: Record<string, boolean> = {};

const checkVersion = async (
  projectInRepository: ProjectInRepository,
  version: string,
  context: vscode.ExtensionContext,
): Promise<void> => {
  const DO_NOT_SHOW_AGAIN_TEXT = 'Do not show again';
  const { instanceUrl } = projectInRepository.account;
  if (instanceUrl in instanceUrlsWithShownWarnings) return;
  await ifVersionGte(
    version,
    MINIMUM_VERSION,
    () => undefined,
    async () => {
      const warningMessage = `
        This extension requires GitLab version ${MINIMUM_VERSION} or later.
        GitLab instance located at: ${instanceUrl} is currently using ${version}.
      `;

      log.warn(warningMessage);

      let versionWarningRecords: undefined | Record<string, boolean> = context.workspaceState.get(
        DO_NOT_SHOW_VERSION_WARNING,
      );
      if (typeof versionWarningRecords !== 'object') {
        await context.workspaceState.update(DO_NOT_SHOW_VERSION_WARNING, {});
        versionWarningRecords = {};
      }
      if (versionWarningRecords[instanceUrl]) return;

      const action = await vscode.window.showErrorMessage(warningMessage, DO_NOT_SHOW_AGAIN_TEXT);
      instanceUrlsWithShownWarnings[instanceUrl] = true;

      if (action === DO_NOT_SHOW_AGAIN_TEXT)
        await context.workspaceState.update(DO_NOT_SHOW_VERSION_WARNING, {
          ...versionWarningRecords,
          [instanceUrl]: true,
        });
    },
  );
};

type ProjectWithVersion = readonly [ProjectInRepository, string];

const getUniqueInstanceVersions = async (
  projectsInRepository: ProjectInRepository[],
): Promise<ProjectWithVersion[]> => {
  const projectsByInstanceUrl = groupBy(projectsInRepository, p => p.account.instanceUrl);
  const projectsInRepositoriesWithVersions = await Promise.all(
    Object.values(projectsByInstanceUrl).map(async ([firstProject]) => {
      const service = getGitLabService(firstProject);
      const version = await service.getVersion();
      if (!version) return undefined;
      return [firstProject, version] as const;
    }),
  );
  return projectsInRepositoriesWithVersions.filter(notNullOrUndefined);
};

const checkEveryVersion = async (context: vscode.ExtensionContext): Promise<void> => {
  const projects = gitlabProjectRepository.getDefaultAndSelectedProjects();
  const projectsWithVersions = await getUniqueInstanceVersions(projects);
  await Promise.all(
    projectsWithVersions.map(async ([project, version]) => {
      await checkVersion(project, version, context);
    }),
  );
};

export const setupVersionCheck = async (context: vscode.ExtensionContext) => {
  gitlabProjectRepository.onProjectChange(async () => {
    await checkEveryVersion(context);
  });
  await checkEveryVersion(context);
};
