import * as vscode from 'vscode';
import { handleError } from '../log';
import { showQuickPick } from './show_quickpick';

/**
 * QuickPickInitOptions is a subset of QuickPick and is used by `pickWithQuery`
 * to set properties on a new QuickPick. If there is a property you need that
 * has not been added, add it.
 */
export type QuickPickInitOptions = Pick<
  Partial<vscode.QuickPick<never>>,
  'ignoreFocusOut' | 'title'
>;

/**
 * Shows a quickpick, using the query function to update the list of items when
 * the user types.
 * @param quickpick the quickpick to show
 * @param queryfn a function that is used to update the items when the user
 * types
 * @returns the selected item and the query string
 */
export async function pickWithQuery<T extends vscode.QuickPickItem>(
  init: QuickPickInitOptions,
  queryfn: (query?: string) => Thenable<T[]>,
): Promise<{ picked: T | undefined; query: string }> {
  const pick = vscode.window.createQuickPick<T>();
  Object.assign(pick, init);

  async function getItems(query?: string) {
    try {
      pick.busy = true;
      pick.items = await queryfn(query);
    } catch (e) {
      handleError(e as Error);
      pick.hide();
    } finally {
      pick.busy = false;
    }
  }

  pick.onDidChangeValue(getItems);

  // We only need the result from the quick pick, but the promise needs to be
  // awaited to avoid leaking errors
  const [, picked] = await Promise.all([getItems(), showQuickPick(pick)]);
  return { picked, query: pick.value };
}
