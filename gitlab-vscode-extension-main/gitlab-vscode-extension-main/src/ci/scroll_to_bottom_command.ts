import * as vscode from 'vscode';

export async function scrollToBottom(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const { lineCount } = editor.document;

  editor.revealRange(
    new vscode.Range(lineCount, 0, lineCount, 0),
    vscode.TextEditorRevealType.Default,
  );
}
