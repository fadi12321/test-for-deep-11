import vscode, { Extension } from 'vscode';
import { setupYamlSupport } from './yaml_support';
import { DO_NOT_SHOW_YAML_SUGGESTION } from './constants';
import { InMemoryMemento } from '../test/integration/test_infrastructure/in_memory_memento';

const confirmationMessageArguments = [
  "Would you like to install Red Hat's YAML extension to get real-time linting on the .gitlab-ci.yml file?",
  'Yes',
  'Not now',
  "No. Don't ask again.",
];

describe('yaml support', () => {
  let suggestionResponse: undefined | string;

  let fileName: string;

  let triggerOnDidOpenDocumentEvent: any;

  let context: any;

  let onDidOpenTextDocument: any;
  let showInformationMessage: any;
  const setup = async () => {
    setupYamlSupport(context);
    await triggerOnDidOpenDocumentEvent?.();
  };

  beforeEach(() => {
    fileName = '';
    context = {
      globalState: new InMemoryMemento(),
    } as unknown as vscode.ExtensionContext;
    onDidOpenTextDocument = jest.fn(cb => {
      triggerOnDidOpenDocumentEvent = () => cb({ fileName });
    });
    showInformationMessage = jest.fn(() => Promise.resolve(suggestionResponse));
    (vscode.window.showInformationMessage as jest.Mock).mockImplementation(showInformationMessage);
    (vscode.workspace.onDidOpenTextDocument as jest.Mock).mockImplementation(onDidOpenTextDocument);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('does nothing if extension is already installed', async () => {
    (vscode.extensions.getExtension as jest.Mock).mockImplementation(
      () => ({} as Extension<unknown>),
    );
    await setup();
    expect(onDidOpenTextDocument).not.toBeCalled();
  });

  it('does nothing if suggestion has been dismissed', async () => {
    await context.globalState.update(DO_NOT_SHOW_YAML_SUGGESTION, true);
    await setup();
    expect(vscode.workspace.onDidOpenTextDocument).not.toBeCalled();
  });

  describe('when file opened', () => {
    describe('when is yaml file', () => {
      beforeEach(() => {
        fileName = '.gitlab-ci.yml';
      });

      it('shows information message each time', async () => {
        await setup();
        expect(showInformationMessage.mock.calls).toEqual([confirmationMessageArguments]);

        await triggerOnDidOpenDocumentEvent();
        expect(showInformationMessage.mock.calls).toEqual([
          confirmationMessageArguments,
          confirmationMessageArguments,
        ]);
      });

      describe("when clicked 'Do not show again'", () => {
        beforeEach(async () => {
          suggestionResponse = "No. Don't ask again.";
          await setup();
          await triggerOnDidOpenDocumentEvent();
        });

        it('shows information message once', () => {
          expect(showInformationMessage.mock.calls).toEqual([confirmationMessageArguments]);
        });

        it('stores dismissal in globalState', () => {
          expect(context.globalState.get(DO_NOT_SHOW_YAML_SUGGESTION)).toBe(true);
        });
      });
    });

    describe('when is not yaml file', () => {
      beforeEach(() => {
        fileName = 'README.md';
      });

      it('does nothing', async () => {
        await setup();
        expect(showInformationMessage).not.toHaveBeenCalled();
      });
    });
  });
});
