import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import assert from 'assert';
import { handleError, log } from './log';
import { isMr } from './utils/is_mr';
import { makeHtmlLinksAbsolute } from './utils/make_html_links_absolute';
import { GitLabService } from './gitlab/gitlab_service';
import { gitlabProjectRepository } from './gitlab/gitlab_project_repository';
import { ProjectInRepository } from './gitlab/new_project';
import { getGitLabService } from './gitlab/get_gitlab_service';
import { generateSecret } from './utils/generate_secret';

const webviewResourcePaths = {
  appScriptUri: 'src/webview/dist/js/app.js',
  vendorUri: 'src/webview/dist/js/chunk-vendors.js',
  styleUri: 'src/webview/dist/css/app.css',
  devScriptUri: 'src/webview/dist/app.js',
} as const;

type WebviewResources = Record<keyof typeof webviewResourcePaths, vscode.Uri>;

async function initPanelIfActive(
  panel: vscode.WebviewPanel,
  issuable: RestIssuable,
  gitlabService: GitLabService,
) {
  if (!panel.active) return;

  const appReadyPromise = new Promise<void>(resolve => {
    const sub = panel.webview.onDidReceiveMessage(async message => {
      if (message.command === 'appReady') {
        sub.dispose();
        resolve();
      }
    });
  });

  const discussionsAndLabels = await gitlabService
    .getDiscussionsAndLabelEvents(issuable)
    .catch(e => {
      handleError(e);
      return [];
    });
  await appReadyPromise;
  await panel.webview.postMessage({
    type: 'issuableFetch',
    issuable,
    discussions: discussionsAndLabels,
  });
}

class WebviewController {
  context?: vscode.ExtensionContext;

  isDev = false;

  openedPanels: Record<string, vscode.WebviewPanel | undefined> = {};

  init(context: vscode.ExtensionContext, isDev: boolean) {
    this.context = context;
    this.isDev = isDev;
  }

  private getResources(panel: vscode.WebviewPanel): WebviewResources {
    return Object.entries(webviewResourcePaths).reduce((acc, [key, value]) => {
      assert(this.context);
      const uri = vscode.Uri.file(path.join(this.context.extensionPath, value));
      return { ...acc, [key]: panel.webview.asWebviewUri(uri) };
    }, {}) as WebviewResources;
  }

  private getIndexPath() {
    return this.isDev ? 'src/webview/public/dev.html' : 'src/webview/public/index.html';
  }

  private replaceResources(panel: vscode.WebviewPanel) {
    assert(this.context);
    const { appScriptUri, vendorUri, styleUri, devScriptUri } = this.getResources(panel);
    const nonce = generateSecret();

    return fs
      .readFileSync(path.join(this.context.extensionPath, this.getIndexPath()), 'UTF-8')
      .replace(/{{nonce}}/gm, nonce)
      .replace('{{styleUri}}', styleUri.toString())
      .replace('{{vendorUri}}', vendorUri.toString())
      .replace('{{appScriptUri}}', appScriptUri.toString())
      .replace('{{devScriptUri}}', devScriptUri.toString());
  }

  private createPanel(issuable: RestIssuable) {
    assert(this.context);
    const title = `${issuable.title.slice(0, 20)}...`;

    return vscode.window.createWebviewPanel('glWorkflow', title, vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'src'))],
      retainContextWhenHidden: true,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private createMessageHandler =
    (
      panel: vscode.WebviewPanel,
      issuable: RestIssuable,
      projectInRepository: ProjectInRepository,
    ) =>
    async (message: any) => {
      if (message.command === 'renderMarkdown') {
        let rendered = await getGitLabService(projectInRepository).renderMarkdown(
          message.markdown,
          projectInRepository.project,
        );
        rendered = makeHtmlLinksAbsolute(rendered || '', projectInRepository.account.instanceUrl);

        await panel.webview.postMessage({
          type: 'markdownRendered',
          ref: message.ref,
          object: message.object,
          markdown: rendered,
        });
      }

      if (message.command === 'saveNote') {
        try {
          const gitlabService = getGitLabService(projectInRepository);
          await gitlabService.createNote(issuable, message.note, message.replyId);
          const discussionsAndLabels = await gitlabService.getDiscussionsAndLabelEvents(issuable);
          await panel.webview.postMessage({
            type: 'issuableFetch',
            issuable,
            discussions: discussionsAndLabels,
          });
          await panel.webview.postMessage({ type: 'noteSaved' });
        } catch (e) {
          log.error('Failed to submit note to the API.', e);
          await panel.webview.postMessage({ type: 'noteSaved', status: false });
        }
      }
    };

  private getIconPathForIssuable(issuable: RestIssuable) {
    const getIconUri = (shade: string, file: string) =>
      vscode.Uri.file(
        path.join(this.context!.extensionPath, 'src', 'assets', 'images', shade, file),
      );
    const lightIssueIcon = getIconUri('light', 'issues.svg');
    const lightMrIcon = getIconUri('light', 'merge_requests.svg');
    const darkIssueIcon = getIconUri('dark', 'issues.svg');
    const darkMrIcon = getIconUri('dark', 'merge_requests.svg');
    return isMr(issuable)
      ? { light: lightMrIcon, dark: darkMrIcon }
      : { light: lightIssueIcon, dark: darkIssueIcon };
  }

  async open(issuable: RestIssuable, repositoryRoot: string) {
    const projectInRepository = gitlabProjectRepository.getProjectOrFail(repositoryRoot);

    const panelKey = `${repositoryRoot}-${issuable.id}`;
    const openedPanel = this.openedPanels[panelKey];
    if (openedPanel) {
      openedPanel.reveal();
      return openedPanel;
    }
    const newPanel = await this.create(issuable, projectInRepository);
    this.openedPanels[panelKey] = newPanel;
    newPanel.onDidDispose(() => {
      this.openedPanels[panelKey] = undefined;
    });
    return newPanel;
  }

  private async create(issuable: RestIssuable, projectInRepository: ProjectInRepository) {
    assert(this.context);
    const panel = this.createPanel(issuable);
    const html = this.replaceResources(panel);
    panel.webview.html = html;
    panel.iconPath = this.getIconPathForIssuable(issuable);

    await initPanelIfActive(panel, issuable, getGitLabService(projectInRepository));
    panel.onDidChangeViewState(async () => {
      await initPanelIfActive(panel, issuable, getGitLabService(projectInRepository));
    });

    panel.webview.onDidReceiveMessage(
      this.createMessageHandler(panel, issuable, projectInRepository),
    );
    return panel;
  }
}

export const webviewController = new WebviewController();
