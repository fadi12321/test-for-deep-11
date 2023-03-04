import * as vscode from 'vscode';
import { VS_COMMANDS } from '../command_names';

export const openInBrowserCommand = (webUrl: string): vscode.Command => ({
  title: 'Open in browser',
  command: VS_COMMANDS.OPEN,
  arguments: [vscode.Uri.parse(webUrl)],
});
