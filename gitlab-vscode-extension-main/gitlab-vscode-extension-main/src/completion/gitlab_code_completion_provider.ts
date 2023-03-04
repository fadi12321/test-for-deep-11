import * as openai from 'openai';
import * as vscode from 'vscode';
import { log } from '../log';
import { AI_ASSISTED_CODE_SUGGESTIONS_API_URL } from '../constants';
import {
  getAiAssistedCodeSuggestionsConfiguration,
  AiAssistedCodeSuggestionsConfiguration,
} from '../utils/extension_configuration';
import { getActiveProject } from '../commands/run_with_valid_project';
import { tokenExchangeService } from '../gitlab/token_exchange_service';
import { getStopSequences } from '../utils/ai_assisted_code_suggestions/get_stop_sequences';

export class GitLabCodeCompletionProvider implements vscode.InlineCompletionItemProvider {
  model: string;

  server: string;

  debouncedCall: any;

  debounceTime = 500; // milliseconds

  manualTrigger: boolean;

  constructor(
    configuration: AiAssistedCodeSuggestionsConfiguration = getAiAssistedCodeSuggestionsConfiguration(),
  ) {
    this.model = 'gitlab';
    this.server = GitLabCodeCompletionProvider.#getServer();
    this.debouncedCall = undefined;
    this.manualTrigger = configuration.manualTrigger;
  }

  static async #getGitLabApiKey(): Promise<string | undefined> {
    const activeProject = getActiveProject();
    if (!activeProject) {
      log.debug(
        `AI Assist: Unable to get active project, ensure GitLab extension is properly configured`,
      );
      return undefined;
    }
    const account = await tokenExchangeService.refreshIfNeeded(activeProject.account.id);
    return account.token;
  }

  static #getServer(): string {
    const serverUrl = new URL(AI_ASSISTED_CODE_SUGGESTIONS_API_URL);
    log.debug(`AI Assist: Using server: ${serverUrl.href}`);
    return serverUrl.href.toString();
  }

  static #getPrompt(document: vscode.TextDocument, position: vscode.Position) {
    return document.getText(new vscode.Range(0, 0, position.line, position.character));
  }

  async getCompletions(document: vscode.TextDocument, position: vscode.Position) {
    const prompt = GitLabCodeCompletionProvider.#getPrompt(document, position);

    // TODO: Sanitize prompt to prevent exposing sensitive information
    // Issue https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/692
    if (!prompt) {
      log.debug('AI Assist: Prompt is empty, probably due to first line');
      return [] as vscode.InlineCompletionItem[];
    }

    const oa = new openai.OpenAIApi(
      new openai.Configuration({
        apiKey: await GitLabCodeCompletionProvider.#getGitLabApiKey(),
        basePath: this.server,
      }),
    );
    const response = await oa.createCompletion({
      model: this.model,
      prompt: prompt as openai.CreateCompletionRequestPrompt,
      stop: getStopSequences(position.line, document),
    });

    return (
      response.data.choices
        ?.map(choice => choice.text)
        .map(
          choiceText =>
            new vscode.InlineCompletionItem(
              choiceText as string,
              new vscode.Range(position, position),
            ),
        ) || []
    );
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
  ): Promise<vscode.InlineCompletionItem[]> {
    clearTimeout(this.debouncedCall);

    return new Promise(resolve => {
      //  In case of a hover, this will be triggered which is not desired as it calls for a new prediction
      if (
        context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic ||
        this.manualTrigger
      ) {
        this.debouncedCall = setTimeout(async () => {
          resolve(this.getCompletions(document, position));
        }, this.debounceTime);
      }
    });
  }
}
