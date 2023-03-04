const assert = require('assert');
const vscode = require('vscode');
const {
  createAndOpenFile,
  closeAndDeleteFile,
  getRepositoryRoot,
} = require('./test_infrastructure/helpers');
const ciVariables = require('../../src/completion/ci_variables.json');

describe('CI variable completion', () => {
  describe('.gitlab-ci.yml', () => {
    const gitlabCiYml = vscode.Uri.file(`${getRepositoryRoot()}/.gitlab-ci.yml`);

    const write = async string => {
      const editor = vscode.window.activeTextEditor;
      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.start, string);
      });
    };

    const openCompletion = async position =>
      vscode.commands.executeCommand('vscode.executeCompletionItemProvider', gitlabCiYml, position);

    beforeEach(async () => {
      await createAndOpenFile(gitlabCiYml);
    });

    afterEach(async () => {
      await closeAndDeleteFile(gitlabCiYml);
    });

    it("won't complete when no dollar is found", async () => {
      const text = 'image: alpine:';
      await write(text);

      const position = new vscode.Position(0, text.length - 1);
      const completions = await openCompletion(position);

      assert.deepStrictEqual(
        completions.items.filter(item => item.kind === vscode.CompletionItemKind.Constant),
        [],
      );
    });

    it('will complete for one variable', async () => {
      const text = ' $CI_COMMIT_HASH';
      await write(text);

      const position = new vscode.Position(0, text.length - 1);
      const completions = await openCompletion(position);

      assert.strictEqual(completions.items.length, ciVariables.length);

      const { start, end } = completions.items[0].range;
      assert.deepStrictEqual(start.character, 1);
      assert.deepStrictEqual(end, position);
    });

    it('includes braces for parameter expansion', async () => {
      const text = ` $\{CI_`;
      await write(text);

      const position = new vscode.Position(0, text.length - 1);
      const completions = await openCompletion(position);

      assert(completions.items[0].label.startsWith('${'));
      assert.strictEqual(completions.items[0].range.start.character, 1);
    });

    it('overwrites the closing brace', async () => {
      const text = ` $\{}`;
      await write(text);

      const position = new vscode.Position(0, 3);
      const completions = await openCompletion(position);

      assert.strictEqual(completions.items[0].range.end.character, position.character + 1);
    });

    it('does not include braces for regular variables', async () => {
      const text = '$CI_COMMIT_HASH';
      await write(text);

      const position = new vscode.Position(0, text.length - 1);
      const completions = await openCompletion(position);

      assert(!completions.items[0].label.startsWith('${'));
      assert.strictEqual(completions.items[0].range.start.character, 0);
    });

    it('will handle multiple $ characters on the same line', async () => {
      const text = `  if: '$CI_COMMIT_BRANCH == "master" && $CI_PIPELINE_SOURCE == "schedule" && $FREQUEN`;
      await write(text);

      const position = new vscode.Position(0, text.length - 1);
      const completions = await openCompletion(position);

      const { start } = completions.items[0].range;
      assert.deepStrictEqual(
        start.character,
        text.length - 8,
        'completion item should start at the position of the last $',
      );
    });
  });
});
