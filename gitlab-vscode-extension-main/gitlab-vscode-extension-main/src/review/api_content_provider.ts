import * as vscode from 'vscode';
import assert from 'assert';
import { fromReviewUri, isEmptyFileUri } from './review_uri';
import { log } from '../log';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { getGitLabService } from '../gitlab/get_gitlab_service';

export class ApiContentProvider implements vscode.TextDocumentContentProvider {
  // eslint-disable-next-line class-methods-use-this
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = fromReviewUri(uri);
    if (isEmptyFileUri(uri)) return '';
    assert(params.path);
    assert(params.commit);

    const projectInRepository = gitlabProjectRepository.getProjectOrFail(params.repositoryRoot);
    const service = getGitLabService(projectInRepository);
    try {
      return await service.getFileContent(params.path, params.commit, params.projectId);
    } catch (e) {
      log.error(e);
      throw e;
    }
  }
}
