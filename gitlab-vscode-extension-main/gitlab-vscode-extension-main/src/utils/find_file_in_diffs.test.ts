import { diffFile } from '../test_utils/entities';
import { findFileInDiffs } from './find_file_in_diffs';

describe('findFileInDiffs', () => {
  const diff: RestDiffFile = {
    ...diffFile,
    old_path: 'test/oldName.js',
    new_path: 'test/newName.js',
  };

  it.each`
    oldPath               | newPath
    ${'/test/oldName.js'} | ${undefined}
    ${'test/oldName.js'}  | ${undefined}
    ${undefined}          | ${'/test/newName.js'}
    ${undefined}          | ${'/test/newName.js'}
  `('finds a file with oldPath: $oldPath and newPath: $newPath', ({ oldPath, newPath }) => {
    expect(findFileInDiffs([diff], { oldPath, newPath })).toEqual(diff);
  });

  it('returns undefined when it does not find a file', () => {
    expect(findFileInDiffs([diff], { oldPath: '/nonexistent' })).toEqual(undefined);
  });
});
