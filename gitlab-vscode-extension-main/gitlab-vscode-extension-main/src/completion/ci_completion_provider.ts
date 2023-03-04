import * as vscode from 'vscode';
import gitlabCiVariables = require('./ci_variables.json');

/**
 * The characters currently in the document, which must be used or replaced.
 */
// eslint-disable-next-line no-shadow
enum CompletionCharacters {
  /**
   * A dollar sign without braces.
   */
  Plain,
  /**
   * A dollar sign followed by an opening brace. This may include a closing brace behind the
   * cursor, which will be treated as a regular character in the completion item.
   */
  BraceOpen,
  /**
   * A dollar sign followed by an opening and closing brace. The closing brace is in front of the
   * cursor, and mus be included by extending the range.
   *
   * This occurs when VS Code is configured to auto-close braces, and the user types `${`.
   */
  BraceOpenClosed,
}

const findDollarSignIndex = (currentLine: string, position: number): number => {
  const textUntilPosition = currentLine.substr(0, position);
  return textUntilPosition.lastIndexOf('$');
};

const findCompletionCharacters = (
  currentLine: string,
  dollarSignIndex: number,
  position: number,
): CompletionCharacters => {
  if (currentLine[dollarSignIndex + 1] !== '{') {
    return CompletionCharacters.Plain;
  }
  // Don't add braces if the cursor is placed before the opening brace
  if (dollarSignIndex === position - 1) {
    return CompletionCharacters.Plain;
  }

  return currentLine[position] === '}'
    ? CompletionCharacters.BraceOpenClosed
    : CompletionCharacters.BraceOpen;
};

export class CiCompletionProvider implements vscode.CompletionItemProvider {
  // eslint-disable-next-line class-methods-use-this
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    const currentLine = document.lineAt(position).text;
    const dollarSignIndex = findDollarSignIndex(currentLine, position.character);
    const completionMode = findCompletionCharacters(
      currentLine,
      dollarSignIndex,
      position.character,
    );

    return gitlabCiVariables.map(({ name, description }) => {
      const item = new vscode.CompletionItem(
        completionMode === CompletionCharacters.Plain ? `$${name}` : `$\{${name}}`,
        vscode.CompletionItemKind.Constant,
      );
      item.documentation = new vscode.MarkdownString(description);
      item.range = new vscode.Range(
        // Start at the index of the dollar sign
        position.with(undefined, dollarSignIndex),

        // Extend the range of characters to be replaced if a `}` is in front of the cursor,
        // to prevent having two closing braces after the item is inserted.
        completionMode === CompletionCharacters.BraceOpenClosed
          ? position.with(undefined, position.character + 1)
          : position,
      );
      return item;
    });
  }
}
