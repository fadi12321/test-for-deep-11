import * as path from 'path';
import * as vscode from 'vscode';
import { VS_COMMANDS } from '../command_names';
import {
  ProjectCommand,
  ProjectFileCommand,
  ProjectInRepositoryAndFile,
} from './run_with_valid_project';
import { ifVersionGte } from '../utils/if_version_gte';
import { GitLabProject } from '../gitlab/gitlab_project';
import { ProjectInRepository } from '../gitlab/new_project';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { getTrackingBranchName } from '../git/get_tracking_branch_name';
import { getLastCommitSha } from '../git/get_last_commit_sha';
import { DetachedHeadError } from '../errors/detached_head_error';
import { Repository } from '../api/git';
import { JobItemModel } from '../tree_view/items/job_item_model';
import { PipelineItemModel } from '../tree_view/items/pipeline_item_model';

export const openUrl = async (url: string): Promise<void> => {
  // workaround for a VS Code open command bug: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/44
  const urlArgument = ifVersionGte<string | vscode.Uri>(
    vscode.version,
    '1.65.0',
    () => url,
    () => vscode.Uri.parse(url),
  );
  await vscode.commands.executeCommand(VS_COMMANDS.OPEN, urlArgument);
};

/**
 * Fetches user and project before opening a link.
 * Link can contain some placeholders which will be replaced by this method
 * with relevant information. Implemented placeholders below.
 *
 * $projectUrl
 * $userId
 *
 * An example link is `$projectUrl/issues?assignee_id=$userId` which will be
 * `gitlab.com/gitlab-org/gitlab-ce/issues?assignee_id=502136`.
 *
 * @param {string} linkTemplate
 * @param {RestUser} user current user
 * @param {GitLabProject} project
 */
async function getLink(linkTemplate: string, user: RestUser, project: GitLabProject) {
  return linkTemplate.replace('$userId', user.id.toString()).replace('$projectUrl', project.webUrl);
}

async function openTemplatedLink(linkTemplate: string, projectInRepository: ProjectInRepository) {
  const user = await getGitLabService(projectInRepository).getCurrentUser();
  await openUrl(await getLink(linkTemplate, user, projectInRepository.project));
}

async function getTrackingBranchNameOrThrow(rawRepository: Repository): Promise<string> {
  const branchName = await getTrackingBranchName(rawRepository);
  if (!branchName) throw new DetachedHeadError();
  return branchName;
}

export const showIssues: ProjectCommand = async projectInRepository => {
  await openTemplatedLink('$projectUrl/issues?assignee_id=$userId', projectInRepository);
};

export const showMergeRequests: ProjectCommand = async projectInRepository => {
  await openTemplatedLink('$projectUrl/merge_requests?assignee_id=$userId', projectInRepository);
};

async function getActiveFile({ projectInRepository, activeEditor }: ProjectInRepositoryAndFile) {
  const { repository } = projectInRepository.pointer;
  const branchName = await getTrackingBranchNameOrThrow(repository.rawRepository);
  const filePath = path
    .relative(repository.rootFsPath, activeEditor.document.uri.fsPath)
    .replace(/\\/g, '/');
  const { project } = projectInRepository;
  const fileUrl = `${project.webUrl}/blob/${encodeURIComponent(branchName)}/${filePath}`;
  let anchor = '';

  if (activeEditor.selection) {
    const { start, end } = activeEditor.selection;
    anchor = `#L${start.line + 1}`;

    if (end.line > start.line) {
      anchor += `-${end.line + 1}`;
    }
  }

  return `${fileUrl}${anchor}`;
}

export const openActiveFile: ProjectFileCommand = async projectInRepositoryAndFile => {
  await openUrl(await getActiveFile(projectInRepositoryAndFile));
};

export const copyLinkToActiveFile: ProjectFileCommand = async projectInRepositoryAndFile => {
  const fileUrl = await getActiveFile(projectInRepositoryAndFile);
  await vscode.env.clipboard.writeText(fileUrl);
};

export const openCurrentMergeRequest: ProjectCommand = async projectInRepository => {
  const { repository } = projectInRepository.pointer;
  const mr = await getGitLabService(projectInRepository).getOpenMergeRequestForCurrentBranch(
    projectInRepository.project,
    await getTrackingBranchNameOrThrow(repository.rawRepository),
  );

  if (mr) {
    await openUrl(mr.web_url);
  }
};

export const openCreateNewIssue: ProjectCommand = async projectInRepository => {
  await openTemplatedLink('$projectUrl/issues/new', projectInRepository);
};

export const openCreateNewMr: ProjectCommand = async projectInRepository => {
  const { project, pointer } = projectInRepository;
  const branchName = await getTrackingBranchNameOrThrow(pointer.repository.rawRepository);

  await openUrl(
    `${project.webUrl}/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(
      branchName,
    )}`,
  );
};

export const openProjectPage: ProjectCommand = async projectInRepository => {
  await openTemplatedLink('$projectUrl', projectInRepository);
};

export async function openCurrentPipeline(projectInRepository: ProjectInRepository): Promise<void> {
  const { pipeline } = await getGitLabService(projectInRepository).getPipelineAndMrForCurrentBranch(
    projectInRepository.project,
    await getTrackingBranchNameOrThrow(projectInRepository.pointer.repository.rawRepository),
  );

  if (pipeline) {
    await openUrl(pipeline.web_url);
  }
}

export const compareCurrentBranch: ProjectCommand = async projectInRepository => {
  const { project } = projectInRepository;
  const { repository } = projectInRepository.pointer;

  if (getLastCommitSha(repository.rawRepository) && project.rootRef) {
    await openUrl(
      `${project.webUrl}/compare/${project.rootRef}...${getLastCommitSha(
        repository.rawRepository,
      )}`,
    );
  }
};

export async function openPipelineUri(item: JobItemModel | PipelineItemModel) {
  let uri: string;

  if (item instanceof JobItemModel) {
    uri = item.job.target_url ?? item.job.web_url ?? '';
  } else {
    uri = item.pipeline.web_url;
  }

  await openUrl(uri);
}
