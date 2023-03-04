import * as vscode from 'vscode';
import { pipeline, mr, issue, job, project } from './test_utils/entities';
import { USER_COMMANDS } from './command_names';
import { asMock } from './test_utils/as_mock';
import { BranchState } from './current_branch_refresher';
import { ProjectInRepository } from './gitlab/new_project';

jest.mock('./git/git_extension_wrapper');
jest.mock('./extension_state');

asMock(vscode.workspace.getConfiguration).mockReturnValue({
  showStatusBarLinks: true,
  showIssueLinkOnStatusBar: true,
  showMrStatusOnStatusBar: true,
});

// StatusBar needs to be imported after we mock the configuration because it uses the configuration
// during module initialization
// eslint-disable-next-line import/first
import { StatusBar } from './status_bar';

const createFakeItem = (): vscode.StatusBarItem =>
  ({
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  } as unknown as vscode.StatusBarItem);

const createBranchInfo = (partialInfo: Partial<BranchState> = {}): BranchState => ({
  type: 'branch',
  projectInRepository: { project, pointer: { repository: {} } } as unknown as ProjectInRepository,
  issues: [],
  jobs: [],
  userInitiated: true,
  ...partialInfo,
});

describe('status_bar', () => {
  let fakeItems: vscode.StatusBarItem[];
  let statusBar: StatusBar;
  const getPipelineItem = () => fakeItems[0];
  const getMrItem = () => fakeItems[1];
  const getClosingIssueItem = () => fakeItems[2];

  beforeEach(() => {
    fakeItems = [];
    asMock(vscode.window.createStatusBarItem).mockImplementation(() => {
      const fakeItem = createFakeItem();
      fakeItems.push(fakeItem);
      return fakeItem;
    });
    statusBar = new StatusBar();
    statusBar.init();
  });

  afterEach(() => {
    statusBar.dispose();
  });

  it('hides all items when the state is not valid', async () => {
    await statusBar.refresh({ type: 'invalid' });
    expect(getPipelineItem().hide).toHaveBeenCalled();
    expect(getMrItem().hide).toHaveBeenCalled();
    expect(getClosingIssueItem().hide).toHaveBeenCalled();
  });

  describe('pipeline item', () => {
    it('initializes the pipeline item with success', async () => {
      await statusBar.refresh(createBranchInfo({ pipeline }));
      expect(getPipelineItem().show).toHaveBeenCalled();
      expect(getPipelineItem().hide).not.toHaveBeenCalled();
      expect(getPipelineItem().text).toBe('$(check) GitLab: Pipeline passed');
    });

    it('prints jobs for running pipeline', async () => {
      const jobs = [
        {
          ...job,
          status: 'running',
          name: 'Unit Tests',
        },
        {
          ...job,
          status: 'running',
          name: 'Integration Tests',
        },
        {
          ...job,
          status: 'success',
          name: 'Lint',
        },
      ] as RestJob[];
      await statusBar.refresh(
        createBranchInfo({ pipeline: { ...pipeline, status: 'running' }, jobs }),
      );
      expect(getPipelineItem().text).toBe(
        '$(pulse) GitLab: Pipeline running (Unit Tests, Integration Tests)',
      );
    });

    it('sorts by created time (starts with newer) and deduplicates jobs for running pipeline', async () => {
      const jobs = [
        {
          ...job,
          status: 'running',
          name: 'Integration Tests',
          created_at: '2021-07-19T12:00:00.000Z',
        },
        {
          ...job,
          status: 'running',
          name: 'Unit Tests',
          created_at: '2021-07-19T10:00:00.000Z',
        },
        {
          ...job,
          status: 'running',
          name: 'Unit Tests',
          created_at: '2021-07-19T11:00:00.000Z',
        },
      ] as RestJob[];
      await statusBar.refresh(
        createBranchInfo({ pipeline: { ...pipeline, status: 'running' }, jobs }),
      );
      expect(getPipelineItem().text).toBe(
        '$(pulse) GitLab: Pipeline running (Unit Tests, Integration Tests)',
      );
    });

    it('shows no pipeline text when there is no pipeline', async () => {
      await statusBar.refresh(createBranchInfo());
      expect(getPipelineItem().text).toBe('GitLab: No pipeline.');
    });

    it.each`
      status        | itemText
      ${'running'}  | ${'$(pulse) GitLab: Pipeline running'}
      ${'success'}  | ${'$(check) GitLab: Pipeline passed'}
      ${'pending'}  | ${'$(clock) GitLab: Pipeline pending'}
      ${'failed'}   | ${'$(x) GitLab: Pipeline failed'}
      ${'canceled'} | ${'$(circle-slash) GitLab: Pipeline canceled'}
      ${'skipped'}  | ${'$(diff-renamed) GitLab: Pipeline skipped'}
    `('shows $itemText for pipeline with status $status', async ({ status, itemText }) => {
      await statusBar.refresh(createBranchInfo({ pipeline: { ...pipeline, status } }));
      expect(getPipelineItem().text).toBe(itemText);
    });
  });

  describe('MR item', () => {
    it('shows MR item', async () => {
      await statusBar.refresh(createBranchInfo({ mr }));
      expect(getMrItem().show).toHaveBeenCalled();
      expect(getMrItem().hide).not.toHaveBeenCalled();
      expect(getMrItem().text).toBe('$(git-pull-request) GitLab: MR !2000');
      const command = getMrItem().command as vscode.Command;
      expect(command.command).toBe('gl.showRichContent');
      expect(command.arguments?.[0]).toEqual(mr);
    });

    it('shows create MR text when there is no MR', async () => {
      await statusBar.refresh(createBranchInfo());
      expect(getMrItem().text).toBe('$(git-pull-request) GitLab: Create MR.');
      expect(getMrItem().command).toBe(USER_COMMANDS.OPEN_CREATE_NEW_MR);
    });
  });

  describe('MR closing issue item', () => {
    it('shows closing issue for an MR', async () => {
      await statusBar.refresh(createBranchInfo({ mr, issues: [issue] }));
      expect(getClosingIssueItem().show).toHaveBeenCalled();
      expect(getClosingIssueItem().hide).not.toHaveBeenCalled();
      expect(getClosingIssueItem().text).toBe('$(code) GitLab: Issue #1000');
      const command = getClosingIssueItem().command as vscode.Command;
      expect(command.command).toBe('gl.showRichContent');
      expect(command.arguments?.[0]).toEqual(issue);
    });

    it('shows no issue when there is not a closing issue', async () => {
      await statusBar.refresh(createBranchInfo({ mr, issues: [] }));
      expect(getClosingIssueItem().text).toBe('$(code) GitLab: No issue.');
      expect(getClosingIssueItem().command).toBe(undefined);
    });

    it('hides the item when there is is no MR', async () => {
      await statusBar.refresh(createBranchInfo());
      expect(getClosingIssueItem().hide).toHaveBeenCalled();
    });
  });
});
