const { Uri } = require('../test_utils/uri');
const { EventEmitter } = require('../test_utils/event_emitter');
const { FileType } = require('../test_utils/file_type');
const { FileSystemError } = require('../test_utils/file_system_error');

module.exports = {
  TreeItem: function TreeItem(labelOrUri, collapsibleState) {
    this.collapsibleState = collapsibleState;
    if (typeof labelOrUri === 'string') {
      this.label = labelOrUri;
    } else {
      this.resourceUri = labelOrUri;
    }
  },
  ThemeIcon: function ThemeIcon(id) {
    return { id };
  },
  EventEmitter,
  TreeItemCollapsibleState: {
    Collapsed: 'collapsed',
  },
  MarkdownString: function MarkdownString(value, supportThemeIcons) {
    this.value = value;
    this.supportThemeIcons = supportThemeIcons;
  },
  Uri,
  comments: {
    createCommentController: jest.fn(),
  },
  window: {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createStatusBarItem: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    showSaveDialog: jest.fn(),
    withProgress: jest.fn().mockImplementation((opt, callback) => callback()),
    createQuickPick: jest.fn(),
    onDidChangeTextEditorSelection: jest.fn(),
    onDidChangeVisibleTextEditors: jest.fn(),
    onDidChangeTextEditorVisibleRanges: jest.fn(),
    onDidChangeActiveTextEditor: jest.fn(),
    createWebviewPanel: jest.fn(),
    showTextDocument: jest.fn(),
  },
  commands: {
    executeCommand: jest.fn(),
    registerCommand: jest.fn(),
  },
  workspace: {
    openTextDocument: jest.fn(),
    getConfiguration: jest.fn().mockReturnValue({}),
    onDidOpenTextDocument: jest.fn(),
    onDidChangeTextDocument: jest.fn(),
    onDidCloseTextDocument: jest.fn(),
    createFileSystemWatcher: jest.fn(),
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
    },
  },
  extensions: {
    getExtension: jest.fn(),
  },
  env: {
    uriScheme: 'vscode',
  },
  CommentMode: { Editing: 0, Preview: 1 },
  StatusBarAlignment: { Left: 0 },
  CommentThreadCollapsibleState: { Collapsed: 0, Expanded: 1 },
  Position: function Position(line, character) {
    return { line, character };
  },
  Range: function Range(...args) {
    if (typeof args[0] === 'number') {
      return {
        start: { line: args[0], character: args[1] },
        end: { line: args[2], character: args[3] },
      };
    }
    return { start: args[0], end: args[1] };
  },
  CancellationTokenSource: function CancellationTokenSource() {
    return { token: { isCancellationRequested: false } };
  },
  ThemeColor: jest.fn(color => color),
  ProgressLocation: {
    Notification: 'Notification',
  },
  FoldingRange: function FoldingRange(start, end, kind) {
    return { start, end, kind };
  },
  FoldingRangeKind: {
    Region: 3,
  },
  FileType,
  FileSystemError,
  ViewColumn: {
    Active: -1,
  },
};
