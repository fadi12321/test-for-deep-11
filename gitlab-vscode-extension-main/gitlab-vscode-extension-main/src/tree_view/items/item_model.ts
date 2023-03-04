import * as vscode from 'vscode';

export abstract class ItemModel implements vscode.Disposable {
  private disposableChildren: vscode.Disposable[] = [];

  abstract getTreeItem(): vscode.TreeItem;

  abstract getChildren(): Promise<vscode.TreeItem[] | ItemModel[]>;

  protected setDisposableChildren(children: vscode.Disposable[]): void {
    this.disposableChildren = children;
  }

  dispose(): void {
    this.disposableChildren.forEach(ch => ch.dispose());
  }
}
