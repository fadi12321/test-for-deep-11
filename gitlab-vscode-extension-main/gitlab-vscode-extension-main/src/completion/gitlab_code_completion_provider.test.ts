import { getAiAssistedCodeSuggestionsConfiguration } from '../utils/extension_configuration';

import { GitLabCodeCompletionProvider } from './gitlab_code_completion_provider';

describe('GitLabCodeCompletionProvider', () => {
  it('parses configuration correctly', () => {
    const expectedServer = 'https://codesuggestions.gitlab.com/v1';
    const expectedModel = 'gitlab';
    const configuration = getAiAssistedCodeSuggestionsConfiguration();
    const glcp: GitLabCodeCompletionProvider = new GitLabCodeCompletionProvider(configuration);
    expect(glcp.server).toBe(expectedServer);
    expect(glcp.model).toBe(expectedModel);
  });
});
