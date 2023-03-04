/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/* Taken from https://github.com/microsoft/vscode/blob/3be2b5d9524ef9d6fda0c2751ec2d02a181ea6f4/extensions/github-authentication/src/githubServer.ts#L28-L37 */
import vscode from 'vscode';

export class GitLabUriHandler extends vscode.EventEmitter<vscode.Uri> implements vscode.UriHandler {
  async handleUri(uri: vscode.Uri): Promise<void> {
    this.fire(uri);
  }
}

export const gitlabUriHandler = new GitLabUriHandler();
