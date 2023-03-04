import * as vscode from 'vscode';
import { VS_COMMANDS } from '../command_names';
import { asMock } from '../test_utils/as_mock';
import { job, artifact, projectInRepository } from '../test_utils/entities';
import { JobItemModel } from '../tree_view/items/job_item_model';
import { StageItemModel } from '../tree_view/items/stage_item_model';
import { downloadArtifacts } from './download_artifact';

describe('downloadArtifacts', () => {
  const traceJob: RestJob = { ...job, artifacts: [{ ...artifact, file_type: 'trace' }] };
  const archiveJob: RestJob = {
    ...job,
    name: 'test 3',
    artifacts: [{ ...artifact, file_type: 'archive' }],
  };
  const junitJob: RestJob = { ...job, name: 'test 2', artifacts: [artifact] };
  const multipleJob: RestJob = {
    ...job,
    name: 'test 1',
    artifacts: [{ ...artifact, file_type: 'cobertura' }, artifact],
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('rejects jobs without artifacts', async () => {
    await downloadArtifacts(new JobItemModel(projectInRepository, traceJob));
    expect(vscode.window.showQuickPick).not.toBeCalled();
    expect(vscode.commands.executeCommand).not.toBeCalled();
    expect(vscode.window.showWarningMessage).toBeCalled();
  });

  it('displays the artifacts in a picker', async () => {
    await downloadArtifacts(new JobItemModel(projectInRepository, multipleJob));
    expect(vscode.window.showQuickPick).toBeCalled();
    const items = asMock(vscode.window.showQuickPick).mock.lastCall[0];
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe('$(file) cobertura');
    expect(items[1].label).toBe('$(file) junit');
  });

  it('displays the job name when multiple jobs are given', async () => {
    await downloadArtifacts(
      new StageItemModel(projectInRepository, 'test', [archiveJob, multipleJob]),
    );
    expect(vscode.window.showQuickPick).toBeCalled();
    const items = asMock(vscode.window.showQuickPick).mock.lastCall[0];
    expect(items).toHaveLength(3);
    expect(items[0].label).toBe('$(file-zip) test 3:archive');
    expect(items[1].label).toBe('$(file) test 1:cobertura');
    expect(items[2].label).toBe('$(file) test 1:junit');
  });

  it('allows cancelling the picker', async () => {
    asMock(vscode.window.showQuickPick).mockResolvedValue(undefined);
    await downloadArtifacts(
      new StageItemModel(projectInRepository, 'test', [junitJob, multipleJob]),
    );
    expect(vscode.window.showQuickPick).toBeCalled();
    expect(vscode.commands.executeCommand).not.toBeCalled();
  });

  it('downloads the selected artifact', async () => {
    asMock(vscode.window.showQuickPick).mockImplementation(options => options[1]);
    await downloadArtifacts(
      new StageItemModel(projectInRepository, 'test', [junitJob, multipleJob]),
    );
    expect(vscode.window.showQuickPick).toBeCalled();

    const uri = `${multipleJob.web_url}/artifacts/download?file_type=cobertura`;
    expect(vscode.commands.executeCommand).toBeCalledWith(VS_COMMANDS.OPEN, vscode.Uri.parse(uri));
  });

  it('downloads immediately when only an archive is available', async () => {
    await downloadArtifacts(new JobItemModel(projectInRepository, archiveJob));
    expect(vscode.window.showQuickPick).not.toBeCalled();
    const uri = `${archiveJob.web_url}/artifacts/download?file_type=archive`;
    expect(vscode.commands.executeCommand).toBeCalledWith(VS_COMMANDS.OPEN, vscode.Uri.parse(uri));
  });
});
