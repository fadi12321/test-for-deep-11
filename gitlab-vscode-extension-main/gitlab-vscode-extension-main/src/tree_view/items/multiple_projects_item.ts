import vscode from 'vscode';
import path from 'path';
import { GitRepository } from '../../git/new_git';

export class MultipleProjectsItem extends vscode.TreeItem {
  repository: GitRepository;

  constructor(repository: GitRepository) {
    const folderName = path.basename(repository.rootFsPath);
    super(`${folderName} (multiple projects)`);
    this.repository = repository;
    this.iconPath = new vscode.ThemeIcon('warning');
    this.contextValue = 'multiple-projects-detected';
  }
}
