import { TreeItem, ThemeIcon } from 'vscode';
import { USER_COMMANDS } from '../../command_names';

export class ErrorItem extends TreeItem {
  constructor(message = 'Error occurred, please try to refresh.') {
    super(message);
    this.iconPath = new ThemeIcon('error');
    this.command = {
      command: USER_COMMANDS.SHOW_OUTPUT,
      title: 'Show error output',
    };
  }
}
