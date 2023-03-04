/*
  Commands that can be triggered from the command palette or context menus.
  These commands must be exactly the same as the contributed commands in package.json.
*/
export const USER_COMMANDS = {
  ADD_ACCOUNT: 'gl.addAccount',
  REMOVE_ACCOUNT: 'gl.removeAccount',
  SHOW_ISSUES_ASSIGNED_TO_ME: 'gl.showIssuesAssignedToMe',
  SHOW_MERGE_REQUESTS_ASSIGNED_TO_ME: 'gl.showMergeRequestsAssignedToMe',
  OPEN_ACTIVE_FILE: 'gl.openActiveFile',
  COPY_LINK_TO_ACTIVE_FILE: 'gl.copyLinkToActiveFile',
  OPEN_CURRENT_MERGE_REQUEST: 'gl.openCurrentMergeRequest',
  OPEN_CREATE_NEW_ISSUE: 'gl.openCreateNewIssue',
  OPEN_CREATE_NEW_MR: 'gl.openCreateNewMR',
  OPEN_PROJECT_PAGE: 'gl.openProjectPage',
  PIPELINE_ACTIONS: 'gl.pipelineActions',
  ISSUE_SEARCH: 'gl.issueSearch',
  MERGE_REQUEST_SEARCH: 'gl.mergeRequestSearch',
  PROJECT_ADVANCED_SEARCH: 'gl.projectAdvancedSearch',
  COMPARE_CURRENT_BRANCH: 'gl.compareCurrentBranch',
  CREATE_SNIPPET: 'gl.createSnippet',
  INSERT_SNIPPET: 'gl.insertSnippet',
  VALIDATE_CI_CONFIG: 'gl.validateCIConfig',
  SHOW_MERGED_CI_CONFIG: 'gl.showMergedCIConfig',
  SHOW_OUTPUT: 'gl.showOutput',
  SIDEBAR_VIEW_AS_LIST: 'gl.sidebarViewAsList',
  SIDEBAR_VIEW_AS_TREE: 'gl.sidebarViewAsTree',
  REFRESH_SIDEBAR: 'gl.refreshSidebar',
  RESOLVE_THREAD: 'gl.resolveThread',
  UNRESOLVE_THREAD: 'gl.unresolveThread',
  DELETE_COMMENT: 'gl.deleteComment',
  START_EDITING_COMMENT: 'gl.startEditingComment',
  CANCEL_EDITING_COMMENT: 'gl.cancelEditingComment',
  CANCEL_FAILED_COMMENT: 'gl.cancelFailedComment',
  RETRY_FAILED_COMMENT: 'gl.retryFailedComment',
  SUBMIT_COMMENT_EDIT: 'gl.submitCommentEdit',
  CREATE_COMMENT: 'gl.createComment',
  CHECKOUT_MR_BRANCH: 'gl.checkoutMrBranch',
  CLONE_WIKI: 'gl.cloneWiki',
  CREATE_SNIPPET_PATCH: 'gl.createSnippetPatch',
  APPLY_SNIPPET_PATCH: 'gl.applySnippetPatch',
  OPEN_MR_FILE: 'gl.openMrFile',
  OPEN_REPOSITORY: 'gl.openRepository',
  SELECT_PROJECT_FOR_REPOSITORY: 'gl.selectProjectForRepository',
  SELECT_PROJECT: 'gl.selectProject',
  ASSIGN_PROJECT: 'gl.assignProject',
  CLEAR_SELECTED_PROJECT: 'gl.clearSelectedProject',
  DOWNLOAD_ARTIFACTS: 'gl.downloadArtifacts',
  OPEN_TRACE_ARTIFACT: 'gl.openTraceArtifact',
  WAIT_FOR_PENDING_JOB: 'gl.waitForPendingJob',
  SAVE_RAW_JOB_TRACE: 'gl.saveRawJobTrace',
  OPEN_IN_BROWSER: 'gl.openInBrowser',
  SCROLL_TO_BOTTOM: 'gl.scrollToBottom',
  EXECUTE_JOB: 'gl.executeJob',
  RETRY_JOB: 'gl.retryJob',
  CANCEL_JOB: 'gl.cancelJob',
  RETRY_FAILED_PIPELINE_JOBS: 'gl.retryFailedPipelineJobs',
  CANCEL_PIPELINE: 'gl.cancelPipeline',
  AUTHENTICATE: 'gl.authenticate',
};

/*
  User can't trigger these commands directly. We use them from within the code.
*/
export const PROGRAMMATIC_COMMANDS = {
  SHOW_RICH_CONTENT: 'gl.showRichContent',
  NO_IMAGE_REVIEW: 'gl.noImageReview',
};

export const VS_COMMANDS = {
  DIFF: 'vscode.diff',
  OPEN: 'vscode.open',
  GIT_SHOW_OUTPUT: 'git.showOutput',
  GIT_CLONE: 'git.clone',
  MARKDOWN_SHOW_PREVIEW: 'markdown.showPreview',
};
