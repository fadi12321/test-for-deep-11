/*---------------------------------------------------------------------------------------------
 * Adapted from ANSI Colors (https://github.com/iliazeus/vscode-ansi)
 *
 * Copyright (c) 2020 Ilia Pozdnyakov. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import assert from 'assert';
import { JOB_LOG_URI_SCHEME } from '../constants';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { doNotAwait } from '../utils/do_not_await';
import { AnsiDecorationProvider } from './ansi_decoration_provider';
import { jobLogCache } from './job_log_cache';
import { fromJobLogUri } from './job_log_uri';
import { currentBranchRefresher } from '../current_branch_refresher';

export class JobLogContentProvider implements vscode.TextDocumentContentProvider {
  #onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  onDidChange = this.#onDidChangeEmitter.event;

  #decorationProvider: AnsiDecorationProvider;

  // A list of editors which have up-to-date decorations.
  #activeJobLogEditors: vscode.TextEditor[] = [];

  // A set of editors which should be scrolled to the bottom when the log is updated.
  #autoscrollingEditors = new Set<vscode.TextEditor>();

  // A set of job ids which should be scrolled to the bottom after opening.
  #newRunningJobIds = new Set<number>();

  // A set of editors which have the text cursor in the last position.
  // There is a bug with VS Code where updating the document to append more content,
  // while the cursor is in the last position, will cause all of the new text to be selected.
  // By listening to onDidChangeTextEditorSelection we can change the selection manually when this happens.
  #editorsWithCursorAtBottom = new Set<vscode.TextEditor>();

  #suppressScrollToggle = false;

  constructor(context?: vscode.ExtensionContext) {
    this.#decorationProvider = new AnsiDecorationProvider(context);

    vscode.workspace.onDidOpenTextDocument(d => {
      if (d.uri.scheme === JOB_LOG_URI_SCHEME) {
        const { job: id } = fromJobLogUri(d.uri);
        jobLogCache.touch(id);

        const cacheItem = jobLogCache.get(id);
        if (!cacheItem || cacheItem.eTag) {
          this.#newRunningJobIds.add(id);
        }

        this.#decorateAllEditors();
      }
    });
    vscode.workspace.onDidChangeTextDocument(ev => {
      if (ev.document.uri.scheme === JOB_LOG_URI_SCHEME) {
        const docUri = ev.document.uri.toString();
        // Remove references to editors which need to be updated.
        this.#activeJobLogEditors = this.#activeJobLogEditors.filter(
          e => e.document.uri.toString() !== docUri,
        );
        this.#decorateAllEditors();
      }
    });
    vscode.window.onDidChangeVisibleTextEditors(() => {
      this.#decorateAllEditors();
    });
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.#loadScrollStateForEditor(editor);
      }
    });
    vscode.window.onDidChangeTextEditorVisibleRanges(ev => {
      this.#loadScrollStateForEditor(ev.textEditor);
    });
    vscode.workspace.onDidCloseTextDocument(d => {
      if (d.uri.scheme === JOB_LOG_URI_SCHEME) {
        const { job: id } = fromJobLogUri(d.uri);
        doNotAwait(jobLogCache.delete(id));
      }
    });
    vscode.window.onDidChangeTextEditorSelection(ev => {
      const { textEditor } = ev;

      if (textEditor.document.uri.scheme !== JOB_LOG_URI_SCHEME) return;
      const isEmpty = ev.selections.length === 1 && ev.selections[0].isEmpty;

      if (
        this.#editorsWithCursorAtBottom.has(textEditor) &&
        ev.kind !== vscode.TextEditorSelectionChangeKind.Keyboard &&
        ev.kind !== vscode.TextEditorSelectionChangeKind.Mouse &&
        !isEmpty
      ) {
        const { active } = textEditor.selection;
        textEditor.selection = new vscode.Selection(active, active);
        this.#editorsWithCursorAtBottom.delete(textEditor);
        return;
      }

      if (!isEmpty || textEditor.selection.anchor.line !== textEditor.document.lineCount - 1) {
        this.#editorsWithCursorAtBottom.delete(textEditor);
      } else {
        this.#editorsWithCursorAtBottom.add(textEditor);
      }
    });
    jobLogCache.onDidJobChange(jobId => {
      this.#activeJobLogEditors.forEach(editor => {
        const { job: editorJobId } = fromJobLogUri(editor.document.uri);
        if (editorJobId === jobId) {
          this.#onDidChangeEmitter.fire(editor.document.uri);
          // Refresh the decorations one last time if the Job goes from Running to Stopped
          if (jobLogCache.get(jobId)?.eTag === null) {
            doNotAwait(this.#decorateJobTextEditor(editor));
          }
        }
      });
    });
  }

  #loadScrollStateForEditor(editor: vscode.TextEditor) {
    if (editor.document.uri.scheme === JOB_LOG_URI_SCHEME) {
      const { lineCount } = editor.document;
      const bottomRange = new vscode.Position(lineCount - 1, 0);
      const newValue = !editor.visibleRanges.find(r => r.contains(bottomRange));
      if (editor === vscode.window.activeTextEditor) {
        doNotAwait(
          vscode.commands.executeCommand('setContext', 'gitlab.canScrollToBottom', newValue),
        );
      }

      if (!newValue) {
        this.#autoscrollingEditors.add(editor);
      } else if (!this.#suppressScrollToggle) {
        this.#autoscrollingEditors.delete(editor);
      }
    }
  }

  #decorateAllEditors() {
    const newActiveJobLogEditors = vscode.window.visibleTextEditors.filter(
      e => e.document.uri.scheme === JOB_LOG_URI_SCHEME,
    );

    const staleJobLogEditors = this.#activeJobLogEditors.filter(
      e => newActiveJobLogEditors.indexOf(e) === -1,
    );

    const undecoratedJobLogEditors = newActiveJobLogEditors.filter(
      e => this.#activeJobLogEditors.indexOf(e) === -1,
    );
    this.#activeJobLogEditors = newActiveJobLogEditors;

    staleJobLogEditors.forEach(e => {
      jobLogCache.stopRefreshing(fromJobLogUri(e.document.uri).job);

      const idx = this.#activeJobLogEditors.indexOf(e);
      if (idx !== -1) this.#activeJobLogEditors.splice(idx, 1);
      this.#autoscrollingEditors.delete(e);
      this.#editorsWithCursorAtBottom.delete(e);
    });
    undecoratedJobLogEditors.forEach(e => {
      doNotAwait(this.#decorateJobTextEditor(e));
      jobLogCache.startRefreshing(fromJobLogUri(e.document.uri).job);
    });
  }

  async #decorateJobTextEditor(editor: vscode.TextEditor) {
    const { document } = editor;

    const decorations = await this.#decorationProvider.provideDecorations(document);
    if (decorations === null || decorations === undefined) return;

    const { job: id } = fromJobLogUri(document.uri);
    const cacheItem = jobLogCache.get(id);

    const decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

    decorations.forEach((options, key) => {
      let decorationType: vscode.ProviderResult<vscode.TextEditorDecorationType> =
        decorationTypes.get(key);

      if (!decorationType) {
        try {
          decorationType = this.#decorationProvider.resolveDecoration(key);
        } catch (error) {
          console.error(`error providing decorations for key ${key}`, error);
          return;
        }

        if (!decorationType) {
          console.error(`no decoration resolved for key ${key}`);
          return;
        }

        decorationTypes.set(key, decorationType);
      }

      editor.setDecorations(decorationType, options);
    });

    // Scroll editors for running jobs to the bottom if it was just opened, or new lines are available.
    if (
      this.#autoscrollingEditors.has(editor) ||
      (cacheItem?.eTag && this.#newRunningJobIds.has(id))
    ) {
      editor.revealRange(
        new vscode.Range(document.lineCount, 0, document.lineCount, 0),
        vscode.TextEditorRevealType.Default,
      );
    }
    this.#newRunningJobIds.delete(id);
    this.#suppressScrollToggle = false;
  }

  dispose() {
    this.#activeJobLogEditors = [];
    this.#newRunningJobIds.clear();
    this.#decorationProvider.dispose();
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string | undefined> {
    const { repositoryRoot, job: id } = fromJobLogUri(uri);

    if (!jobLogCache.get(id)) {
      const projectInRepository = gitlabProjectRepository.getProjectOrFail(repositoryRoot);
      const gitlabService = getGitLabService(projectInRepository);

      const response = await gitlabService.getJobTrace(projectInRepository.project, id);
      assert(response);
      const { rawTrace, eTag } = response;

      const branchState = await currentBranchRefresher.getOrRetrieveState();
      let isRunning: boolean;

      if (branchState.type !== 'invalid') {
        const jobItem = branchState.jobs.find(j => j.id === id);
        isRunning = jobItem?.status === 'running';
      } else {
        isRunning = false;
      }
      if (isRunning) {
        jobLogCache.setForRunning(repositoryRoot, id, rawTrace, eTag);
      } else {
        jobLogCache.set(id, rawTrace);
      }
    } else {
      jobLogCache.touch(id);
    }

    const cacheItem = jobLogCache.get(id);
    assert(cacheItem);

    this.#suppressScrollToggle = true;

    if (!cacheItem.filtered) {
      const { rawTrace, eTag } = cacheItem;
      const { sections, decorations, filtered } =
        await this.#decorationProvider.provideDecorationsForPrettifiedAnsi(rawTrace, eTag !== null);

      jobLogCache.addDecorations(id, sections, decorations, filtered);
      return filtered;
    }

    return cacheItem.filtered;
  }
}
