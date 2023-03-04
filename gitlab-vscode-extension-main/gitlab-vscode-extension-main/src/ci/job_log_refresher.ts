import { currentBranchRefresher } from '../current_branch_refresher';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { doNotAwait } from '../utils/do_not_await';
import { jobLogCache } from './job_log_cache';

export class JobLogRefresher {
  readonly #jobId: number;

  constructor(jobId: number) {
    this.#jobId = jobId;
    this.#timer = setTimeout(() => this.#onTimer(), 10);
  }

  #timer: NodeJS.Timeout;

  #isDisposed = false;

  // If the log updates, and then stops for 3 seconds, do a single check if the job is still running.
  #shouldRefreshStatus = true;

  async #onTimer() {
    if (this.#isDisposed) return;

    const cacheItem = jobLogCache.get(this.#jobId);
    if (!cacheItem?.repositoryRoot) {
      this.dispose();
      return;
    }

    try {
      const { rawTrace: oldTrace, repositoryRoot, eTag } = cacheItem;

      const projectInRepository = gitlabProjectRepository.getProjectOrFail(repositoryRoot);
      const gitlabService = getGitLabService(projectInRepository);

      const newResult = await gitlabService.getJobTrace(
        projectInRepository.project,
        this.#jobId,
        eTag,
      );

      if (newResult) {
        this.#shouldRefreshStatus = true;
        const { rawTrace, eTag: newETag } = newResult;
        jobLogCache.setForRunning(repositoryRoot, this.#jobId, rawTrace, newETag);
      } else if (this.#shouldRefreshStatus) {
        this.#shouldRefreshStatus = false;

        const jobStatus = await gitlabService.getSingleJob(
          projectInRepository.project,
          this.#jobId,
        );
        if (jobStatus.status !== 'running') {
          doNotAwait(currentBranchRefresher.refresh(false));
          jobLogCache.set(this.#jobId, oldTrace);
        }
      }
    } finally {
      if (!this.#isDisposed) {
        this.#timer = setTimeout(() => this.#onTimer(), 3000);
      }
    }
  }

  dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    if (this.#timer) clearTimeout(this.#timer);
  }
}
