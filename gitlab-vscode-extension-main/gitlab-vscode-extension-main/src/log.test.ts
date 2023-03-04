import * as vscode from 'vscode';
import { DetailedError } from './errors/common';
import { handleError, initializeLogging, log } from './log';
import { USER_COMMANDS } from './command_names';
import { asMock } from './test_utils/as_mock';
import { getExtensionConfiguration } from './utils/extension_configuration';

jest.mock('./utils/extension_configuration');

describe('logging', () => {
  afterEach(() => {
    expect.hasAssertions();
  });

  let logFunction: jest.Mock;

  beforeEach(() => {
    logFunction = jest.fn();
    initializeLogging(logFunction);
  });

  const getLoggedMessage = () => logFunction.mock.calls[0][0];

  describe('log', () => {
    beforeEach(() => {
      asMock(getExtensionConfiguration).mockReturnValue({ debug: true });
    });

    it('passes the argument to the handler', () => {
      const message = 'A very bad error occurred';
      log.info(message);
      expect(logFunction).toBeCalledTimes(1);
      expect(getLoggedMessage()).toContain(`[info]: ${message}`);
    });

    it.each`
      methodName | logLevel
      ${'debug'} | ${'debug'}
      ${'info'}  | ${'info'}
      ${'warn'}  | ${'warning'}
      ${'error'} | ${'error'}
    `('it handles log level "$logLevel"', ({ methodName, logLevel }) => {
      (log as any)[methodName]('message');
      expect(getLoggedMessage()).toContain(`[${logLevel}]: message`);
    });

    it('does not log debug messages if debug mode is disabled', () => {
      asMock(getExtensionConfiguration).mockReturnValue({ debug: false });

      log.debug('message');

      expect(logFunction).not.toBeCalled();
    });

    it('indents multiline messages', () => {
      log.error('error happened\nand the next line\nexplains why');
      expect(getLoggedMessage()).toContain(
        `[error]: error happened\n    and the next line\n    explains why`,
      );
    });
  });

  describe('log Error', () => {
    describe('for normal errors', () => {
      it('passes the argument to the handler', () => {
        const message = 'A very bad error occurred';
        const error = {
          message,
          stack: 'stack',
        };
        log.error(error as Error);
        expect(getLoggedMessage()).toMatch(/\[error\]: A very bad error occurred\s+stack/m);
      });
    });

    describe('for detailed errors', () => {
      it('passes the details to the handler', () => {
        const message = 'Could not fetch from GitLab: error 404';
        log.error({
          details: { message },
        } as unknown as DetailedError);
        const logFunctionArgument = logFunction.mock.calls[0][0];
        expect(logFunctionArgument).toMatch(/\[error\]:/);
        expect(logFunctionArgument).toMatch(message);
      });
    });
  });

  describe('handleError', () => {
    const message = 'Uncaught TypeError: NetworkError when attempting to fetch resource.';
    const showErrorMessage = vscode.window.showErrorMessage as jest.Mock;

    it('passes the argument to the handler', () => {
      const error = new Error(message);

      handleError(error);

      expect(getLoggedMessage()).toContain(message);
    });

    it('prompts the user to show the logs', () => {
      handleError(new Error(message));

      expect(showErrorMessage).toBeCalledWith(message, 'Show Logs');
    });

    it('shows the logs when the user confirms the prompt', async () => {
      const executeCommand = vscode.commands.executeCommand as jest.Mock;
      showErrorMessage.mockResolvedValue('Show Logs');

      await handleError(new Error(message)).onlyForTesting;

      expect(executeCommand).toBeCalledWith(USER_COMMANDS.SHOW_OUTPUT);
    });
  });
});
