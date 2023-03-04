/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import * as vscode from 'vscode';

export abstract class ReadOnlyFileSystem implements vscode.FileSystemProvider {
  abstract stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat>;

  abstract readDirectory(
    uri: vscode.Uri,
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]>;

  abstract readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array>;

  onDidChangeFile(
    l: (e: vscode.FileChangeEvent[]) => any,
    thisArgs?: unknown,
    disposables?: vscode.Disposable[],
  ): vscode.Disposable {
    return new vscode.Disposable(() => {
      /* do nothing */
    });
  }

  watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    return new vscode.Disposable(() => {
      /* do nothing */
    });
  }

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean },
  ): void | Thenable<void> {
    throw vscode.FileSystemError.NoPermissions(oldUri);
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean },
  ): void | Thenable<void> {
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  delete(uri: vscode.Uri, options: { recursive: boolean }): void | Thenable<void> {
    throw vscode.FileSystemError.NoPermissions(uri);
  }
}
