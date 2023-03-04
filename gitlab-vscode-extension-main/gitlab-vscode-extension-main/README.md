<!--

---
stage: Create
group: Editor
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

-->

# <img src="https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/ef3c16e228e51f522b1af0d19b6284b309c4f601/src/assets/logo.png" width="64" align="center" /> [GitLab VS Code Extension](https://gitlab.com/gitlab-org/gitlab-vscode-extension)

This extension integrates GitLab into Visual Studio Code. After you [set up the extension](#setup), you can:

- [**View GitLab issues and merge requests**](#issue-and-merge-request-details-and-comments-in-vs-code).
  View issues, comments, merge requests, and changed files [in the sidebar](#sidebar---details),
  or build a [custom search](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/user/custom-queries.md)
  to meet your needs.
- [**Create and review merge requests**](#merge-request-reviews).
- [**Validate your GitLab CI/CD configuration**](#validate-gitlab-cicd-configuration) locally with a [command](#commands).
- [**Manage your pipelines**](#pipeline-actions). View your [pipeline status](#status-bar---details)
  and open the related merge request. With [advanced pipeline actions](#pipeline-actions),
  you can create, retry, or cancel a pipeline.
- [**View the job output**](#view-the-job-output). View the output of a running or finished job in an editor tab.
- **Manage snippets**. [Create](#create-snippet) and [insert](#insert-snippet)
  snippets, and apply [snippet patches](#create-and-apply-snippet-patch).
- [**Browse a GitLab repository directly**](#browse-a-repository-without-cloning)
  in Visual Studio Code without cloning it.
- [**Auto-complete GitLab CI/CD variables**](#ci-variable-autocompletion) in your `.gitlab-ci.yml` pipeline file, and any file beginning with `.gitlab-ci` and ending with `.yml` or `.yaml`, like `.gitlab-ci.production.yml`.

Supports [multiple GitLab instances](#multiple-gitlab-instances).

If you face an issue, check out our [list of known issues](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/user/known-issues.md) and if it's not listed, please [report it](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/CONTRIBUTING.md#reporting-issues).

## Minimum supported version

This extension supports GitLab versions 13.0 and later. Even though most of the extension's features work with older versions, we currently don't actively support GitLab instances below version 13.0.

To find your GitLab version, visit `/help` (like `https://gitlab.com/help`).

## Features

_You need to set up your access token(s) to use these features, please see [Setup](#setup) section below._

### Browse issues, review MRs

See your issues, MRs (including changed files) and other [custom search results](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/user/custom-queries.md) on a dedicated panel in the VS Code sidebar. [Read more](#sidebar---details)

### Information about your branch - pipelines, MR, closing issue

See pipeline status, open MR and closing issue links in the status bar. [Read more](#status-bar---details).
This pipeline status automatically updates so you don't need to open GitLab to see your pipeline status.

Advanced pipeline actions allow you to view pipeline on GitLab, create a new pipeline, retry or cancel current pipeline. [Read more](#pipeline-actions).

![status_bar.gif](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/status-bar.gif)

### Commands

You can use [Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette) to run the commands.

- `GitLab: Search Project Issues (Supports Filters)`. [Read more](#search-with-filters)
- `GitLab: Search Project Merge Requests (Supports Filters)`. [Read more](#search-with-filters)
- `GitLab: Project Advanced Search (Issues, Merge Requests, Commits, Comments...)`. [Read more](#search-with-advanced-search)
- `GitLab: Create Snippet` - Create public, internal or private snippet from entire file or selection. [Read more](#create-snippet).
- `GitLab: Insert Snippet` - Insert a project snippet, supports multi-file snippets. [Read more](#insert-snippet).
- `GitLab: Compare Current Branch with Default Branch` - Compare your branch with the repository's default branch and view changes on GitLab. [Read more](#compare-with-default-branch).
- `GitLab: Open Active File on GitLab` - View active file on GitLab with highlighting active line number and selected text block. [Read more](#open-active-file).
- `GitLab: Validate GitLab CI/CD Config` - Validate GitLab CI/CD configuration file `.gitlab-ci.yml`. [Read more](#validate-gitlab-cicd-configuration).
- `GitLab: Show Merged GitLab CI/CD Config` - Show a preview of the GitLab CI/CD configuration file `.gitlab-ci.yml` with all includes resolved. [Read more](#show-merged-gitlab-cicd-configuration).
- `GitLab: Open Merge Request for Current Branch`
- `GitLab: Show Issues Assigned to Me` - Open issues assigned to you on GitLab.
- `GitLab: Show Merge Requests Assigned to Me` - Open MRs assigned to you on GitLab.
- `GitLab: Open Current Project on GitLab`
- `GitLab: Create New Issue on Current Project`
- `GitLab: Create New Merge Request on Current Project` - Open the merge request page to create a merge request.
- `GitLab: Open Remote Repository` - Browse a remote GitLab repository. [Read more](#browse-a-repository-without-cloning).
- `GitLab: Open Active File on GitLab`
- `GitLab: Copy Link to Active File on GitLab`
- `GitLab: Remove Account from VS Code`

Commands this extension extends or integrates with:

- `Git: Clone` - Search for and clone projects for every GitLab instance you set up. [Read more](#git-extension-integration), [Official Documentation](https://code.visualstudio.com/docs/editor/versioncontrol#_cloning-a-repository)
- `Git: Add Remote...` - Add existing projects as remote from every GitLab instance you set up.

## Setup

This extension requires you to create a GitLab personal access token, and assign it to the extension:

1. [Install the extension](https://marketplace.visualstudio.com/items?itemName=GitLab.gitlab-workflow) from the Visual Studio Marketplace and enable it. If you use an unofficial version of VS Code, install the extension from the [Open VSX Registry](https://open-vsx.org/extension/GitLab/gitlab-workflow).
1. Optional. To sign in to GitLab.com, you can run the command `GitLab: Authenticate to GitLab.com` to authenticate using OAuth. This feature is not available for self-managed installations.
1. If you did not sign in with OAuth, create a personal access token with the `api` and `read_user` scopes:
   - If you use GitLab.com, go to the [personal access tokens](https://gitlab.com/-/profile/personal_access_tokens) page.
   - If you use a self-managed GitLab instance, follow the instructions [in the GitLab documentation](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html#create-a-personal-access-token).
1. Copy the token. _For security reasons, this value is never displayed again, so you must copy this value now._
1. Open Visual Studio Code, then open the command palette by pressing <kbd>Command</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>.
1. In the command palette, search for **GitLab: Add Account** and press <kbd>Enter<kbd>.
1. In the **URL to GitLab instance**, paste the full URL to your GitLab instance, including the `http://` or `https://`. Press <kbd>Enter</kbd> to confirm.
1. Paste in your GitLab personal access token and press <kbd>Enter</kbd>. The token is not displayed, nor is it accessible to others.

The extension automatically matches your Git repository remote URL with the GitLab instance URL you specified for your token. If this automatic matching fails, you can right-click (<kbd>Ctrl</kbd>+click on MacOS) the repository in the GitLab Tree View and resolve the problem.

The extension is ready to use. If your project has a pipeline for the last commit, and a merge request from your current branch, information about both is displayed in the Visual Studio Code status bar.

### Set token with environment variables

If you often delete your VS Code storage (such as in Gitpod containers) you can create environment variables before starting VS Code. If you set the token in an environment variable you don't have to set the personal access token every time you delete your VS Code storage.

- `GITLAB_WORKFLOW_INSTANCE_URL`: GitLab instance URL (e.g. https://gitlab.com).
- `GITLAB_WORKFLOW_TOKEN`: personal access token, which you created [in a previous step](#step-1-create-your-personal-access-token).

The token configured in an environment variable is overridden if you configure a token for the same GitLab instance in the extension.

### Self-signed certificate authority

If your GitLab uses a self-signed CA (certificate authority), please read
[the SSL setup guide](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/user/ssl.md)
and the [settings for self-signed certificates](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/user/troubleshooting.md#settings-for-self-signed-certificates)

## Extension settings

To learn how to change the VS Code Settings, read the official [Settings documentation](https://code.visualstudio.com/docs/getstarted/settings).

If you use self-signed certificates to connect to your GitLab instance, read the
community-contributed
[settings for self-signed certificates](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/user/troubleshooting.md#settings-for-self-signed-certificates).

**`gitlab.pipelineGitRemoteName`** _(default: null)_

The name of the Git remote name corresponding to the GitLab repository with your pipelines. If set to `null` or missing, then the extension uses the same remote as for the non-pipeline features.

**`gitlab.debug`** _(default: false)_

Setting this option to `true` enables debug mode. Debug mode improves error stack trace because the extension will use source maps to understand minified code. Debug mode also shows debug log messages in the extension logs.

**`gitlab.customQueries`**

Defines the search queries that retrieves the items shown on the GitLab Panel. See [Custom Queries documentation](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/user/custom-queries.md) for more details.

**`gitlab.aiAssistedCodeSuggestions.enabled`** _(default: false)_

Toggle to enable or disable AI assisted code suggestions.

## Features in-depth

### Issue and Merge Request details and comments in VS Code

![Issues in Visual Studio Code](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/issues-in-vscode.png)

GitLab Workflow allows you to view issue details and comments right in the VS Code. Click an issue link from the sidebar and VS Code will open a new tab to show the issue details. You can also comment on the issue from VS Code.

You can use [GitLab Slash Commands](https://docs.gitlab.com/ee/integration/slash_commands.html) to perform actions directly from VS Code. For example, to assign an issue to `@fatihacet`, simply add a comment `/assign @fatihacet` inside VS Code.

#### Merge Request Reviews

GitLab Workflow enables you to review merge requests directly inside the editor:

![Animated gif showing how to review a merge request](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/diff-comments.gif)

1. In the left-hand sidebar, go to **Issues and Merge Requests**.
1. Select the appropriate merge request filter to view a list of merge requests.
1. Expand a relevant merge request to view the description and files changed.
1. Select a file to open it, and view the diff.

From the diff, you can:

- Review and create discussions.
- Resolve and unresolve these discussions.
- Delete and edit individual comments.

### Sidebar - details

Extension will add a GitLab Workflow panel to sidebar of VS Code. The dedicated panel will allow you to see the list of your issues and MRs (you can decide the exact queries by using the [custom queries](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/user/custom-queries.md)). Also you will be able to see pipeline, MR and issue links for your current branch.

You can see the issue and MR details by clicking on the issue item or by expanding the MR item and clicking on "Description". When you expand the MR, you can see all the changed files. When you click on a changed file, the extension opens the MR diff.

![_sidebar.gif](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/sidebar.gif)

### View the job output

To view the output of a job directly in VS Code, on the left sidebar, select the job. The output is updated automatically. To view the latest output, select **Scroll to Bottom**.

![view-job-output.png](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/9555acfd02253cb506d2b5e50dee7fde885fbddf/docs/assets/view-job-output.png)

### Pipeline actions

One of the real power features of this extension is pipeline actions. This feature can be accessible from the status bar by clicking the pipeline status text or command palette and allows you to,

- View the latest pipeline on GitLab
- Create a new pipeline for your current branch
- Retry the last pipeline
- Cancel the last pipeline

![_pipeline_actions.gif](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/pipeline_actions.gif)

### Status bar - details

If your current project is a GitLab project, the extension will do the following things:

- Fetch pipeline of the last commit and show it on the status bar. Clicking this item will open the pipeline actions menu.
- Show open MR for current branch and show it on the status bar. Clicking this item will open MR on GitLab.
- Fetch closing issue of that MR and show it on the status bar. Clicking this item will open Issue on GitLab.

### Search

GitLab Workflow extension provides you two types of search. Search with filters and Advanced Search.

#### Search with filters

It allows users to search issues/MRs against their title and description fields. In the search input, you can type your search term and hit Enter, for example, `Inconsistent line endings for HEX files` or `Pipelines should ignore retried builds`.

It can become more powerful by allowing you to filter issues/MRs by author, assignee, milestone, title etc. Below is the full list of supported filter tokens

| Token     | Description                                                                                                                                                 | Example                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| title     | Search issues/MRs against their title and description. You don't need to add quotes around multiple words. See [Important notes](#important-notes) section. | discussions refactor                                               |
| labels    | Comma separated label list for multiple labels.                                                                                                             | `labels: frontend, Discussion, performance`                        |
| label     | To search with a single label. You can also have multiple `label` tokens.                                                                                   | `label: frontend` or `label:frontend label: Discussion`            |
| milestone | Milestone title without `%`.                                                                                                                                | `milestone: 9.5`                                                   |
| scope     | Searches issues/MRs for the given scope. Values can be `created-by-me`, `assigned-to-me` or `all`. Defaults to `created-by-me`.                             | `scope: created-by-me` or `scope: assigned-to-me` or `scope: all`. |
| author    | Username of the author without `@`.                                                                                                                         | `author: fatihacet`                                                |
| assignee  | Username of the assignee without `@`.                                                                                                                       | `assignee: timzallmann`                                            |

##### Examples

- `title: new merge request widget author: fatihacet assignee: jschatz1 labels: frontend, performance milestone: 10.5`
- `title: multiple group page author: annabeldunstone assignee: timzallmann label: frontend`

##### Important notes

- `:` after the token name is necessary. `label :` is not a valid token name and may return parsing error. Hence `label:` should be used. However, space after the token name is optional. Both `label: frontend` and `label:frontend` is valid. This rule is valid for all tokens above.
- You don't need to add quotes around multiple words for `title` token. `title:"new merge request widget"` may return parsing error. `title: new merge request widget` should be used.
- You can have `labels` and `label` tokens at the same time. `labels: fronted discussion label: performance` is a valid query and all labels will be included in your search query. It's equal with `labels: fronted discussion performance`. You can also have multiple `label` tokens. `label: frontend label: discussion label: performance` is valid and equals to `labels: fronted discussion performance`.

![Advanced search](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/advanced-search.gif)

#### Search with Advanced Search

GitLab provides [Advanced Search feature which is backed by Elasticsearch](https://docs.gitlab.com/ee/integration/elasticsearch.html). Please see [Advanced Search syntax](https://docs.gitlab.com/ee/user/search/advanced_search_syntax.html) for more details.

### Create snippet

You can create a snippet from selection or entire file. You can also select visibility level of your snippet.

![_create-snippet.gif](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/create-snippet.gif)

### Insert snippet

You can insert public and private project snippets. The insert supports [multi-file snippets](https://docs.gitlab.com/ee/user/snippets.html#multiple-files-by-snippet).

![insert-multi-file-snippet](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/insert-multi-file-snippet.gif)

### Create and apply snippet patch

Creating a snippet patch is a great way to suggest a multi-file change during MR review.

1. Locally check out the branch where you want to suggest changes.
1. Edit the project's code.
1. Run command `GitLab: Create snippet patch`. This stores the result of the `git diff` command in a GitLab snippet in your project.
1. VS Code opens a GitLab web page with the snippet patch. The snippet's description contains instructions on how to apply the patch.
1. Other team members can apply the snippet using the `GitLab: Apply snippet patch` command.

![Create and apply snippet patch](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/snippet-patch.mp4)

### Compare with default branch

You can see changes on GitLab by comparing your branch with the repository's default branch.

![_compare-with-master.gif](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/compare-with-master.gif)

### Open active file

This command allows you to see active file on GitLab. Extension sends active line number and selected text block to GitLab UI so you can see them highlighted.

![_open_active_file.gif](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/open_active_file.gif)

### Validate GitLab CI/CD Configuration

Using this command, you can quickly validate GitLab CI/CD configuration.

![Validate CI/CD configuration](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/validate-ci-config.gif)

### Show merged GitLab CI/CD configuration

This command displays a preview of your merged CI/CD configuration file, with all includes and references resolved.

![Show merged CI/CD configuration](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/e6492d12bab89d6a726046841fcc0f655e0db113/docs/assets/show-merged-ci-config.gif)

### CI/CD variable autocompletion

Quickly find the CI/CD variable you are looking for with the CI/CD variable autocompletion.

![screenshot of the CI/CD variable autocompletion](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/ci_variable_autocomplete.png)

### Clone GitLab projects

This extension integrates with the built-in Git Extension and allows you to search for and clone projects from GitLab (command `Git: Clone`).

- You can search for projects on each GitLab instance for which you [added an access-token](#step-2-add-token-to-gitlab-workflow-extension).
- Only projects where you are a **member of** are displayed.
- You can clone with SSH or HTTPS
- With HTTPS your access-token will be used for cloning the repository and fetching/pushing commits. This is also the case for all GitLab projects that are cloned manually with HTTPS and then opened in VS Code.

![Demonstration of cloning a project from gitlab.com](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/d0589878829338b64657e592f3451f1dace41cdf/docs/assets/git-clone.gif)

> **NOTE:** Using the access-token for cloning with HTTPS does not work with VS Code version 1.53.x (See [discussion](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/172#note_513068345))

### Browse a repository without cloning

With this extension, you can browse a GitLab repository without cloning it. While similar to the [GitHub Repositories](https://marketplace.visualstudio.com/items?itemName=github.remotehub) extension, remote GitLab repository browsing is **read-only**.

Prerequisite:

- You have [registered an access token](#setup) for that GitLab instance.

![browse remote repository](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/c8d66e145569749bc05b6b63531eea3dfbb80edb/docs/assets/virtual-workspace.gif)

To open and browse a repository, either:

- Run the **GitLab: Open Remote Repository** command
- Select _Choose Project_ option.
- Select GitLab instance, project and branch/tag that you would like to browse

Alternatively, run the **GitLab: Open Remote Repository** command and select "Enter gitlab-remote URL" option or manually add a `gitlab-remote` URL to your [workspace file](https://code.visualstudio.com/docs/editor/multi-root-workspaces#_workspace-file). For information about how to create GitLab remote URL, please see [GitLab remote URL format documentation](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/user/remote-fs-url-format.md)

### Code suggestions (Alpha)

Code completions within the GitLab WebIDE and VS Code Extension as you type. See the [AI Assisted Group](https://about.gitlab.com/handbook/product/categories/#ai-assisted-group) for more info.

---

## Contribution

This extension is open source and [hosted on GitLab](https://gitlab.com/gitlab-org/gitlab-vscode-extension). Contributions are more than welcome. Feel free to fork and add new features or submit bug reports. See [CONTRIBUTING](CONTRIBUTING.md) for more information.

[A list of the great people](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/CONTRIBUTORS.md) who contributed this project, and made it even more awesome, is available. Thank you all! 🎉
