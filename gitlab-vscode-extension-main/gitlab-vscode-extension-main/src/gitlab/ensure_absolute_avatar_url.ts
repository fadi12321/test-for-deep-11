import * as vscode from 'vscode';

export const ensureAbsoluteAvatarUrl = (instanceUrl: string, avatarUrl: string): string => {
  if (!avatarUrl.startsWith('/')) {
    return avatarUrl;
  }
  return vscode.Uri.parse(instanceUrl).with({ path: avatarUrl }).toString();
};
