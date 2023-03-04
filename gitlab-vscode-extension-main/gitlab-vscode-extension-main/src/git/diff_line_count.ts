import assert from 'assert';
import { DiffFilePath, findFileInDiffs } from '../utils/find_file_in_diffs';

// these helper functions are simplified version of the same lodash functions
const range = (start: number, end: number) => [...Array(end - start).keys()].map(n => n + start);
const flatten = <T>(a: T[][]): T[] => a.reduce((acc, nested) => [...acc, ...nested], []);
const last = <T>(a: T[]): T | undefined => a[a.length - 1];
const first = <T>(a: T[]): T | undefined => a[0];
// copied from https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore#_isempty
const isEmpty = (obj: any): boolean =>
  [Object, Array].includes((obj || {}).constructor) && !Object.entries(obj || {}).length;

/**
 * This method returns line number where in the text document given hunk starts.
 * Each hunk header contains information about where the hunk starts for old and new version.
 * `@@ -38,9 +36,8 @@` reads: hunk starts at line 38 of the old version and 36 of the new version.
 */
const getHunkStartingLine = (headerString = ''): { oldStart: number; newStart: number } | null => {
  const headerMatch = headerString.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  return (
    headerMatch && {
      oldStart: parseInt(headerMatch[1], 10),
      newStart: parseInt(headerMatch[2], 10),
    }
  );
};

const getRawHunks = (diff: string): string[] =>
  diff
    .replace(/^@@/, '') // remove first @@ because we'll remove all the other @@ by splitting
    .split('\n@@')
    .map(h => `@@${h}`); // prepend the removed @@ to all hunks
const REMOVED = 'REMOVED';
const ADDED = 'ADDED';
const UNCHANGED = 'UNCHANGED';

type RemovedLine = { type: typeof REMOVED; oldLine: number; newLine?: never };
type AddedLine = { type: typeof ADDED; newLine: number; oldLine?: never };
export type UnchangedLine = { type: typeof UNCHANGED; oldLine: number; newLine: number };
type HunkLine = RemovedLine | AddedLine | UnchangedLine;

/** Converts lines in the text hunk into data structures that represent type of the change and affected lines */
const parseHunk = (hunk: string): HunkLine[] => {
  const [headerLine, ...remainingLines] = hunk.split('\n');
  const header = getHunkStartingLine(headerLine);
  assert(header);
  const result = remainingLines
    .filter(l => l) // no empty lines
    .filter(l => !l.startsWith('\\')) // ignore '\ No newline at end of file'
    .reduce(
      ({ oldIndex, newIndex, lines }, line) => {
        const prefix = line[0];
        switch (prefix) {
          case '-':
            return {
              oldIndex: oldIndex + 1,
              newIndex,
              lines: [...lines, { type: REMOVED, oldLine: oldIndex } as const],
            };
          case '+':
            return {
              oldIndex,
              newIndex: newIndex + 1,
              lines: [...lines, { type: ADDED, newLine: newIndex } as const],
            };
          case ' ':
            return {
              oldIndex: oldIndex + 1,
              newIndex: newIndex + 1,
              lines: [...lines, { type: UNCHANGED, oldLine: oldIndex, newLine: newIndex } as const],
            };
          default:
            throw new Error(`Unexpected line prefix in a hunk. Hunk: ${hunk}, prefix ${prefix}`);
        }
      },
      {
        oldIndex: header.oldStart,
        newIndex: header.newStart,
        lines: [] as HunkLine[],
      },
    );
  return result.lines;
};

const getHunksForFile = (mrVersion: RestMrVersion, path: DiffFilePath): HunkLine[][] => {
  const diff = findFileInDiffs(mrVersion.diffs, path);
  if (!diff) return [];
  return getRawHunks(diff.diff).map(parseHunk);
};

export const getAddedLinesForFile = (mrVersion: RestMrVersion, newPath: string): number[] => {
  const hunkLines = flatten(getHunksForFile(mrVersion, { newPath }));
  return hunkLines.filter((hl): hl is AddedLine => hl.type === ADDED).map(hl => hl.newLine);
};

const newLineOffset = (line: UnchangedLine) => line.newLine - line.oldLine;

const createUnchangedLinesBetweenHunks = (
  previousHunkLast: HunkLine,
  nextHunkFirst: HunkLine,
): HunkLine[] => {
  assert(previousHunkLast.type === UNCHANGED && nextHunkFirst.type === UNCHANGED);
  assert(newLineOffset(previousHunkLast) === newLineOffset(nextHunkFirst));
  return range(previousHunkLast.oldLine + 1, nextHunkFirst.oldLine).map(oldLine => ({
    type: UNCHANGED,
    oldLine,
    newLine: oldLine + newLineOffset(previousHunkLast),
  }));
};

const connectHunks = (parsedHunks: HunkLine[][]): HunkLine[] =>
  parsedHunks.length === 0
    ? []
    : parsedHunks.reduce((acc, hunk) => [
        ...acc,
        ...createUnchangedLinesBetweenHunks(last(acc)!, first(hunk)!),
        ...hunk,
      ]);

const addUnchangedLinesToBeginning = (lines: HunkLine[]): HunkLine[] => {
  if (isEmpty(lines) || first(lines)!.oldLine === 1) return lines;
  return connectHunks([[{ type: UNCHANGED, oldLine: 1, newLine: 1 }], lines]);
};

const ensureOldLineIsPresent = (lines: HunkLine[], oldLine: number): HunkLine[] => {
  const lastLine = last(lines);
  if (!lastLine?.oldLine || lastLine.oldLine >= oldLine) return lines;
  assert(lastLine.type === UNCHANGED);
  return connectHunks([
    lines,
    [{ type: UNCHANGED, oldLine, newLine: oldLine + newLineOffset(lastLine) }],
  ]);
};

export const getNewLineForOldUnchangedLine = (
  mrVersion: RestMrVersion,
  oldPath: string,
  oldLine: number,
): number | undefined => {
  const connectedHunks = connectHunks(getHunksForFile(mrVersion, { oldPath }));
  const linesFromBeginning = addUnchangedLinesToBeginning(connectedHunks);
  const allDiffLines = ensureOldLineIsPresent(linesFromBeginning, oldLine);
  return allDiffLines.find(l => l.oldLine === oldLine)?.newLine;
};
