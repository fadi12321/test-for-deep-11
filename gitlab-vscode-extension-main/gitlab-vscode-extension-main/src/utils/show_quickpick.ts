import { QuickPick, QuickPickItem } from 'vscode';

export async function showQuickPick<T extends QuickPickItem>(
  quickpick: QuickPick<T>,
): Promise<T | undefined> {
  const result = await new Promise<T | undefined>(res => {
    quickpick.onDidHide(() => res(undefined));
    quickpick.onDidAccept(() => {
      res(quickpick.selectedItems[0]);
      quickpick.hide();
    });
    quickpick.show();
  });

  return result;
}
