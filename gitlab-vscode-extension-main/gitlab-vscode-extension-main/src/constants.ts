import vscode from 'vscode';

export const GITLAB_COM_URL = 'https://gitlab.com';
export const REVIEW_URI_SCHEME = 'gl-review';
export const MERGED_YAML_URI_SCHEME = 'gl-merged-ci-yaml';
export const JOB_LOG_URI_SCHEME = 'gl-job-log';
export const REMOTE_URI_SCHEME = 'gitlab-remote';
export const CONFIG_NAMESPACE = 'gitlab';
export const AI_ASSISTED_CODE_SUGGESTIONS_CONFIG_NAMESPACE = 'gitlab.aiAssistedCodeSuggestions';
export const AI_ASSISTED_CODE_SUGGESTIONS_API_URL = 'https://codesuggestions.gitlab.com/v1';
export const ADDED = 'added';
export const DELETED = 'deleted';
export const RENAMED = 'renamed';
export const MODIFIED = 'modified';
export const DO_NOT_SHOW_VERSION_WARNING = 'DO_NOT_SHOW_VERSION_WARNING';
export const DO_NOT_SHOW_YAML_SUGGESTION = 'DO_NOT_SHOW_YAML_SUGGESTION';

export const CHANGE_TYPE_QUERY_KEY = 'changeType';
export const HAS_COMMENTS_QUERY_KEY = 'hasComments';
export const PATCH_TITLE_PREFIX = 'patch: ';
export const PATCH_FILE_SUFFIX = '.patch';

export const OAUTH_CLIENT_ID = '36f2a70cddeb5a0889d4fd8295c241b7e9848e89cf9e599d0eed2d8e5350fbf5';
export const OAUTH_REDIRECT_URI = `${vscode.env.uriScheme}://gitlab.gitlab-workflow/authentication`;

/** Synced comment is stored in the GitLab instance */
export const SYNCED_COMMENT_CONTEXT = 'synced-comment';
/** Failed comment is only stored in the extension, it failed to be created in GitLab */
export const FAILED_COMMENT_CONTEXT = 'failed-comment';

export const README_SECTIONS = {
  SETUP: 'setup',
  REMOTEFS: 'browse-a-repository-without-cloning',
};

// NOTE: This needs to _always_ be a 3 digits
export const MINIMUM_VERSION = '13.6.0';

export const REQUIRED_VERSIONS = {
  // NOTE: This needs to _always_ be a 3 digits
  CI_CONFIG_VALIDATIONS: '13.6.0',
  MR_DISCUSSIONS: '13.9.0',
  MR_MERGE_QUICK_ACTION: '14.9.0', // https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/545
};
