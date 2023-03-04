import * as vscode from 'vscode';
import { MERGED_YAML_URI_SCHEME } from '../constants';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { fromMergedYamlUri } from './merged_yaml_uri';

export class MergedYamlContentProvider implements vscode.TextDocumentContentProvider {
  #onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  onDidChange = this.#onDidChangeEmitter.event;

  #watchersOnCiConfig: Record<string, vscode.Disposable> = {};

  #reloadRequested = new Set<string>();

  constructor() {
    vscode.workspace.onDidOpenTextDocument(textDocument => {
      if (textDocument.uri.scheme === MERGED_YAML_URI_SCHEME) {
        this.startWatchingForConfigFileChanges(textDocument);
      }
    });
    vscode.workspace.onDidCloseTextDocument(textDocument => {
      if (textDocument.uri.scheme === MERGED_YAML_URI_SCHEME) {
        this.stopWatchingForConfigFileChanges(textDocument);
      }
    });
  }

  startWatchingForConfigFileChanges(textDocument: vscode.TextDocument) {
    const key = textDocument.uri.toString();
    const params = fromMergedYamlUri(textDocument.uri);
    const file = vscode.Uri.file(params.path);

    const fileWatcher = vscode.workspace.createFileSystemWatcher(file.fsPath);
    fileWatcher.onDidChange(() => {
      this.#reloadRequested.add(key);
      this.#onDidChangeEmitter.fire(textDocument.uri);
    });

    this.#watchersOnCiConfig[key] = fileWatcher;
  }

  stopWatchingForConfigFileChanges(textDocument: vscode.TextDocument) {
    const key = textDocument.uri.toString();
    this.#reloadRequested.delete(key);
    this.#watchersOnCiConfig[key]?.dispose();
    delete this.#watchersOnCiConfig[key];
  }

  async provideTextDocumentContent(
    uri: vscode.Uri,
    token: vscode.CancellationToken,
  ): Promise<string> {
    const params = fromMergedYamlUri(uri);
    const key = uri.toString();

    if (!this.#reloadRequested.has(key)) {
      return params.initial;
    }

    const contentArray = await vscode.workspace.fs.readFile(vscode.Uri.file(params.path));
    const content = new TextDecoder().decode(contentArray);

    if (token.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    const projectInRepository = gitlabProjectRepository.getProjectOrFail(params.repositoryRoot);

    const { merged_yaml: merged } = await getGitLabService(projectInRepository).validateCIConfig(
      projectInRepository.project,
      content,
    );

    if (!merged) {
      throw new Error('GitLab Workflow: Invalid CI configuration.');
    }

    return merged;
  }
}
