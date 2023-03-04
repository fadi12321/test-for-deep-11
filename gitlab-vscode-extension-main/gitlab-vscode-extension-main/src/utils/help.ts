import * as vscode from 'vscode';
import { VS_COMMANDS } from '../command_names';
import { HelpError } from '../errors/help_error';
import { contextUtils } from './context_utils';

export type HelpOptions = { section: string };

// eslint-disable-next-line no-shadow
export enum HelpMessageSeverity {
  Info,
  Warning,
  Error,
}

export class Help {
  static async show(section?: string): Promise<void> {
    const help = contextUtils.getEmbededFileUri('README.md').with({ fragment: section });
    await vscode.commands.executeCommand(VS_COMMANDS.MARKDOWN_SHOW_PREVIEW, help);
  }

  static async showError(error: HelpError, severity = HelpMessageSeverity.Info): Promise<void> {
    let shouldShow = false;
    switch (severity) {
      case HelpMessageSeverity.Warning:
        shouldShow = !!(await vscode.window.showWarningMessage(error.message, 'Show Help'));
        break;

      case HelpMessageSeverity.Error:
        shouldShow = !!(await vscode.window.showErrorMessage(error.message, 'Show Help'));
        break;

      default:
        shouldShow = !!(await vscode.window.showInformationMessage(error.message, 'Show Help'));
        break;
    }

    if (shouldShow) {
      await Help.show(error.options?.section);
    }
  }
}
