import vscode from 'vscode';

export const authenticate = async () => {
  const session = await vscode.authentication.getSession('gitlab', ['api', 'read_user'], {
    createIfNone: true,
  });
  await vscode.window.showInformationMessage(`Account ${session.account.label} has been added.`);
};
