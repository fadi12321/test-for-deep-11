import * as vscode from 'vscode';
import { toJobLogUri } from '../ci/job_log_uri';
import { JobItemModel } from '../tree_view/items/job_item_model';

export async function openTraceArtifact(item: JobItemModel): Promise<void> {
  const { job, projectInRepository } = item;

  const uri = toJobLogUri(projectInRepository.pointer.repository.rootFsPath, job.id);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: true });
}
