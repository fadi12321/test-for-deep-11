import { promises as fs } from 'fs';
import * as path from 'path';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { GitLabService } from '../gitlab/gitlab_service';
import { asMock } from '../test_utils/as_mock';
import { toJobLogUri } from './job_log_uri';

import { JobLogContentProvider } from './job_log_content_provider';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { job, projectInRepository } from '../test_utils/entities';
import { jobLogCache } from './job_log_cache';
import { BranchState, currentBranchRefresher } from '../current_branch_refresher';

jest.mock('../current_branch_refresher');
jest.mock('../gitlab/get_gitlab_service');
jest.mock('../gitlab/gitlab_project_repository');

describe('JobLogContentProvider', () => {
  const uri = toJobLogUri('/repo', 123);

  beforeEach(async () => {
    const rawTrace = await fs.readFile(
      path.join(__dirname, '..', 'test_utils', 'raw_trace.log'),
      'utf-8',
    );

    const gitlabService: Partial<GitLabService> = {
      async getJobTrace(): Promise<{ rawTrace: string; eTag: string }> {
        return { rawTrace, eTag: '' };
      },
    };
    asMock(getGitLabService).mockReturnValue(gitlabService);
    asMock(gitlabProjectRepository.getProjectOrFail).mockReturnValue(projectInRepository);
    asMock(currentBranchRefresher.getOrRetrieveState).mockReturnValue({ type: 'invalid' });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jobLogCache.clearAll();
  });

  it('filters escape sequences', async () => {
    const filteredTrace = await fs.readFile(
      path.join(__dirname, '..', 'test_utils', 'filtered_trace.log'),
      'utf-8',
    );
    const provider = new JobLogContentProvider();
    const filtered = await provider.provideTextDocumentContent(uri);
    expect(filtered).toBe(filteredTrace);
  });

  it('sets cache items', async () => {
    await new JobLogContentProvider().provideTextDocumentContent(uri);

    const item = jobLogCache.get(123);
    expect(item?.sections).toBeDefined();
    expect(item?.decorations).toBeDefined();
    expect(item?.eTag).toBeNull();
  });

  it('sets cache items for running jobs', async () => {
    const state: BranchState = {
      type: 'branch',
      projectInRepository,
      issues: [],
      userInitiated: false,
      jobs: [{ ...job, id: 123, status: 'running' }],
    };
    asMock(currentBranchRefresher.getOrRetrieveState).mockReturnValue(state);

    await new JobLogContentProvider().provideTextDocumentContent(uri);

    const item = jobLogCache.get(123);
    expect(item?.eTag).toBeDefined();
  });

  it('skips the server call', async () => {
    jobLogCache.set(123, 'raw trace');

    const content = await new JobLogContentProvider().provideTextDocumentContent(uri);

    expect(content).toBe('raw trace\n');
  });

  it('uses the cached filtered text', async () => {
    jobLogCache.set(123, 'raw trace');
    jobLogCache.addDecorations(123, new Map(), new Map(), 'filtered');

    const content = await new JobLogContentProvider().provideTextDocumentContent(uri);

    expect(content).toBe('filtered');
  });
});
