import * as vscode from 'vscode';
import { changeTypeDecorationProvider, decorations } from './change_type_decoration_provider';
import { ADDED, DELETED, RENAMED, MODIFIED, CHANGE_TYPE_QUERY_KEY } from '../constants';

describe('FileDecoratorProvider', () => {
  it.each`
    changeType  | decoration
    ${ADDED}    | ${decorations[ADDED]}
    ${DELETED}  | ${decorations[DELETED]}
    ${RENAMED}  | ${decorations[RENAMED]}
    ${MODIFIED} | ${decorations[MODIFIED]}
  `('Correctly maps changeType to decorator', ({ changeType, decoration }) => {
    const uri: vscode.Uri = vscode.Uri.file(`./test?${CHANGE_TYPE_QUERY_KEY}=${changeType}`);
    const { token } = new vscode.CancellationTokenSource();
    const returnValue = changeTypeDecorationProvider.provideFileDecoration(uri, token);

    expect(returnValue).toEqual(decoration);
  });
});
