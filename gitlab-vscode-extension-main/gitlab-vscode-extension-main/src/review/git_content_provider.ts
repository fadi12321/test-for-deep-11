import * as vscode from 'vscode';
import assert from 'assert';
import { fromReviewUri, isEmptyFileUri } from './review_uri';
import { ApiContentProvider } from './api_content_provider';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { getFileContent } from '../git/get_file_content';

const provideApiContentAsFallback = (uri: vscode.Uri) =>
  new ApiContentProvider().provideTextDocumentContent(uri);

export class GitContentProvider implements vscode.TextDocumentContentProvider {
  // eslint-disable-next-line class-methods-use-this
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = fromReviewUri(uri);
    if (isEmptyFileUri(uri)) return '';
    assert(params.path);
    assert(params.commit);
    const projectInRepository = gitlabProjectRepository.getProjectOrFail(params.repositoryRoot);
    const result = await getFileContent(
      projectInRepository.pointer.repository.rawRepository,
      params.path,
      params.commit,
    );
    return result || provideApiContentAsFallback(uri);
  }
}
