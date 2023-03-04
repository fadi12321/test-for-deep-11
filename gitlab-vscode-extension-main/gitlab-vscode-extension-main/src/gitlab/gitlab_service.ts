import * as https from 'https';
import { GraphQLClient, gql, Variables, RequestDocument } from 'graphql-request';
import crossFetch from 'cross-fetch';
import { URL } from 'url';
import createHttpProxyAgent from 'https-proxy-agent';
import assert from 'assert';
import { FetchError } from '../errors/fetch_error';
import { getUserAgentHeader } from './http/get_user_agent_header';
import { ensureAbsoluteAvatarUrl } from './ensure_absolute_avatar_url';
import { CustomQueryType } from './custom_query_type';
import { CustomQuery } from './custom_query';
import { getHttpAgentOptions } from './http/get_http_agent_options';
import { GitLabProject } from './gitlab_project';
import { getRestIdFromGraphQLId } from './get_rest_id_from_graphql_id';
import { UserFriendlyError } from '../errors/user_friendly_error';
import { getMrPermissionsQuery, MrPermissionsQueryOptions } from './graphql/mr_permission';
import { GqlBasePosition, GqlGenericNote, GqlNote, Node } from './graphql/shared';
import { GetProjectsOptions, GqlProjectsResult, queryGetProjects } from './graphql/get_projects';
import {
  getIssueDiscussionsQuery,
  getMrDiscussionsQuery,
  GetDiscussionsQueryOptions,
  GqlDiscussion,
  GetDiscussionsQueryResult,
  GqlTextDiffDiscussion,
} from './graphql/get_discussions';
import {
  GetSnippetsQueryOptions,
  GetSnippetsQueryResult,
  GqlBlob,
  GqlSnippet,
  queryGetSnippets,
} from './graphql/get_snippets';
import {
  GetProjectQueryOptions,
  GetProjectQueryResult,
  queryGetProject,
} from './graphql/get_project';
import { createDiffNoteMutation, GqlDiffPositionInput } from './graphql/create_diff_comment';
import { removeLeadingSlash } from '../utils/remove_leading_slash';
import { log } from '../log';
import { isMr } from '../utils/is_mr';
import { ifVersionGte } from '../utils/if_version_gte';
import {
  getSnippetContentQuery,
  GetSnippetContentQueryOptions,
  GqlContentSnippet,
} from './graphql/get_snippet_content';
import { UnsupportedVersionError } from '../errors/unsupported_version_error';
import {
  OAUTH_CLIENT_ID,
  OAUTH_REDIRECT_URI,
  README_SECTIONS,
  REQUIRED_VERSIONS,
} from '../constants';
import { makeMarkdownLinksAbsolute } from '../utils/make_markdown_links_absolute';
import { makeHtmlLinksAbsolute } from '../utils/make_html_links_absolute';
import { HelpError } from '../errors/help_error';
import { Credentials } from '../accounts/credentials';
import { newCreateNoteMutation, oldCreateNoteMutation } from './graphql/create_note';
import { createQueryString, QueryValue } from '../utils/create_query_string';

interface CreateNoteResult {
  createNote: {
    errors: unknown[];
    note: GqlNote | null;
  };
}

interface RestLabelEvent {
  label: unknown;
  body: string;

  created_at: string;
}

type Note = GqlDiscussion | RestLabelEvent;

interface GetDiscussionsOptions {
  issuable: RestIssuable;
  endCursor?: string;
}

interface RestNote {
  body: string;
}

export interface ExchangeTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  created_at: number;
}

export interface AuthorizationCodeTokenExchangeParams {
  instanceUrl: string;
  code: string;
  codeVerifier: string;
  grantType: 'authorization_code';
}

interface RefreshTokenExchangeParams {
  instanceUrl: string;
  grantType: 'refresh_token';
  refreshToken: string;
}
/** Parameters used to exchange code for token with the GitLab OAuth service */
export type TokenExchangeUrlParams =
  | AuthorizationCodeTokenExchangeParams
  | RefreshTokenExchangeParams;

function isLabelEvent(note: Note): note is RestLabelEvent {
  return (note as RestLabelEvent).label !== undefined;
}

const normalizeAvatarUrl =
  (instanceUrl: string) =>
  (issuable: RestIssuable): RestIssuable => {
    const { author } = issuable;
    if (!author?.avatar_url) {
      return issuable;
    }
    return {
      ...issuable,
      author: {
        ...author,
        avatar_url: ensureAbsoluteAvatarUrl(instanceUrl, author.avatar_url),
      },
    };
  };

// TODO: extract the mutation into a separate file like src/gitlab/graphql/get_project.ts
const discussionSetResolved = gql`
  mutation DiscussionToggleResolve($replyId: DiscussionID!, $resolved: Boolean!) {
    discussionToggleResolve(input: { id: $replyId, resolve: $resolved }) {
      errors
    }
  }
`;

