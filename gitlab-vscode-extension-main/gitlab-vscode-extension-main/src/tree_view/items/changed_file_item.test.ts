import { PROGRAMMATIC_COMMANDS } from '../../command_names';
import {
  ADDED,
  CHANGE_TYPE_QUERY_KEY,
  DELETED,
  HAS_COMMENTS_QUERY_KEY,
  MODIFIED,
  RENAMED,
} from '../../constants';
import { toReviewUri } from '../../review/review_uri';
import { diffFile, mr, mrVersion } from '../../test_utils/entities';
import { ChangedFileItem } from './changed_file_item';

describe('ChangedFileItem', () => {
  describe('image file', () => {
    it.each(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp', '.avif', '.apng'])(
      'should not show diff for %s',
      extension => {
        const changedImageFile = { ...diffFile, new_path: `file${extension}` };
        const item = new ChangedFileItem(mr, mrVersion, changedImageFile, '/repo', () => false);

        expect(item.command?.command).toBe(PROGRAMMATIC_COMMANDS.NO_IMAGE_REVIEW);
      },
    );

    it.each`
      file                                                                          | changeType
      ${{ ...diffFile, new_file: true, deleted_file: false, renamed_file: false }}  | ${ADDED}
      ${{ ...diffFile, new_file: false, deleted_file: true, renamed_file: false }}  | ${DELETED}
      ${{ ...diffFile, new_file: false, deleted_file: false, renamed_file: true }}  | ${RENAMED}
      ${{ ...diffFile, new_file: false, deleted_file: false, renamed_file: false }} | ${MODIFIED}
    `('indicates change type $changeType', ({ file, changeType }) => {
      const item = new ChangedFileItem(mr, mrVersion, file, '/repo', () => false);

      expect(item.resourceUri?.query).toContain(`${CHANGE_TYPE_QUERY_KEY}=${changeType}`);
    });
  });

  describe('captures whether there are comments on the changes', () => {
    let areThereChanges: boolean;

    const createItem = () =>
      new ChangedFileItem(mr, mrVersion, diffFile, '/repository/fsPath', () => areThereChanges);

    it('indicates there are comments', () => {
      areThereChanges = true;
      expect(createItem().resourceUri?.query).toMatch(`${HAS_COMMENTS_QUERY_KEY}=true`);
    });

    it('indicates there are no comments', () => {
      areThereChanges = false;
      expect(createItem().resourceUri?.query).toMatch(`${HAS_COMMENTS_QUERY_KEY}=false`);
    });
  });

  describe('intialization', () => {
    it('sets context and head and base URIs', () => {
      const item = new ChangedFileItem(mr, mrVersion, diffFile, '/repository/fsPath', () => false);
      expect(item.baseFileUri).toEqual(
        toReviewUri({
          path: diffFile.old_path,
          commit: mrVersion.base_commit_sha,
          repositoryRoot: '/repository/fsPath',
          projectId: mr.project_id,
          mrId: mr.id,
        }),
      );
      expect(item.headFileUri).toEqual(
        toReviewUri({
          path: diffFile.new_path,
          commit: mrVersion.head_commit_sha,
          repositoryRoot: '/repository/fsPath',
          projectId: mr.project_id,
          mrId: mr.id,
        }),
      );
      expect(item.contextValue).toBe('changed-file-item');
    });
  });
});
