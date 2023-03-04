import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AnsiDecorationProvider } from './ansi_decoration_provider';
import { jobLogCache } from './job_log_cache';
import { JobLogFoldingProvider } from './job_log_folding_provider';
import { asMock } from '../test_utils/as_mock';

describe('JobLogFoldingProvider', () => {
  afterEach(() => {
    jest.resetAllMocks();
    jobLogCache.clearAll();
  });

  it('returns folding ranges', async () => {
    asMock(vscode.workspace.openTextDocument).mockResolvedValue({
      uri: { query: JSON.stringify({ job: 123 }) },
    });

    const rawTrace = await fs.readFile(
      path.join(__dirname, '..', 'test_utils', 'raw_trace.log'),
      'utf-8',
    );

    jobLogCache.set(123, rawTrace);
    const ansiProvider = new AnsiDecorationProvider();
    const { sections, decorations, filtered } =
      await ansiProvider.provideDecorationsForPrettifiedAnsi(rawTrace, false);

    jobLogCache.addDecorations(123, sections, decorations, filtered);

    const foldingProvider = new JobLogFoldingProvider();
    const document = await vscode.workspace.openTextDocument();
    const ranges = await foldingProvider.provideFoldingRanges(document);

    expect(ranges).toContainEqual({ start: 2, end: 5, kind: vscode.FoldingRangeKind.Region });
  });
});
