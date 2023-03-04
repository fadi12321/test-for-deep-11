import * as vscode from 'vscode';
import { jobLogCache } from './job_log_cache';
import { fromJobLogUri } from './job_log_uri';

export class JobLogFoldingProvider implements vscode.FoldingRangeProvider {
  // eslint-disable-next-line class-methods-use-this
  provideFoldingRanges(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    const { job: id } = fromJobLogUri(document.uri);
    const item = jobLogCache.get(id);

    if (!item?.sections) return undefined;

    const regions = [...item.sections.values()].filter(s => s.endLine);

    return regions.map(
      r => new vscode.FoldingRange(r.startLine, r.endLine ?? 0, vscode.FoldingRangeKind.Region),
    );
  }
}
