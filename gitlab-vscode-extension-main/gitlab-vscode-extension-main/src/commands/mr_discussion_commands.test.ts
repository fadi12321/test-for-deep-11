import * as vscode from 'vscode';
import {
  discussionOnDiff,
  noteOnDiff,
} from '../../test/integration/fixtures/graphql/discussions.js';
import { GqlTextDiffNote } from '../gitlab/graphql/shared';
import { GitLabComment } from '../review/gitlab_comment';
import { GitLabCommentThread } from '../review/gitlab_comment_thread';
import { toReviewUri } from '../review/review_uri';
import {
  deleteComment,
  createComment,
  retryFailedComment,
  CommentWithThread,
} from './mr_discussion_commands';
import { mr, mrVersion, projectInRepository } from '../test_utils/entities';
import { FAILED_COMMENT_CONTEXT, SYNCED_COMMENT_CONTEXT } from '../constants';
import { mrCache } from '../gitlab/mr_cache';
import { asMock } from '../test_utils/as_mock';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';

jest.mock('../gitlab/mr_cache');
jest.mock('../gitlab/get_gitlab_service');
jest.mock('../gitlab/gitlab_project_repository');

describe('MR discussion commands', () => {
  describe('deleteComment', () => {
    let mockedComment: GitLabComment;

    beforeEach(() => {
      mockedComment = {
        thread: {
          deleteComment: jest.fn(),
        },
      } as unknown as GitLabComment;
    });

    afterEach(() => {
      (vscode.window.showWarningMessage as jest.Mock).mockReset();
    });

    it('calls deleteComment on the thread if the user confirms deletion', async () => {
      (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Delete'); // user clicked Delete

      await deleteComment(mockedComment);

      expect(mockedComment.thread.deleteComment).toHaveBeenCalledWith(mockedComment);
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Delete comment?',
        { modal: true },
        'Delete',
      );
    });

    it("doesn't call deleteComment on the thread if the user cancels deletion", async () => {
      (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined); // user clicked cancel

      await deleteComment(mockedComment);

      expect(mockedComment.thread.deleteComment).not.toHaveBeenCalled();
    });
  });

  describe('create comment', () => {
    describe('responding in a thread', () => {
      it('responds if the thread already contains comments', async () => {
        const mockedGitLabThread = {
          reply: jest.fn(),
        } as unknown as GitLabCommentThread;
        const comment = GitLabComment.fromGqlNote(
          noteOnDiff as GqlTextDiffNote,
          mockedGitLabThread,
        );
        const mockedVsThread = {
          comments: [comment],
        } as unknown as vscode.CommentThread;

        await createComment({
          text: 'reply text',
          thread: mockedVsThread,
        });

        expect(comment.thread.reply).toHaveBeenCalledWith('reply text');
      });
    });

    describe('creating a new thread', () => {
      // this diff hunk represents the diff where we create a new comment thread
      const diff = [
        '@@ -1,10 +1,10 @@',
        ' 1',
        '-2', // line 2 exists only on the old version of the diff
        '-3',
        ' 4', // unchanged - line #4 on the old version and #2 on the new version
        ' 5',
        ' 6',
        ' 7',
        ' 8',
        '+8.1', // this line exists only as line #7 on the new version of the diff
        '+8.2',
        ' 9',
        ' 10',
      ].join('\n');

      const mrDiff = {
        ...mrVersion.diffs[0],
        diff,
        old_path: 'old/path/to/file.js',
        new_path: 'new/path/to/file.js',
      };

      const customMrVersion = {
        ...mrVersion,
        base_commit_sha: 'aaaaa',
        head_commit_sha: 'bbbbb',
        start_commit_sha: 'ccccc',
        diffs: [mrDiff],
      };

      const createVsThread = (filePath: string, fileCommit: string, lineNumber: number) => {
        const uri = toReviewUri({
          path: filePath,
          commit: fileCommit,
          repositoryRoot: 'root',
          projectId: mr.project_id,
          mrId: mr.id,
        });
        return {
          comments: [],
          uri,
          range: {
            start: new vscode.Position(lineNumber - 1, 0), // VS Code indexes lines starting from 0
          },
        } as unknown as vscode.CommentThread;
      };

      let mockedCreateDiffNote: jest.Mock;

      beforeEach(() => {
        mockedCreateDiffNote = jest.fn().mockResolvedValue(discussionOnDiff);
        asMock(gitlabProjectRepository.getProjectOrFail).mockReturnValue(projectInRepository);
        asMock(mrCache.getMr).mockReturnValue({ mr, mrVersion: customMrVersion });
        asMock(getGitLabService).mockReturnValue({
          createDiffNote: mockedCreateDiffNote,
        });
      });

      it.each`
        scenario            | filePath           | fileCommit                         | lineNumber | expectedOldLine | expectedNewLine
        ${'old line'}       | ${mrDiff.old_path} | ${customMrVersion.base_commit_sha} | ${2}       | ${2}            | ${undefined}
        ${'new line'}       | ${mrDiff.new_path} | ${customMrVersion.head_commit_sha} | ${7}       | ${undefined}    | ${7}
        ${'unchanged line'} | ${mrDiff.old_path} | ${customMrVersion.base_commit_sha} | ${4}       | ${4}            | ${2}
      `(
        'creates thread correctly for $scenario',
        async ({ filePath, fileCommit, lineNumber, expectedOldLine, expectedNewLine }) => {
          await createComment({
            text: 'new thread text',
            thread: createVsThread(filePath, fileCommit, lineNumber),
          });

          expect(mockedCreateDiffNote).toHaveBeenCalledWith(mr.id, 'new thread text', {
            baseSha: 'aaaaa',
            headSha: 'bbbbb',
            startSha: 'ccccc',
            paths: {
              oldPath: 'old/path/to/file.js',
              newPath: 'new/path/to/file.js',
            },
            oldLine: expectedOldLine,
            newLine: expectedNewLine,
          });
        },
      );

      describe('retryFailedComment', () => {
        let thread: vscode.CommentThread;
        let comment: CommentWithThread;

        beforeEach(() => {
          thread = createVsThread(mrDiff.old_path, customMrVersion.base_commit_sha, 2);
          comment = {
            contextValue: FAILED_COMMENT_CONTEXT,
            body: 'failed comment body',
            thread,
          } as Partial<CommentWithThread> as CommentWithThread;
          thread.comments = [comment];
        });

        it('when retry succeeds, it will replace failed comment with synced comment', async () => {
          await retryFailedComment(comment);

          expect(thread.comments.length).toBe(1);
          expect(thread.comments[0].body).toEqual(
            new vscode.MarkdownString(discussionOnDiff.notes.nodes[0].body),
          );
          expect(thread.comments[0].contextValue).toMatch(SYNCED_COMMENT_CONTEXT);
        });

        it('when retry fails, it will leave the failed comment in the thread', async () => {
          mockedCreateDiffNote.mockRejectedValue(new Error('failure to create a comment'));

          await expect(async () => retryFailedComment(comment)).rejects.toBeInstanceOf(Error);

          expect(thread.comments.length).toBe(1);
          expect(thread.comments[0].body).toBe('failed comment body');
          expect(thread.comments[0].contextValue).toMatch(FAILED_COMMENT_CONTEXT);
        });
      });
    });
  });
});
