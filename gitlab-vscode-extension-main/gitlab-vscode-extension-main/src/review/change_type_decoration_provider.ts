import * as vscode from 'vscode';
import { ADDED, DELETED, RENAMED, MODIFIED, CHANGE_TYPE_QUERY_KEY } from '../constants';

export const decorations: Record<string, vscode.FileDecoration | undefined> = {
  [ADDED]: {
    badge: 'A',
    color: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
  },
  [MODIFIED]: {
    badge: 'M',
  },
  [DELETED]: {
    badge: 'D',
    color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
  },
  [RENAMED]: {
    badge: 'R',
    color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
  },
};

export const changeTypeDecorationProvider: vscode.FileDecorationProvider = {
  provideFileDecoration: uri => {
    if (uri.scheme === 'file') {
      const params = new URLSearchParams(uri.query);
      const changeType = params.get(CHANGE_TYPE_QUERY_KEY);
      if (changeType) {
        return decorations[changeType];
      }
    }
    return undefined;
  },
};
