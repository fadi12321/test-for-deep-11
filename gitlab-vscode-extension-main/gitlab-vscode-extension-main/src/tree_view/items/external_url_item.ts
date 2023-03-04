import { TreeItem } from 'vscode';
import { openInBrowserCommand } from '../../utils/open_in_browser_command';

export class ExternalUrlItem extends TreeItem {
  constructor(label: string, url: string) {
    super(label);
    this.command = openInBrowserCommand(url);
  }
}
