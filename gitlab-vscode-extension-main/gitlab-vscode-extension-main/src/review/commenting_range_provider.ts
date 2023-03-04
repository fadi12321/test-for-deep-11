import * as vscode from 'vscode';
import { REVIEW_URI_SCHEME } from '../constants';
import { getAddedLinesForFile } from '../git/diff_line_count';
import { fromReviewUri } from './review_uri';

const lastLineEmpty = (document: vscode.TextDocument): boolean => {
  const lastLIne = document.lineAt(document.lineCount - 1);
  return lastLIne.isEmptyOrWhitespace;
};
export class CommentingRangeProvider implements vscode.CommentingRangeProvider {
  private mr: RestMr;

  private mrVersion: RestMrVersion;

  constructor(mr: RestMr, mrVersion: RestMrVersion) {
    this.mr = mr;
    this.mrVersion = mrVersion;
  }

  provideCommentingRanges(document: vscode.TextDocument): vscode.Range[] {
    const { uri } = document;
    if (uri.scheme !== REVIEW_URI_SCHEME) return [];
    const params = fromReviewUri(uri);
    if (params.mrId !== this.mr.id || params.projectId !== this.mr.project_id || !params.path) {
      return [];
    }
    const oldFile = params.commit === this.mrVersion.base_commit_sha;
    if (oldFile) {
      const endOfRange = lastLineEmpty(document) ? document.lineCount - 2 : document.lineCount - 1;
      return [new vscode.Range(new vscode.Position(0, 0), new vscode.Position(endOfRange, 0))];
    }
    const result = getAddedLinesForFile(this.mrVersion, params.path);
    return result.map(
      l => new vscode.Range(new vscode.Position(l - 1, 0), new vscode.Position(l - 1, 0)),
    );
  }
}
