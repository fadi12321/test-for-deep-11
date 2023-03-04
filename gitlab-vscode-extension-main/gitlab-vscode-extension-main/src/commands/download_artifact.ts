import * as vscode from 'vscode';
import { VS_COMMANDS } from '../command_names';
import { JobProvider } from '../tree_view/items/job_provider';
import { isArtifactDownloadable } from '../utils/is_artifact_downloadable';

const first = <T>(a: readonly T[]): T | undefined => a[0];

interface ArtifactPickItem extends vscode.QuickPickItem {
  job: RestJob;
  artifact: RestArtifact;
}

export async function downloadArtifacts(item: JobProvider): Promise<void> {
  let result: ArtifactPickItem | undefined;

  const { jobs } = item;
  const singleJob = jobs.length === 1 ? first(jobs) : null;
  const artifacts = jobs.flatMap(
    j => j.artifacts?.filter(isArtifactDownloadable).map(a => ({ artifact: a, job: j })) ?? [],
  );

  if (!artifacts.length) {
    await vscode.window.showWarningMessage(
      `This ${singleJob ? 'job' : 'pipeline'} does not have downloadable artifacts.`,
    );
    return;
  }

  const items: ArtifactPickItem[] = artifacts.map(a => ({
    label: `$(${a.artifact.file_type === 'archive' ? 'file-zip' : 'file'}) ${
      singleJob ? '' : `${a.job.name}:`
    }${a.artifact.file_type}`,
    description: a.artifact.filename,
    job: a.job,
    artifact: a.artifact,
  }));

  if (singleJob && items.length === 1 && items[0].artifact.file_type === 'archive') {
    result = first(items);
  } else {
    result = await vscode.window.showQuickPick(items, {
      title: 'Download Artifacts',
    });
  }

  if (!result) return;

  const uri = `${result.job.web_url}/artifacts/download?file_type=${result.artifact.file_type}`;
  await vscode.commands.executeCommand(VS_COMMANDS.OPEN, vscode.Uri.parse(uri));
}
