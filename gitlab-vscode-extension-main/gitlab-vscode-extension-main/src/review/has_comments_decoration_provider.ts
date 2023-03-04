import * as vscode from 'vscode';
import { HAS_COMMENTS_QUERY_KEY } from '../constants';

export const hasCommentsDecorationProvider: vscode.FileDecorationProvider = {
  provideFileDecoration: uri => {
    if (uri.scheme !== 'file') {
      return undefined;
    }
    const params = new URLSearchParams(uri.query);
    const hasComments = params.get(HAS_COMMENTS_QUERY_KEY) === 'true';
    if (hasComments) {
      return { badge: '💬' };
    }
    return undefined;
  },
};
