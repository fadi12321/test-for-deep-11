import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { posix as path } from 'path';
import { ChangedFileItem } from './changed_file_item';

export type FolderTreeItem = { path: string; item: ChangedFileItem };

const isFolderItem = (p: FolderTreeItem) => p.path.includes(path.sep);
const isFileItem = (p: FolderTreeItem) => !isFolderItem(p);
const getFolderName = (p: FolderTreeItem) => p.path.split(path.sep)[0];
const uniq = (p: string[]) => [...new Set(p)];
const isInFolder = (parentFolderName: string) => (p: FolderTreeItem) =>
  p.path.startsWith(`${parentFolderName}${path.sep}`);
const relativePath = (parentFolderName: string) => (p: FolderTreeItem) => ({
  ...p,
  path: p.path.substr(parentFolderName.length + 1),
});
const isRoot = (folderName: string) => folderName === '';

export class ChangedFolderItem extends TreeItem {
  #subfolderNames: string[];

  #subfolders: FolderTreeItem[];

  #files: FolderTreeItem[];

  #folderPath: string;

  constructor(folderName: string, allFilesInFolder: FolderTreeItem[], folderPath = '') {
    super(folderName, TreeItemCollapsibleState.Expanded);
    this.#folderPath = folderPath;
    this.iconPath = ThemeIcon.Folder;

    this.#files = allFilesInFolder.filter(isFileItem);
    this.#subfolders = allFilesInFolder.filter(isFolderItem);
    this.#subfolderNames = uniq(this.#subfolders.map(getFolderName));

    // concatenate folder names
    if (!isRoot(folderName) && this.#files.length === 0 && this.#subfolderNames.length === 1) {
      const subfolderName = this.#subfolderNames[0];
      // FIXME: this constructor return was introduced before the rule
      // eslint-disable-next-line no-constructor-return
      return new ChangedFolderItem(
        path.join(folderName, subfolderName),
        this.#subfolders.map(relativePath(subfolderName)),
        path.join(folderPath, subfolderName),
      );
    }

    this.resourceUri = Uri.file(folderPath);
  }

  getChildren(): TreeItem[] {
    return [
      ...this.#subfolderNames.map(
        name =>
          new ChangedFolderItem(
            name,
            this.#subfolders.filter(isInFolder(name)).map(relativePath(name)),
            path.join(this.#folderPath, name),
          ),
      ),
      ...this.#files.map(file => file.item),
    ];
  }
}
