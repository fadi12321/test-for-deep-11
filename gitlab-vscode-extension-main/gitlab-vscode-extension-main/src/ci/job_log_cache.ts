import * as vscode from 'vscode';
import { JobLogRefresher } from './job_log_refresher';

export type JobTraceSection = {
  startLine: number;
  startTime: number;
  endLine?: number;
  endTime?: number;
};

export type CacheItem = {
  repositoryRoot?: string;
  rawTrace: string;
  filtered?: string;
  decorations?: Map<string, vscode.DecorationOptions[]>;
  sections?: Map<string, JobTraceSection>;
  eTag: string | null;
};

// Additional implementation-specific properties
type InnerCacheItem = CacheItem & {
  lastOpened: number;
  refresher?: JobLogRefresher;
};

export class JobLogCache {
  #onDidChangeEmitter = new vscode.EventEmitter<number>();

  onDidJobChange = this.#onDidChangeEmitter.event;

  #storage: Record<number, InnerCacheItem> = {};

  touch(jobId: number) {
    if (this.#storage[jobId]) {
      this.#storage[jobId].lastOpened = new Date().getTime();
    }
  }

  get(jobId: number): CacheItem | undefined {
    return this.#storage[jobId];
  }

  set(jobId: number, rawTrace: string) {
    const exists = !!this.#storage[jobId];
    this.#storage[jobId]?.refresher?.dispose();
    this.#storage[jobId] = {
      rawTrace,
      eTag: null,
      lastOpened: this.#storage[jobId]?.lastOpened ?? new Date().getTime(),
    };
    if (exists) this.#onDidChangeEmitter.fire(jobId);
  }

  setForRunning(repositoryRoot: string, jobId: number, rawTrace: string, eTag: string | null) {
    const exists = !!this.#storage[jobId];
    this.#storage[jobId] = {
      repositoryRoot,
      rawTrace,
      lastOpened: this.#storage[jobId]?.lastOpened ?? new Date().getTime(),
      eTag,
      refresher: this.#storage[jobId]?.refresher,
    };
    if (exists) this.#onDidChangeEmitter.fire(jobId);
  }

  startRefreshing(jobId: number) {
    const item = this.#storage[jobId];
    if (!item || item.eTag === null || item.refresher) return;
    item.refresher = new JobLogRefresher(jobId);
  }

  stopRefreshing(jobId: number) {
    this.#storage[jobId]?.refresher?.dispose();
    delete this.#storage[jobId]?.refresher;
  }

  addDecorations(
    jobId: number,
    sections: Map<string, JobTraceSection>,
    decorations: Map<string, vscode.DecorationOptions[]>,
    filtered: string,
  ) {
    this.#storage[jobId] = {
      ...this.#storage[jobId],
      sections,
      decorations,
      filtered,
    };
  }

  async delete(jobId: number) {
    if (!this.#storage[jobId]) return;

    // When a document changes its language, VS Code emits a close and open event in succession.
    // Delay the removal of the cache entry, and abort if the document was accessed during the timeout.
    const { lastOpened } = this.#storage[jobId];
    await new Promise<void>(accept => {
      setTimeout(accept, 2000);
    });

    if (this.#storage[jobId]?.lastOpened === lastOpened) {
      this.#storage[jobId]?.refresher?.dispose();
      delete this.#storage[jobId];
    }
  }

  clearAll() {
    Object.values(this.#storage).forEach(v => v.refresher?.dispose());
    this.#storage = {};
  }
}

export const jobLogCache = new JobLogCache();
