import * as vscode from 'vscode';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';
import { GitRepository } from '../git/new_git';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { ProjectInRepository } from '../gitlab/new_project';

export interface ProjectInRepositoryAndFile {
  projectInRepository: ProjectInRepository;
  activeEditor: vscode.TextEditor;
}

function getRepositoryForActiveEditor(): GitRepository | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor?.document.uri) {
    return undefined;
  }

  return gitExtensionWrapper.getRepositoryForFile(editor.document.uri);
}

/**
 * This method doesn't require any user input and should be used only for automated functionality.
 * (e.g. periodical status bar refresh). If there is any uncertainty about which repository to choose,
 * (i.e. there's multiple repositories and no open editor) we return undefined.
 */
export const getActiveProject: () => ProjectInRepository | undefined = () => {
  const activeEditorRepository = getRepositoryForActiveEditor();

  if (activeEditorRepository) {
    return gitlabProjectRepository.getSelectedOrDefaultForRepository(
      activeEditorRepository.rootFsPath,
    );
  }

  const projects = gitlabProjectRepository.getDefaultAndSelectedProjects();
  if (projects.length === 1) return projects[0];

  return undefined;
};

/**
 * Returns active repository, user-selected repository or undefined if there
 * are no repositories or user didn't select one.
 */
export const getActiveProjectOrSelectOne: () => Promise<
  ProjectInRepository | undefined
> = async () => {
  const activeProject = getActiveProject();

  if (activeProject) {
    return activeProject;
  }

  if (gitlabProjectRepository.getDefaultAndSelectedProjects().length === 0) {
    return undefined;
  }

  const projectOptions = gitlabProjectRepository.getDefaultAndSelectedProjects().map(p => ({
    label: p.project.name,
    project: p,
  }));
  const selection = await vscode.window.showQuickPick(projectOptions, {
    placeHolder: 'Select a project',
  });
  return selection?.project;
};

/** Command that needs a valid GitLab project to run */
export type ProjectCommand = (projectInRepository: ProjectInRepository) => Promise<void>;

/** Command that needs to be executed on an open file from a valid GitLab project */
export type ProjectFileCommand = (
  projectInRepositoryAndFile: ProjectInRepositoryAndFile,
) => Promise<void>;

export const runWithValidProject =
  (command: ProjectCommand): (() => Promise<void>) =>
  async () => {
    const projectInRepository = await getActiveProjectOrSelectOne();
    if (!projectInRepository) {
      return undefined;
    }
    return command(projectInRepository);
  };

export const runWithValidProjectFile =
  (command: ProjectFileCommand): (() => Promise<void>) =>
  async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      await vscode.window.showInformationMessage('GitLab Workflow: No open file.');
      return undefined;
    }

    const projectInRepository = getActiveProject();

    if (!projectInRepository) {
      await vscode.window.showInformationMessage(
        'GitLab Workflow: Open file isn’t part of a repository with a GitLab project.',
      );
      return undefined;
    }
    return command({ activeEditor, projectInRepository });
  };
