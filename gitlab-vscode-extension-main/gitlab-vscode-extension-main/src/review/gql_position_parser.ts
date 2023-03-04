import * as vscode from 'vscode';
import { GqlTextPosition } from '../gitlab/graphql/shared';

const isOld = (position: GqlTextPosition) => position.oldLine !== null;

export const pathFromPosition = (position: GqlTextPosition): string =>
  isOld(position) ? position.oldPath : position.newPath;

export const commitFromPosition = (position: GqlTextPosition): string =>
  isOld(position) ? position.diffRefs.baseSha : position.diffRefs.headSha;

export const commentRangeFromPosition = (position: GqlTextPosition): vscode.Range => {
  const glLine = position.oldLine ?? position.newLine;
  const vsPosition = new vscode.Position(glLine - 1, 0); // VS Code numbers lines starting with 0, GitLab starts with 1
  return new vscode.Range(vsPosition, vsPosition);
};
