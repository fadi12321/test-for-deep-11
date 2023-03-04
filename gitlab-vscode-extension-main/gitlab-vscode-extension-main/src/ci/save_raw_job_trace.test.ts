import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { GitLabService } from '../gitlab/gitlab_service';
import { asMock } from '../test_utils/as_mock';
import { toJobLogUri } from './job_log_uri';

import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { projectInRepository } from '../test_utils/entities';
import { jobLogCache } from './job_log_cache';
import { saveRawJobTrace } from './save_raw_job_trace';

jest.mock('../gitlab/get_gitlab_service');
jest.mock('../gitlab/gitlab_project_repository');

describe('saveRawJobTrace', () => {
  const uri = toJobLogUri('/repo', 123);

  beforeEach(async () => {
    asMock(vscode.window.showSaveDialog).mockResolvedValue(vscode.Uri.file('job.log'));
    asMock(gitlabProjectRepository.getProjectOrFail).mockReturnValue(projectInRepository);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jobLogCache.clearAll();
  });

  it('saves the log from the API', async () => {
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
    await saveRawJobTrace(uri);
    expect(vscode.workspace.fs.writeFile).toBeCalled();
  });

  it('saves the log from the cache', async () => {
    const gitlabService: Partial<GitLabService> = {
      getJobTrace(): Promise<{ rawTrace: string; eTag: string }> {
        return Promise.reject();
      },
    };
    asMock(getGitLabService).mockReturnValue(gitlabService);
    jobLogCache.set(123, 'content');

    await saveRawJobTrace(uri);
    expect(vscode.workspace.fs.writeFile).toBeCalled();
  });
});
