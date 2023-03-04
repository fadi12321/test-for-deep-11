import * as vscode from 'vscode';
import { Account } from '../accounts/account';
import { accountService } from '../accounts/account_service';

export async function pickAccount(): Promise<Account | undefined> {
  const accounts = accountService.getAllAccounts();
  const accountItems = accounts.map(account => ({
    label: `$(cloud) ${account.instanceUrl} (${account.username})`,
    account,
  }));
  if (accountItems.length === 0) {
    throw new Error('no GitLab instance found');
  }
  let selectedAccountItem;
  if (accountItems.length === 1) {
    [selectedAccountItem] = accountItems;
  } else {
    selectedAccountItem = await vscode.window.showQuickPick(accountItems, {
      ignoreFocusOut: true,
      title: 'Select GitLab account',
    });
  }
  if (!selectedAccountItem) {
    return undefined;
  }
  return selectedAccountItem.account;
}
