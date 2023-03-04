import * as vscode from 'vscode';
import {
  commentRangeFromPosition,
  commitFromPosition,
  pathFromPosition,
} from './gql_position_parser';
import { noteOnDiff } from '../../test/integration/fixtures/graphql/discussions.js';
import { GqlTextPosition } from '../gitlab/graphql/shared';

const { position } = noteOnDiff;

const oldPosition = {
  ...position,
  oldLine: 5,
  newLine: null,
  oldPath: 'oldPath.js',
  diffRefs: {
    ...position.diffRefs,
    baseSha: 'abcd',
  },
} as GqlTextPosition;

const newPosition = {
  ...position,
  oldLine: null,
  newLine: 20,
  newPath: 'newPath.js',
  diffRefs: {
    ...position.diffRefs,
    headSha: '1234',
  },
} as GqlTextPosition;

describe('pathFromPosition', () => {
  it('returns old path for old position', () => {
    expect(pathFromPosition(oldPosition)).toBe('oldPath.js');
  });
  it('returns new path for new position', () => {
    expect(pathFromPosition(newPosition)).toBe('newPath.js');
  });
});

describe('commitFromPosition', () => {
  it('returns baseSha for old position', () => {
    expect(commitFromPosition(oldPosition)).toBe('abcd');
  });
  it('returns headSha for new position', () => {
    expect(commitFromPosition(newPosition)).toBe('1234');
  });
});

describe('commentRangeFromPosition', () => {
  it('returns range with old line', () => {
    const line = new vscode.Position(4, 0);
    expect(commentRangeFromPosition(oldPosition)).toEqual(new vscode.Range(line, line));
  });
  it('returns headSha for new position', () => {
    const line = new vscode.Position(19, 0);
    expect(commentRangeFromPosition(newPosition)).toEqual(new vscode.Range(line, line));
  });
});
