import { TreeItem } from 'vscode';
import { PROGRAMMATIC_COMMANDS } from '../../command_names';

export class IssueItem extends TreeItem {
  constructor(issue: RestIssuable, repositoryPath: string) {
    super(`#${issue.iid} · ${issue.title}`);
    this.command = {
      command: PROGRAMMATIC_COMMANDS.SHOW_RICH_CONTENT,
      arguments: [issue, repositoryPath],
      title: 'Show Issue',
    };
  }
}
