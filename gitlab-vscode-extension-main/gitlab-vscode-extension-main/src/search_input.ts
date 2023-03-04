import vscode from 'vscode';
import { ProjectCommand } from './commands/run_with_valid_project';
import { GitLabProject } from './gitlab/gitlab_project';
import * as openers from './commands/openers';
import { createQueryString } from './utils/create_query_string';

const parseQuery = (query: string, noteableType: string) => {
  const params: Record<string, any> = {};
  const tokens = query
    .replace(/: /g, ':') // Normalize spaces after tokens.
    .replace(/\s[a-z]*:/gi, t => `\n${t}`) // Get tokens and add new line.
    .split('\n') // Create array from tokens.
    .map(t => t.trim().split(':')); // Return new array with token and value arrays.

  // If there is no token it's a basic text search.
  if (tokens.length === 1 && tokens[0][1] === undefined) {
    // eslint-disable-next-line prefer-destructuring
    params.search = tokens[0][0];
  } else {
    tokens.forEach(t => {
      const [token, value] = t;

      switch (token) {
        // Merge value of `labels` token with previous labels.
        // By doing this we will be able to use `labels` and `label` token together.
        case 'labels':
          params.labels = (params.labels || []).concat(value.replace(/, /g, ',').split(','));
          break;

        // Labels can be multiple and should be comma separated.
        case 'label':
          params.labels = params.labels || [];
          params.labels.push(value);
          break;

        // GitLab requires Title and Description in `search` query param.
        // Since we are passing this as search query, GL will also search in issue descriptions too.
        case 'title':
          params.search = value;
          break;

        // GitLab UI requires milestone as milestone_title.
        case 'milestone':
          delete params.milestone;
          params.milestone_title = value;
          break;

        // GitLab requires author name as author_username.
        // `author` is syntatic sugar of extension.
        case 'author':
          delete params.author;

          if (value === 'me') {
            params.scope = 'created-by-me';
          } else {
            params.author_username = value;
          }
          break;

        // GitLab requires assignee name as assignee_username[] for issues.
        // and as assignee_username for merge requests `assignee` is syntatic sugar of extension.
        // We currently don't support multiple assignees for issues.
        case 'assignee':
          delete params.assignee;

          if (value === 'me') {
            params.scope = 'assigned-to-me';
          } else {
            const key =
              noteableType === 'merge_requests' ? 'assignee_username' : 'assignee_username[]';
            params[key] = value;
          }
          break;

        // Add other tokens. If there is a typo in token name GL either ignore it or won't find any issue.
        default:
          params[token] = value;
          break;
      }
    });
  }

  return createQueryString(params);
};

function getSearchInput(description: string): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    ignoreFocusOut: true,
    placeHolder: description,
  });
}

async function showSearchInputFor(noteableType: string, project: GitLabProject) {
  const query = await getSearchInput(
    'Search in title or description. (Check extension page for search with filters)',
  );
  if (!query) return;
  const queryString = parseQuery(query, noteableType);

  await openers.openUrl(`${project.webUrl}/${noteableType}${queryString}`);
}

export const showIssueSearchInput: ProjectCommand = async projectInRepository =>
  showSearchInputFor('issues', projectInRepository.project);

export const showMergeRequestSearchInput: ProjectCommand = async projectInRepository =>
  showSearchInputFor('merge_requests', projectInRepository.project);

export const showProjectAdvancedSearchInput: ProjectCommand = async projectInRepository => {
  const query = await getSearchInput(
    'Project Advanced Search. (Check extension page for Advanced Search)',
  );
  if (!query) return;
  const { instanceUrl } = projectInRepository.account;
  const { project } = projectInRepository;

  const queryString = createQueryString({
    search: query,
    project_id: project.restId,
    scope: 'issues',
  });
  // Select issues tab by default for Advanced Search
  await openers.openUrl(`${instanceUrl}/search${queryString}`);
};
