import * as vscode from 'vscode';
import { VS_COMMANDS } from '../command_names';
import { contextUtils } from './context_utils';
import { Help } from './help';

describe('Help', () => {
  describe('show', () => {
    beforeAll(() => {
      contextUtils.init({
        extensionUri: vscode.Uri.parse(`file:///path/to/extension`),
      } as vscode.ExtensionContext);
    });

    it('opens the file', async () => {
      await Help.show();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        VS_COMMANDS.MARKDOWN_SHOW_PREVIEW,
        vscode.Uri.parse(`file:///path/to/extension/README.md`),
      );
    });

    it('opens the file to the correct section', async () => {
      await Help.show('foobar');
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        VS_COMMANDS.MARKDOWN_SHOW_PREVIEW,
        vscode.Uri.parse(`file:///path/to/extension/README.md#foobar`),
      );
    });
  });
});
