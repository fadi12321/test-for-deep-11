import * as vscode from 'vscode';
import { CONFIG_NAMESPACE, AI_ASSISTED_CODE_SUGGESTIONS_CONFIG_NAMESPACE } from '../constants';
import { CustomQuery } from '../gitlab/custom_query';

// These constants represent `settings.json` keys. Other constants belong to `constants.ts`.
export const GITLAB_DEBUG_MODE = 'gitlab.debug';
export const AI_ASSISTED_CODE_SUGGESTIONS_MODE = 'gitlab.aiAssistedCodeSuggestions.enabled';
export const AI_ASSISTED_CODE_SUGGESTIONS_CONFIG = 'gitlab.aiAssistedCodeSuggestions';

export interface ExtensionConfiguration {
  pipelineGitRemoteName?: string;
  debug: boolean;
  featureFlags?: string[];
  customQueries: CustomQuery[];
}

export interface AiAssistedCodeSuggestionsConfiguration {
  enabled: boolean;
  manualTrigger: boolean;
}

// VS Code returns a value or `null` but undefined is better for using default function arguments
const turnNullToUndefined = <T>(val: T | null | undefined): T | undefined => val ?? undefined;

export function getExtensionConfiguration(): ExtensionConfiguration {
  const workspaceConfig = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  return {
    pipelineGitRemoteName: turnNullToUndefined(workspaceConfig.pipelineGitRemoteName),
    featureFlags: turnNullToUndefined(workspaceConfig.featureFlags),
    debug: workspaceConfig.debug,
    customQueries: workspaceConfig.customQueries || [],
  };
}

export function getAiAssistedCodeSuggestionsConfiguration(): AiAssistedCodeSuggestionsConfiguration {
  const aiAssistedCodeSuggestionsConfig = vscode.workspace.getConfiguration(
    AI_ASSISTED_CODE_SUGGESTIONS_CONFIG_NAMESPACE,
  );
  return {
    enabled: aiAssistedCodeSuggestionsConfig.enabled,
    manualTrigger: aiAssistedCodeSuggestionsConfig.manualTrigger,
  };
}
