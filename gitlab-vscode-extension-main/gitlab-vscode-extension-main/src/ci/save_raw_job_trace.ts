import * as vscode from 'vscode';
import { assert } from 'console';
import { JOB_LOG_URI_SCHEME } from '../constants';
import { fromJobLogUri } from './job_log_uri';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { jobLogCache } from './job_log_cache';

export async function saveRawJobTrace(jobUri: vscode.Uri): Promise<void> {
  assert(jobUri.scheme === JOB_LOG_URI_SCHEME);
  const { repositoryRoot, job } = fromJobLogUri(jobUri);
  const projectInRepository = gitlabProjectRepository.getProjectOrFail(repositoryRoot);
  const gitlabService = getGitLabService(projectInRepository);

  const saveUri = await vscode.window.showSaveDialog({
    title: 'Save raw job trace',
    defaultUri: vscode.Uri.file(`${job}.log`),
  });
  if (!saveUri) return;

  const text =
    jobLogCache.get(job)?.rawTrace ??
    (await gitlabService.getJobTrace(projectInRepository.project, job))?.rawTrace;
  assert(text);

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(saveUri, encoder.encode(text));
}
