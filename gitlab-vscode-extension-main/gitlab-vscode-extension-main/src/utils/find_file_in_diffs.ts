import { removeLeadingSlash } from './remove_leading_slash';

export type DiffFilePath = { oldPath?: string; newPath?: string };

export const findFileInDiffs = (
  diffs: RestDiffFile[],
  path: DiffFilePath,
): RestDiffFile | undefined =>
  diffs.find(
    d =>
      d.new_path === removeLeadingSlash(path.newPath) ||
      d.old_path === removeLeadingSlash(path.oldPath),
  );
