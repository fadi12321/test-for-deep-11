import dayjs from 'dayjs';
import * as vscode from 'vscode';
import { USER_COMMANDS } from './command_names';
import { DetailedError, isDetailedError, prettyJson } from './errors/common';
import { HelpError } from './errors/help_error';
import { getExtensionConfiguration } from './utils/extension_configuration';
import { Help, HelpMessageSeverity } from './utils/help';

type logFunction = (line: string) => void;
let globalLog: logFunction = console.error;

export const initializeLogging = (logLine: logFunction): void => {
  globalLog = logLine;
};

interface Log {
  debug(e: Error): void;
  debug(message: string, e?: Error): void;
  info(e: Error): void;
  info(message: string, e?: Error): void;
  warn(e: Error): void;
  warn(message: string, e?: Error): void;
  error(e: Error): void;
  error(message: string, e?: Error): void;
}

const LOG_LEVEL = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

// pad subsequent lines by 4 spaces
const PADDING = 4;

type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

const multilineLog = (line: string, level: LogLevel): void => {
  const prefix = `${dayjs().format('YYYY-MM-DDTHH:mm:ss:SSS')} [${level}]: `;
  const padNextLines = (text: string) => text.replace(/\n/g, `\n${' '.repeat(PADDING)}`);

  globalLog(`${prefix}${padNextLines(line)}`);
};

const formatError = (e: Error): string =>
  isDetailedError(e) ? prettyJson(e.details) : `${e.message}\n${e.stack}`;

const logWithLevel = (level: LogLevel, a1: Error | string, a2?: Error) => {
  if (typeof a1 === 'string') {
    const errorText = a2 ? `\n${formatError(a2)}` : '';
    multilineLog(`${a1}${errorText}`, level);
  } else {
    multilineLog(formatError(a1), level);
  }
};

/** This method logs only if user added `"debug": true` to their `settings.json` */
const debug = (a1: Error | string, a2?: Error) => {
  if (getExtensionConfiguration().debug) logWithLevel(LOG_LEVEL.DEBUG, a1, a2);
};
const info = (a1: Error | string, a2?: Error) => logWithLevel(LOG_LEVEL.INFO, a1, a2);
const warn = (a1: Error | string, a2?: Error) => logWithLevel(LOG_LEVEL.WARNING, a1, a2);
const error = (a1: Error | string, a2?: Error) => logWithLevel(LOG_LEVEL.ERROR, a1, a2);

export const log: Log = { debug, info, warn, error };

export const handleError = (e: Error | DetailedError): { onlyForTesting: Promise<void> } => {
  log.error(e);

  // This is probably the only place where we want to ignore a floating promise.
  // We don't want to block the app and wait for user click on the "Show Logs"
  // button or close the message However, for testing this method, we need to
  // keep the promise.
  if (HelpError.isHelpError(e)) {
    return { onlyForTesting: Help.showError(e, HelpMessageSeverity.Error) };
  }
  const showErrorMessage = async () => {
    const choice = await vscode.window.showErrorMessage(e.message, 'Show Logs');
    if (choice === 'Show Logs') {
      await vscode.commands.executeCommand(USER_COMMANDS.SHOW_OUTPUT);
    }
  };
  return { onlyForTesting: showErrorMessage() };
};
