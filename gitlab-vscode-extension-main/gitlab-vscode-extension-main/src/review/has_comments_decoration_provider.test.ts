import * as vscode from 'vscode';
import { HAS_COMMENTS_QUERY_KEY } from '../constants';
import { hasCommentsDecorationProvider } from './has_comments_decoration_provider';

describe('FileDecoratorProvider', () => {
  it.each`
    urlQuery                              | decoration
    ${`?${HAS_COMMENTS_QUERY_KEY}=true`}  | ${'💬'}
    ${`?${HAS_COMMENTS_QUERY_KEY}=false`} | ${undefined}
    ${''}                                 | ${undefined}
  `('Correctly maps hasComments query to decorator', async ({ urlQuery, decoration }) => {
    const uri: vscode.Uri = vscode.Uri.file(`./test${urlQuery}`);
    const { token } = new vscode.CancellationTokenSource();
    const returnValue = await hasCommentsDecorationProvider.provideFileDecoration(uri, token);

    expect(returnValue?.badge).toEqual(decoration);
  });
});
