import vscode from 'vscode';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';
import { createRemoteUrlPointers, GitRemoteUrlPointer, GitRepository } from '../git/new_git';
import { MultipleProjectsItem } from '../tree_view/items/multiple_projects_item';
import { NoProjectItem } from '../tree_view/items/no_project_item';
import { ProjectItemModel } from '../tree_view/items/project_item_model';
import { getGitLabServiceForAccount } from './get_gitlab_service';
import { gitlabProjectRepository } from './gitlab_project_repository';
import { ProjectInRepository } from './new_project';
import { pickAccount } from './pick_account';
import { pickProject } from './pick_project';
import { convertProjectToSetting, selectedProjectStore } from './selected_project_store';

const selectRepository = async (): Promise<GitRepository | undefined> => {
  const options = gitExtensionWrapper.gitRepositories.map(repository => ({
    repository,
    label: repository.rootFsPath,
  }));
  const choice = await vscode.window.showQuickPick(options, { title: 'Select Git repository' });
  if (!choice) return undefined;
  return choice.repository;
};

const pickRemoteUrl = async (pointers: GitRemoteUrlPointer[]) => {
  if (pointers.length === 0) return undefined;
  if (pointers.length === 1) return pointers[0];
  return vscode.window.showQuickPick(
    pointers.map(p => ({ ...p, label: p.urlEntry.url, description: p.remote.name })),
    { title: 'Select remote URL' },
  );
};

const manuallyAssignProject = async (repository: GitRepository) => {
  const account = await pickAccount();
  if (!account) return;
  const pointer = await pickRemoteUrl(createRemoteUrlPointers(repository));
  if (!pointer) return;
  const project = await pickProject(getGitLabServiceForAccount(account));
  if (!project) return;
  const projectInRepository: ProjectInRepository = {
    account,
    pointer,
    project,
    initializationType: 'selected',
  };
  const selectedProjectSetting = convertProjectToSetting(projectInRepository);
  await selectedProjectStore.addSelectedProject(selectedProjectSetting);
  await vscode.window.showInformationMessage(
    `Success: you assigned project ${project.namespaceWithPath} to remote URL ${pointer.urlEntry.url} in repository ${repository.rootFsPath}`,
  );
};

const selectProject = async (repository: GitRepository) => {
  const projects = gitlabProjectRepository.getProjectsForRepository(repository.rootFsPath);
  const options = [
    ...projects.map(p => ({
      ...p,
      label: p.project.namespaceWithPath,
      description: 'detected',
      detail: `${p.account.instanceUrl} (${p.account.username})`,
      isOther: false as const,
    })),
    {
      label: 'Manually Assign GitLab Project to Repository',
      detail: 'Use this if your Git remote URL does not have the standard format.',
      isOther: true as const,
    },
  ];
  const selectedProject = await vscode.window.showQuickPick(options, {
    title: 'Select GitLab Project',
  });
  if (!selectedProject) return;
  if (selectedProject.isOther) {
    await manuallyAssignProject(repository);
    return;
  }
  await selectedProjectStore.addSelectedProject(convertProjectToSetting(selectedProject));
};

export const assignProject = async (item: NoProjectItem) => manuallyAssignProject(item.repository);

export const selectProjectCommand = async (item: MultipleProjectsItem | NoProjectItem) =>
  selectProject(item.repository);

export const selectProjectForRepository = async () => {
  const repository = await selectRepository();
  if (!repository) return;
  await selectProject(repository);
};

export const clearSelectedProjects = async (item: ProjectItemModel) => {
  await selectedProjectStore.clearSelectedProjects(
    item.projectInRepository.pointer.repository.rootFsPath,
  );
};