// TODO: extract the mutation into a separate file like src/gitlab/graphql/get_project.ts
const deleteNoteMutation = gql`
  mutation DeleteNote($noteId: NoteID!) {
    destroyNote(input: { id: $noteId }) {
      errors
    }
  }
`;

// TODO: extract the mutation into a separate file like src/gitlab/graphql/get_project.ts
const updateNoteBodyMutation = gql`
  mutation UpdateNoteBody($noteId: NoteID!, $body: String) {
    updateNote(input: { id: $noteId, body: $body }) {
      errors
    }
  }
`;

const getNamespaceWithPath = (issuable: RestIssuable) => issuable.references.full.split(/[#!]/)[0];
const getIssuableGqlId = (issuable: RestIssuable) =>
  `gid://gitlab/${isMr(issuable) ? 'MergeRequest' : 'Issue'}/${issuable.id}`;
const getMrGqlId = (id: number) => `gid://gitlab/MergeRequest/${id}`;

const safelyParseJson = (text: string): any | undefined => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const handleFetchError = async (response: Response, resourceName: string) => {
  if (!response.ok) {
    const body = await response.text().catch(() => undefined);
    // Check if the response is a GitLab invalid token error.
    if (response.status === 401 && body && safelyParseJson(body)?.error === 'invalid_token') {
      const { hostname } = new URL(response.url);
      throw new HelpError(
        `Failed to access a remote repository on ${hostname} due to an expired or revoked access token. You must create a new token.`,
        { section: README_SECTIONS.SETUP },
      );
    }
    throw new FetchError(`Fetching ${resourceName} from ${response.url} failed`, response, body);
  }
};

const getTotalPages = (response: Response): number =>
  parseInt(response.headers.get('x-total-pages') || '1', 10);

const getCurrentPage = (query: Record<string, QueryValue>): number =>
  query.page && typeof query.page === 'number' ? query.page : 1;

const SEARCH_LIMIT = 30;
const getProjectDefaultOptions = {
  membership: true,
  limit: SEARCH_LIMIT,
  searchNamespaces: true,
};

export interface ValidationResponse {
  valid?: boolean;
  merged_yaml?: string;
  errors: string[];
}

// This has to be type, because interface isn't compatible with Record<string,unknown> https://github.com/microsoft/TypeScript/issues/15300#issuecomment-332366024
type CreateSnippetOptions = {
  title: string;
  description?: string;
  file_name: string;
  visibility: SnippetVisibility;
  content: string;
};

export class GitLabService {
  #credentials: Credentials;

  constructor(credentials: Credentials) {
    this.#credentials = credentials;
  }

  async graphqlRequest<T = any, V = Variables>(
    document: RequestDocument,
    variables?: V,
  ): Promise<T> {
    const ensureEndsWithSlash = (url: string) => url.replace(/\/?$/, '/');
    const endpoint = new URL(
      './api/graphql',
      ensureEndsWithSlash((await this.getCredentials()).instanceUrl),
    ).href; // supports GitLab instances that are on a custom path, e.g. "https://example.com/gitlab"
    const client = new GraphQLClient(endpoint, await this.#getFetchOptions());
    return client.request(document, variables);
  }

  async crossFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
    const fetchOptions = await this.#getFetchOptions();
    return crossFetch(input, {
      ...fetchOptions,
      ...init,
      headers: { ...fetchOptions.headers, ...init.headers },
    });
  }

  async getCredentials(): Promise<Credentials> {
    return this.#credentials;
  }

  private static getHttpAgent(instanceUrl: string) {
    const agentOptions = getHttpAgentOptions();
    if (agentOptions.proxy) {
      return createHttpProxyAgent(agentOptions.proxy);
    }
    if (instanceUrl.startsWith('https://')) {
      return new https.Agent(agentOptions);
    }
    return undefined;
  }

  private static getFetchOptions(instanceUrl: string, token?: string) {
    const authorizationHeader: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    return {
      headers: {
        ...authorizationHeader,
        ...getUserAgentHeader(),
      },
      agent: GitLabService.getHttpAgent(instanceUrl),
    };
  }

  async #getFetchOptions() {
    const { instanceUrl, token } = await this.getCredentials();
    return GitLabService.getFetchOptions(instanceUrl, token);
  }

  async fetchAllPages<T>(
    apiResourcePath: string,
    query: Record<string, QueryValue> = {},
    resourceName = 'resource',
  ): Promise<T[]> {
    const { instanceUrl } = await this.getCredentials();
    const url = `${instanceUrl}/api/v4${apiResourcePath}${createQueryString(query)}`;
    const result = await this.crossFetch(url);
    await handleFetchError(result, resourceName);
    // pagination
    if (getTotalPages(result) > getCurrentPage(query))
      return [
        ...(await result.json()),
        ...(await this.fetchAllPages<T>(
          apiResourcePath,
          { ...query, page: getCurrentPage(query) + 1 },
          resourceName,
        )),
      ];
    return result.json() as Promise<T[]>;
  }

  async fetch<T>(
    apiResourcePath: string,
    query: Record<string, QueryValue> = {},
    resourceName = 'resource',
  ): Promise<T> {
    const { instanceUrl } = await this.getCredentials();
    const url = `${instanceUrl}/api/v4${apiResourcePath}${createQueryString(query)}`;
    const result = await this.crossFetch(url);
    await handleFetchError(result, resourceName);
    return result.json() as Promise<T>;
  }

  async postFetch<T>(
    apiResourcePath: string,
    resourceName = 'resource',
    body?: unknown,
  ): Promise<T> {
    const { instanceUrl } = await this.getCredentials();
    const response = await this.crossFetch(`${instanceUrl}/api/v4${apiResourcePath}`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify(body),
    });
    await handleFetchError(response, resourceName);
    return response.json() as Promise<T>;
  }

  async getVersion(): Promise<string | undefined> {
    try {
      const result = await this.fetch<{ version: string }>('/version', {}, 'instance version');
      return result.version;
    } catch (e) {
      log.error(e);
      return undefined;
    }
  }

  async getProject(namespaceWithPath: string): Promise<GitLabProject | undefined> {
    const options: GetProjectQueryOptions = { namespaceWithPath };
    const result = await this.graphqlRequest<GetProjectQueryResult>(queryGetProject, options);
    return result.project && new GitLabProject(result.project);
  }

  async getProjects(options: Partial<GetProjectsOptions>): Promise<GitLabProject[]> {
    const optionsWithDefaults = { ...getProjectDefaultOptions, ...options };
    const results = await this.graphqlRequest<GqlProjectsResult>(
      queryGetProjects,
      optionsWithDefaults,
    );
    return results.projects?.nodes?.map(project => new GitLabProject(project)) || [];
  }

  async getSnippets(namespaceWithPath: string, afterCursor?: string): Promise<GqlSnippet[]> {
    const options: GetSnippetsQueryOptions = {
      namespaceWithPath,
      afterCursor,
    };
    const result = await this.graphqlRequest<GetSnippetsQueryResult>(queryGetSnippets, options);

    const { project } = result;
    // this can mean three things: project doesn't exist, user doesn't have access, or user credentials are wrong
    // https://gitlab.com/gitlab-org/gitlab/-/issues/270055
    if (!project) {
      throw new Error(
        `Project ${namespaceWithPath} was not found. You might not have permissions to see it.`,
      );
    }
    const snippets = project.snippets.nodes;
    // each snippet has to contain projectId so we can make REST API call for the content
    const snippetsWithProject = snippets.map(sn => ({
      ...sn,
      projectId: project.id,
    }));
    return project.snippets.pageInfo?.hasNextPage
      ? [
          ...snippetsWithProject,
          ...(await this.getSnippets(namespaceWithPath, project.snippets.pageInfo.endCursor)),
        ]
      : snippetsWithProject;
  }

  // TODO remove this method once the lowest supported GitLab version is 14.1.0
  async getSnippetContentOld(snippet: GqlSnippet, blob: GqlBlob): Promise<string> {
    const getBranch = (rawPath: string) => {
      // raw path example: "/gitlab-org/gitlab-vscode-extension/-/snippets/111/raw/master/okr.md"
      const result = rawPath.match(/\/-\/snippets\/\d+\/raw\/([^/]+)\//);
      assert(result, `The rawPath is malformed ${rawPath}`);
      return result[1];
    };
    const projectId = getRestIdFromGraphQLId(snippet.projectId);
    const snippetId = getRestIdFromGraphQLId(snippet.id);
    const branch = getBranch(blob.rawPath);
    const { instanceUrl } = await this.getCredentials();
    const url = `${instanceUrl}/api/v4/projects/${projectId}/snippets/${snippetId}/files/${branch}/${blob.path}/raw`;
    const result = await this.crossFetch(url);
    await handleFetchError(result, 'snippet');
    return result.text();
  }

  async getSnippetContentNew(snippet: GqlSnippet, blob: GqlBlob): Promise<string> {
    const options: GetSnippetContentQueryOptions = { snippetId: snippet.id };
    const result = await this.graphqlRequest<{ snippets: Node<GqlContentSnippet> }>(
      getSnippetContentQuery,
      options,
    );
    const snippetResponse = result.snippets.nodes[0];
    assert(snippetResponse, `The requested snippet ${snippet.id} was not found`);
    const blobResponse = snippetResponse.blobs.nodes.find(b => b.path === blob.path);
    assert(blobResponse, `The requested snippet ${snippet.id} is missing blob ${blob.path}`);
    return blobResponse.rawPlainData;
  }

  async getSnippetContent(snippet: GqlSnippet, blob: GqlBlob): Promise<string> {
    return ifVersionGte(
      await this.getVersion(),
      '14.1.0',
      () => this.getSnippetContentNew(snippet, blob),
      () => this.getSnippetContentOld(snippet, blob),
    );
  }

  // This method has to use REST API till https://gitlab.com/gitlab-org/gitlab/-/issues/280803 gets done
  async getMrDiff(mr: RestMr): Promise<RestMrVersion> {
    const versionsPath = `/projects/${mr.project_id}/merge_requests/${mr.iid}/versions`;
    const versions = await this.fetch<RestMrVersion[]>(versionsPath, {}, 'MR versions');
    const lastVersion = versions[0];
    const lastVersionPath = `/projects/${mr.project_id}/merge_requests/${mr.iid}/versions/${lastVersion.id}`;
    return this.fetch(lastVersionPath, {}, 'MR diff');
  }

  async getFileContent(path: string, ref: string, projectId: number | string): Promise<string> {
    const encodedPath = encodeURIComponent(removeLeadingSlash(path));
    const encodedRef = encodeURIComponent(ref);
    const encodedProject = encodeURIComponent(projectId);
    const { instanceUrl } = await this.getCredentials();
    const fileUrl = `${instanceUrl}/api/v4/projects/${encodedProject}/repository/files/${encodedPath}/raw?ref=${encodedRef}`;
    const fileResult = await this.crossFetch(fileUrl);
    await handleFetchError(fileResult, 'file');
    return fileResult.text();
  }

  async getFile(
    path: string,
    ref: string,
    projectId: number | string,
  ): Promise<RestRepositoryFile> {
    const encodedPath = encodeURIComponent(removeLeadingSlash(path));
    const encodedProject = encodeURIComponent(projectId);
    const fileApiPath = `/projects/${encodedProject}/repository/files/${encodedPath}`;
    return this.fetch(fileApiPath, { ref }, 'file');
  }

  async getTree(
    path: string,
    ref: string,
    projectId: number | string,
  ): Promise<RestRepositoryTreeEntry[]> {
    const encodedProject = encodeURIComponent(projectId);
    const treePath = `/projects/${encodedProject}/repository/tree`;
    return this.fetchAllPages(treePath, { ref, path: removeLeadingSlash(path) }, 'repository tree');
  }

  getBranches(project: number | string, search?: string): Promise<RestBranch[]> {
    const encodedProject = encodeURIComponent(project);
    const projectBranchesPath = `/projects/${encodedProject}/repository/branches`;
    return this.fetch(projectBranchesPath, { search }, 'branches');
  }

  getTags(project: number | string, search?: string): Promise<RestTag[]> {
    const encodedProject = encodeURIComponent(project);
    const projectTagsPath = `/projects/${encodedProject}/repository/tags`;
    return this.fetch(projectTagsPath, { search }, 'tags');
  }

  /*
    The GraphQL endpoint sends us the note.htmlBody with links that start with `/`.
    This works well for the the GitLab webapp, but in VS Code we need to add the full host.
  */
  // eslint-disable-next-line class-methods-use-this
  private addHostToUrl(
    discussion: GqlDiscussion,
    namespaceWithPath: string,
    instanceUrl: string,
  ): GqlDiscussion {
    const prependHost: <T extends GqlBasePosition | null>(
      note: GqlGenericNote<T>,
    ) => GqlGenericNote<T> = note => ({
      ...note,
      body: makeMarkdownLinksAbsolute(note.body, namespaceWithPath, instanceUrl),
      bodyHtml: makeHtmlLinksAbsolute(note.bodyHtml, instanceUrl),
      author: {
        ...note.author,
        avatarUrl:
          note.author.avatarUrl && ensureAbsoluteAvatarUrl(instanceUrl, note.author.avatarUrl),
      },
    });
    return {
      ...discussion,
      notes: {
        ...discussion.notes,
        nodes: discussion.notes.nodes.map(prependHost),
      },
    } as GqlDiscussion;
  }

  async getDiscussions({ issuable, endCursor }: GetDiscussionsOptions): Promise<GqlDiscussion[]> {
    await this.validateVersion('MR Discussions', REQUIRED_VERSIONS.MR_DISCUSSIONS);
    const namespaceWithPath = getNamespaceWithPath(issuable);
    const query = isMr(issuable) ? getMrDiscussionsQuery : getIssueDiscussionsQuery;
    const options: GetDiscussionsQueryOptions = {
      namespaceWithPath,
      iid: String(issuable.iid),
      afterCursor: endCursor,
    };
    const result = await this.graphqlRequest<GetDiscussionsQueryResult>(query, options);
    assert(result.project, `Project ${namespaceWithPath} was not found.`);
    const discussions =
      result.project.issue?.discussions || result.project.mergeRequest?.discussions;
    assert(discussions, `Discussions for issuable ${issuable.references.full} were not found.`);
    if (discussions.pageInfo?.hasNextPage) {
      assert(discussions.pageInfo.endCursor);
      const remainingPages = await this.getDiscussions({
        issuable,
        endCursor: discussions.pageInfo.endCursor,
      });
      return [...discussions.nodes, ...remainingPages];
    }
    const { instanceUrl } = await this.getCredentials();
    return discussions.nodes.map(n => this.addHostToUrl(n, namespaceWithPath, instanceUrl));
  }

  async canUserCommentOnMr(mr: RestMr): Promise<boolean> {
    return ifVersionGte(
      await this.getVersion(),
      REQUIRED_VERSIONS.MR_DISCUSSIONS,
      async () => {
        const namespaceWithPath = getNamespaceWithPath(mr);
        const queryOptions: MrPermissionsQueryOptions = {
          namespaceWithPath,
          iid: String(mr.iid),
        };
        const result = await this.graphqlRequest(getMrPermissionsQuery, queryOptions);
        assert(result?.project?.mergeRequest, `MR ${mr.references.full} was not found.`);
        return Boolean(result.project.mergeRequest.userPermissions?.createNote);
      },
      async () => false,
    );
  }

  async setResolved(replyId: string, resolved: boolean): Promise<void> {
    await this.validateVersion('MR Discussions', REQUIRED_VERSIONS.MR_DISCUSSIONS);
    try {
      return await this.graphqlRequest<void>(discussionSetResolved, {
        replyId,
        resolved,
      });
    } catch (e) {
      throw new UserFriendlyError(
        `Couldn't ${resolved ? 'resolve' : 'unresolve'} the discussion when calling the API.
        For more information, review the extension logs.`,
        e,
      );
    }
  }

  private async getLabelEvents(issuable: RestIssuable): Promise<RestLabelEvent[]> {
    const type = isMr(issuable) ? 'merge_requests' : 'issues';
    const labelEventsPath = `/projects/${issuable.project_id}/${type}/${issuable.iid}/resource_label_events`;
    return this.fetchAllPages(labelEventsPath, { sort: 'asc' }, 'label events');
  }

  async getDiscussionsAndLabelEvents(issuable: RestIssuable): Promise<Note[]> {
    const [discussions, labelEvents] = await Promise.all([
      this.getDiscussions({ issuable }),
      this.getLabelEvents(issuable),
    ]);

    const combinedEvents: Note[] = [...discussions, ...labelEvents];
    combinedEvents.sort((a: Note, b: Note) => {
      const aCreatedAt = isLabelEvent(a) ? a.created_at : a.createdAt;
      const bCreatedAt = isLabelEvent(b) ? b.created_at : b.createdAt;
      return aCreatedAt < bCreatedAt ? -1 : 1;
    });

    return combinedEvents;
  }

  async createNote(issuable: RestIssuable, body: string, replyId?: string): Promise<GqlNote> {
    await this.validateVersion('MR Discussions', REQUIRED_VERSIONS.MR_DISCUSSIONS);
    try {
      const createNoteMutation = ifVersionGte(
        await this.getVersion(),
        REQUIRED_VERSIONS.MR_MERGE_QUICK_ACTION,
        () => newCreateNoteMutation,
        () => oldCreateNoteMutation,
      );
      const result = await this.graphqlRequest<CreateNoteResult>(createNoteMutation, {
        issuableId: getIssuableGqlId(issuable),
        body,
        replyId,
        mergeRequestDiffHeadSha: isMr(issuable) ? issuable.sha : undefined,
      });
      if (result.createNote.errors.length > 0) {
        throw new Error(result.createNote.errors.join(','));
      }
      assert(result.createNote.note);
      return result.createNote.note;
    } catch (error) {
      throw new UserFriendlyError(
        `Couldn't create the comment when calling the API.
      For more information, review the extension logs.`,
        error,
      );
    }
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.validateVersion('MR Discussions', REQUIRED_VERSIONS.MR_DISCUSSIONS);
    try {
      await this.graphqlRequest<void>(deleteNoteMutation, {
        noteId,
      });
    } catch (e) {
      throw new UserFriendlyError(
        `Couldn't delete the comment when calling the API.
        For more information, review the extension logs.`,
        e,
      );
    }
  }

  /**
   * This method is used only as a replacement of optimistic locking when updating a note.
   * We request the latest note to validate that it hasn't changed since we last saw it.
   */
  private async getMrNote(mr: RestMr, noteId: number): Promise<RestNote> {
    await this.validateVersion('MR Discussions', REQUIRED_VERSIONS.MR_DISCUSSIONS);
    const notePath = `/projects/${mr.project_id}/merge_requests/${mr.iid}/notes/${noteId}`;
    return this.fetch(notePath, {}, 'latest note');
  }

  async updateNoteBody(
    noteGqlId: string,
    body: string,
    originalBody: string,
    mr: RestMr,
  ): Promise<void> {
    await this.validateVersion('MR Discussions', REQUIRED_VERSIONS.MR_DISCUSSIONS);
    const latestNote = await this.getMrNote(mr, getRestIdFromGraphQLId(noteGqlId));
    // This check is the best workaround we can do in the lack of optimistic locking
    // Issue to make this check in the GitLab instance: https://gitlab.com/gitlab-org/gitlab/-/issues/323808
    if (latestNote.body !== originalBody) {
      throw new UserFriendlyError(
        `This comment changed after you last viewed it, and can't be edited.
        Your new comment is NOT lost. To retrieve it, edit the comment again and copy your comment text,
        then update the original comment by opening the sidebar and running the
        "GitLab: Refresh sidebar" command.`,
        new Error(
          `You last saw:\n"${originalBody}"\nbut the latest version is:\n"${latestNote.body}"`,
        ),
      );
    }
    try {
      await this.graphqlRequest<void>(updateNoteBodyMutation, {
        noteId: noteGqlId,
        body,
      });
    } catch (e) {
      throw new UserFriendlyError(
        `Couldn't update the comment when calling the API.
        Your draft hasn't been lost. To see it, edit the comment.
        For more information, review the extension logs.`,
        e,
      );
    }
  }

  async createDiffNote(
    mrId: number,
    body: string,
    position: GqlDiffPositionInput,
  ): Promise<GqlTextDiffDiscussion> {
    await this.validateVersion('MR Discussions', REQUIRED_VERSIONS.MR_DISCUSSIONS);
    try {
      const result = await this.graphqlRequest(createDiffNoteMutation, {
        issuableId: getMrGqlId(mrId),
        body,
        position,
      });
      assert(
        result?.createDiffNote?.note?.discussion,
        `Response doesn't contain a note with discussion: ${JSON.stringify(result)}`,
      );
      return result.createDiffNote.note.discussion;
    } catch (e) {
      throw new UserFriendlyError(
        `Unable to add comment. Try again.`,
        new Error(`MR(${mrId}), ${JSON.stringify(position)}, ${e}`),
      );
    }
  }

  async validateCIConfig(project: GitLabProject, content: string): Promise<ValidationResponse> {
    await this.validateVersion('CI config validation', REQUIRED_VERSIONS.CI_CONFIG_VALIDATIONS);
    return this.postFetch(`/projects/${project.restId}/ci/lint`, 'CI validation', { content });
  }

  async renderMarkdown(markdown: string, project: GitLabProject) {
    const responseBody = await this.postFetch<{ html: string }>('/markdown', 'rendered markdown', {
      text: markdown,
      project: project.namespaceWithPath,
      gfm: 'true', // True needs to be a string for the API
    });
    return responseBody.html;
  }

  async createSnippet(
    project: GitLabProject,
    data: CreateSnippetOptions,
  ): Promise<{ web_url: string }> {
    return this.postFetch(`/projects/${project.restId}/snippets`, 'create snippet', data);
  }

  async validateVersion(featureName: string, requiredVersion: string) {
    const currentVersion = await this.getVersion();
    await ifVersionGte(
      currentVersion,
      requiredVersion,
      () => undefined,
      () => {
        throw new UnsupportedVersionError(featureName, currentVersion!, requiredVersion);
      },
    );
  }

  async getFirstUserByUsername(username: string): Promise<RestUser | undefined> {
    const users = await this.fetch('/users', { username }, 'users');
    return (users as RestUser[])[0];
  }

  async handleCurrentUser<S extends string | undefined>(username: S): Promise<S> {
    if (username === '<current_user>') {
      const user = await this.getCurrentUser();
      return user.username as S;
    }

    return username;
  }

  async getCurrentUser(): Promise<RestUser> {
    return this.fetch('/user', {}, 'current user');
  }

  async getIssuables(params: CustomQuery, project: GitLabProject) {
    const { type, scope, state, author, assignee, wip, reviewer } = params;
    let { searchIn } = params;
    const config = {
      type: type || 'merge_requests',
      scope: scope || 'all',
      state: state || 'opened',
    };

    if (config.type === 'vulnerabilities' && config.scope !== 'dismissed') {
      config.scope = 'all';
    } else if (
      (config.type === 'issues' || config.type === 'merge_requests') &&
      config.scope !== 'assigned_to_me' &&
      config.scope !== 'created_by_me'
    ) {
      config.scope = 'all';
    }

    let path = '';
    const search = new Map<string, string>();
    search.set('state', config.state);

    /**
     * Set path based on config.type
     */
    if (config.type === 'epics') {
      if (project.groupRestId) {
        path = `/groups/${project.groupRestId}/${config.type}`;
        search.set('include_ancestor_groups', 'true');
      } else {
        return [];
      }
    } else {
      const searchKind =
        config.type === CustomQueryType.VULNERABILITY ? 'vulnerability_findings' : config.type;
      path = `/projects/${project.restId}/${searchKind}`;
      search.set('scope', config.scope);
    }

    /**
     * Author parameters
     */
    if (config.type === 'issues') {
      if (author) {
        search.set('author_username', author);
      }
    } else if (author) {
      const authorUser = await this.getFirstUserByUsername(author);
      if (authorUser) search.set('author_id', String(authorUser.id));
    }

    /**
     * Assignee parameters
     */
    if (assignee === 'Any' || assignee === 'None') {
      search.set('assignee_id', assignee);
    } else if (assignee && config.type === 'issues') {
      search.set('assignee_username', assignee);
    } else if (assignee) {
      const assigneeUser = await this.getFirstUserByUsername(assignee);
      if (assigneeUser) search.set('assignee_id', String(assigneeUser.id));
    }

    /**
     * Reviewer parameters
     */
    if (reviewer === 'Any' || reviewer === 'None') {
      search.set('reviewer_id', reviewer);
    } else if (reviewer) {
      search.set('reviewer_username', await this.handleCurrentUser(reviewer));
    }

    /**
     * Search in parameters
     */
    if (searchIn) {
      if (searchIn === 'all') {
        searchIn = 'title,description';
      }
      search.set('in', searchIn);
    }

    /**
     * Handle WIP/Draft for merge_request config.type
     */
    if (config.type === 'merge_requests' && wip) {
      search.set('wip', wip);
    }

    /**
     * Query parameters related to issues
     */
    let issueQueryParams: Record<string, QueryValue> = {};
    if (config.type === 'issues') {
      issueQueryParams = {
        confidential: params.confidential,
        'not[labels]': params.excludeLabels,
        'not[milestone]': params.excludeMilestone,
        'not[author_username]': await this.handleCurrentUser(params.excludeAuthor),
        'not[assignee_username]': await this.handleCurrentUser(params.excludeAssignee),
        'not[search]': params.excludeSearch,
        'not[in]': params.excludeSearchIn,
      };
    }

    /**
     * Miscellaneous parameters
     */
    const queryParams: Record<string, QueryValue> = {
      labels: params.labels,
      milestone: params.milestone,
      search: params.search,
      created_before: params.createdBefore,
      created_after: params.createdAfter,
      updated_before: params.updatedBefore,
      updated_after: params.updatedAfter,
      order_by: params.orderBy,
      sort: params.sort,
      per_page: params.maxResults,
      report_type: params.reportTypes,
      severity: params.severityLevels,
      confidence: params.confidenceLevels,
      ...issueQueryParams,
    };

    const issuables = (await this.fetch(
      path,
      { ...Object.fromEntries(search), ...queryParams },
      'issuables',
    )) as RestIssuable[]; // FIXME: vulnerabilities don't conform to the RestIssuable interface (they don't have author field) https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/614
    const { instanceUrl } = await this.getCredentials();
    return issuables.map(normalizeAvatarUrl(instanceUrl));
  }

  async getMrClosingIssues(project: GitLabProject, mrId: number): Promise<MinimalRestIssuable[]> {
    try {
      return await this.fetch(
        `/projects/${project.restId}/merge_requests/${mrId}/closes_issues`,
        {},
        'MR closing issues',
      );
    } catch (e) {
      log.error(e);
      return [];
    }
  }

  async getSingleProjectIssue(
    project: GitLabProject,
    issueIid: number,
  ): Promise<RestIssuable | undefined> {
    try {
      return await this.fetch(`/projects/${project.restId}/issues/${issueIid}`, {}, 'Single Issue');
    } catch (e) {
      log.error(e);
      return undefined;
    }
  }

  async getJobsForPipeline(pipelineId: number, projectId: number): Promise<RestJob[]> {
    return this.fetchAllPages(
      `/projects/${projectId}/pipelines/${pipelineId}/jobs`,
      {},
      'jobs for pipeline',
    );
  }

  async getExternalStatusForCommit(
    sha: string,
    ref: string | null,
    projectId: number,
  ): Promise<RestJob[]> {
    const statuses = await this.fetch<RestJob[]>(
      `/projects/${projectId}/repository/commits/${sha}/statuses`,
      { stage: 'external', ref },
      'status for commit',
    );
    return statuses.map(s => ({ ...s, stage: 'external' }));
  }

  async getLastPipelineForMr(mr: RestMr): Promise<RestPipeline | undefined> {
    const pipelines = await this.fetch<RestPipeline[]>(
      `/projects/${mr.project_id}/merge_requests/${mr.iid}/pipelines`,
      {},
      'pipelines for MR',
    );
    return pipelines[0];
  }

  async getOpenMergeRequestForCurrentBranch(
    project: GitLabProject,
    trackingBranchName: string,
  ): Promise<RestMr | undefined> {
    const path = `/projects/${project.restId}/merge_requests`;
    const mrs = await this.fetch<RestMr[]>(
      path,
      { state: 'opened', source_branch: trackingBranchName },
      'open MRs for current branch',
    );
    return mrs[0];
  }

  async getLastPipelineForCurrentBranch(
    project: GitLabProject,
    trackingBranchName: string,
  ): Promise<RestPipeline | undefined> {
    const pipelinesRootPath = `/projects/${project.restId}/pipelines`;
    const pipelines = await this.fetch<RestPipeline[]>(`${pipelinesRootPath}`, {
      ref: trackingBranchName,
    });
    return pipelines[0];
  }

  async getPipelineAndMrForCurrentBranch(
    project: GitLabProject,
    trackingBranchName: string,
  ): Promise<{
    pipeline?: RestPipeline;
    mr?: RestMr;
  }> {
    // TODO: implement more granular approach to errors (deciding between expected and critical)
    // This can be done when we migrate the code to gitlab_service.ts
    const turnErrorToUndefined: <T>(p: Promise<T>) => Promise<T | undefined> = p =>
      p.catch(e => {
        log.error(e);
        return undefined;
      });

    const mr = await turnErrorToUndefined(
      this.getOpenMergeRequestForCurrentBranch(project, trackingBranchName),
    );
    if (mr) {
      const pipeline = await turnErrorToUndefined(this.getLastPipelineForMr(mr));
      if (pipeline) return { mr, pipeline };
    }
    const pipeline = await turnErrorToUndefined(
      this.getLastPipelineForCurrentBranch(project, trackingBranchName),
    );
    return { mr, pipeline };
  }

  async cancelOrRetryPipeline(
    action: 'cancel' | 'retry',
    project: GitLabProject,
    pipeline: RestPipeline,
  ): Promise<RestPipeline> {
    return this.postFetch(
      `/projects/${project.restId}/pipelines/${pipeline.id}/${action}`,
      'cancel or retry pipeline',
    );
  }

  async createPipeline(branchName: string, project: GitLabProject) {
    return this.postFetch(
      `/projects/${project.restId}/pipeline?ref=${encodeURIComponent(branchName)}`,
      'create pipeline',
    );
  }

  async cancelOrRetryJob(
    action: 'cancel' | 'retry' | 'play',
    project: GitLabProject,
    job: RestJob,
  ): Promise<RestJob> {
    return this.postFetch(
      `/projects/${project.restId}/jobs/${job.id}/${action}`,
      'cancel or retry job',
    );
  }

  async getJobTrace(
    project: GitLabProject,
    jobId: number,
    eTag: string | null = null,
  ): Promise<{ rawTrace: string; eTag: string } | null> {
    const { instanceUrl } = await this.getCredentials();
    const url = `${instanceUrl}/api/v4/projects/${project.restId}/jobs/${jobId}/trace`;

    const headers: HeadersInit = {};
    if (eTag) headers['If-None-Match'] = eTag;
    const fileResult = await this.crossFetch(url, { headers });

    if (fileResult.status === 304) return null;

    await handleFetchError(fileResult, 'job trace');
    return { rawTrace: await fileResult.text(), eTag: fileResult.headers.get('ETag') ?? '' };
  }

  async getSingleJob(project: GitLabProject, jobId: number): Promise<RestJob> {
    return this.fetch(`/projects/${project.restId}/jobs/${jobId}`, {}, 'current job');
  }

  /** This method exchanges code from GitLab OAuth endpoint for an access token. */
  static async exchangeToken(params: TokenExchangeUrlParams): Promise<ExchangeTokenResponse> {
    const fetchOptions = GitLabService.getFetchOptions(params.instanceUrl);
    const commonParams = [
      `client_id=${OAUTH_CLIENT_ID}`,
      `redirect_uri=${OAUTH_REDIRECT_URI}`,
      `grant_type=${params.grantType}`,
    ];
    const grantTypeParams =
      params.grantType === 'authorization_code'
        ? [`code=${params.code}`, `code_verifier=${params.codeVerifier}`]
        : [`refresh_token=${params.refreshToken}`];
    const response = await crossFetch(`${params.instanceUrl}/oauth/token`, {
      ...fetchOptions,
      method: 'POST',
      headers: {
        ...fetchOptions.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: [...commonParams, ...grantTypeParams].join('&'),
    });
    if (!response.ok) {
      const errorResponse = await response.json();
      if (errorResponse.error === 'invalid_grant') {
        throw new Error(
          'Refreshing OAuth token has failed: already refreshed. ' +
            'The token might have been refreshed in another window. ' +
            'You can retry the operation. If this error persists, remove and re-add your GitLab account.',
        );
      }
      throw new Error(`Refreshing OAuth token has failed: ${response.status} - ${errorResponse}`);
    }
    const result = await response.json();
    assert(result.access_token, 'Refresh token response is missing access token.');
    assert(result.refresh_token, 'Refresh token response is missing refresh token.');
    return result;
  }
}
