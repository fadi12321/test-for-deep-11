const assert = require('assert');
const vscode = require('vscode');
const sinon = require('sinon');
const EventEmitter = require('events');
const { graphql } = require('msw');
const { webviewController } = require('../../src/webview_controller');
const openIssueResponse = require('./fixtures/rest/open_issue.json');
const { projectWithIssueDiscussions, note2 } = require('./fixtures/graphql/discussions');

const { getServer, createJsonEndpoint } = require('./test_infrastructure/mock_server');
const { getRepositoryRoot } = require('./test_infrastructure/helpers');

const waitForMessage = (panel, type) =>
  new Promise(resolve => {
    const sub = panel.webview.onDidReceiveMessage(message => {
      if (message.type !== type) return;
      sub.dispose();
      resolve(message);
    });
  });

describe('GitLab webview', () => {
  let server;
  let webviewPanel;
  const sandbox = sinon.createSandbox();

  before(async () => {
    server = getServer([
      graphql.query('GetIssueDiscussions', (req, res, ctx) => {
        if (req.variables.namespaceWithPath === 'gitlab-org/gitlab')
          return res(ctx.data(projectWithIssueDiscussions));
        return res(ctx.data({ project: null }));
      }),
      graphql.mutation('CreateNote', (req, res, ctx) => {
        const { issuableId, body } = req.variables;
        if (issuableId === 'gid://gitlab/Issue/35284557' && body === 'Hello')
          return res(
            ctx.data({
              createNote: {
                errors: [],
                note: note2,
              },
            }),
          );
        return res(ctx.status(500));
      }),
      createJsonEndpoint(
        `/projects/${openIssueResponse.project_id}/issues/${openIssueResponse.iid}/resource_label_events`,
        [],
      ),
    ]);
  });

  /*
  This method replaces the mechanism that the Webview panel uses for sending messages between
  the extension and the webview. This is necessary since we can't control the webview and so
  we need to be able to simulate events triggered by the webview and see that the extension
  handles them well.
  */
  const replacePanelEventSystem = () => {
    const { createWebviewPanel } = vscode.window;
    sandbox.stub(vscode.window, 'createWebviewPanel').callsFake((viewType, title, column) => {
      const panel = createWebviewPanel(viewType, title, column);
      const eventEmitter = new EventEmitter();
      sandbox
        .stub(panel.webview, 'postMessage')
        .callsFake(message => eventEmitter.emit('', message));
      sandbox.stub(panel.webview, 'onDidReceiveMessage').callsFake(listener => {
        eventEmitter.on('', listener);
        return { dispose: () => {} };
      });
      // this simulates real behaviour where the webview initializes Vue app and that sends a `appReady` message
      setTimeout(() => {
        eventEmitter.emit('', { command: 'appReady' });
      }, 1);
      return panel;
    });
  };

  beforeEach(async () => {
    server.resetHandlers();
    replacePanelEventSystem();
    webviewPanel = await webviewController.open(openIssueResponse, getRepositoryRoot());
  });

  afterEach(async () => {
    sandbox.restore();
  });

  after(async () => {
    server.close();
  });

  it('sends a message', async () => {
    webviewPanel.webview.postMessage({
      command: 'saveNote',
      note: 'Hello',
    });
    const sentMessage = await waitForMessage(webviewPanel, 'noteSaved');
    assert.strictEqual(sentMessage.type, 'noteSaved');
    assert.strictEqual(sentMessage.status, undefined);
  });

  it('adds the correct panel icon', () => {
    const { dark, light } = webviewPanel.iconPath;
    assert.match(dark.path, /src\/assets\/images\/dark\/issues.svg$/);
    assert.match(light.path, /src\/assets\/images\/light\/issues.svg$/);
  });

  it('substitutes the resource URLs in the HTML markup', () => {
    const resources = [
      'src/webview/dist/js/app\\.js',
      'src/webview/dist/js/chunk-vendors\\.js',
      'src/webview/dist/css/app\\.css',
    ];
    resources.forEach(r => {
      assert.match(webviewPanel.webview.html, new RegExp(r, 'gm'));
    });
  });

  it('reveals existing panel instead of creating a new one', async () => {
    const revealSpy = sandbox.spy(webviewPanel, 'reveal');
    const samePanel = await webviewController.open(openIssueResponse, getRepositoryRoot());
    assert(revealSpy.called);
    assert.strictEqual(samePanel, webviewPanel);
  });

  it('creates a new panel if the previous one got disposed', async () => {
    webviewPanel.dispose();
    const newPanel = await webviewController.open(openIssueResponse, getRepositoryRoot());
    assert.notStrictEqual(newPanel, webviewPanel);
  });
});
