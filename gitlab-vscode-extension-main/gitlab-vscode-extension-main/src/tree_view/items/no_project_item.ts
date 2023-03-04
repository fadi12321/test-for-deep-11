import vscode from 'vscode';
import path from 'path';
import { GitRepository } from '../../git/new_git';

export class NoProjectItem extends vscode.TreeItem {
  repository: GitRepository;

  constructor(repository: GitRepository) {
    const folderName = path.basename(repository.rootFsPath);
    super(`${folderName} (no GitLab project)`);
    this.repository = repository;
    this.iconPath = new vscode.ThemeIcon('error');
    this.contextValue = 'no-project-detected';
  }
}
