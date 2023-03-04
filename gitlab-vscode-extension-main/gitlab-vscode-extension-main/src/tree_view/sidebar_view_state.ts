import * as vscode from 'vscode';

const eventEmitter = new vscode.EventEmitter<void>();

export const onSidebarViewStateChange = eventEmitter.event;

export const enum SidebarViewState {
  ListView = 'list',
  TreeView = 'tree',
}

let state: SidebarViewState = SidebarViewState.ListView;

export const getSidebarViewState = (): SidebarViewState => state;

export const setSidebarViewState = async (newState: SidebarViewState): Promise<void> => {
  state = newState;
  await vscode.commands.executeCommand('setContext', 'gitlab.sidebarView', state);
  eventEmitter.fire();
};
