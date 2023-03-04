import * as vscode from 'vscode';
import assert from 'assert';
import { PROGRAMMATIC_COMMANDS } from '../../command_names';
import { ChangedFileItem, HasCommentsFn } from './changed_file_item';
import { ItemModel } from './item_model';
import { GqlDiscussion, GqlTextDiffDiscussion } from '../../gitlab/graphql/get_discussions';
import { handleError } from '../../log';
import { UserFriendlyError } from '../../errors/user_friendly_error';
import { GitLabCommentThread } from '../../review/gitlab_comment_thread';
import { CommentingRangeProvider } from '../../review/commenting_range_provider';
import { commentControllerProvider } from '../../review/comment_controller_provider';
import { GqlTextDiffNote } from '../../gitlab/graphql/shared';
import { toReviewUri } from '../../review/review_uri';
import {
  commentRangeFromPosition,
  commitFromPosition,
  pathFromPosition,
} from '../../review/gql_position_parser';
import { UnsupportedVersionError } from '../../errors/unsupported_version_error';
import { ChangedFolderItem, FolderTreeItem } from './changed_folder_item';
import { getSidebarViewState, SidebarViewState } from '../sidebar_view_state';
import { ProjectInRepository } from '../../gitlab/new_project';
import { getGitLabService } from '../../gitlab/get_gitlab_service';
import { mrCache } from '../../gitlab/mr_cache';

const isTextDiffDiscussion = (discussion: GqlDiscussion): discussion is GqlTextDiffDiscussion => {
  const firstNote = discussion.notes.nodes[0];
  return firstNote?.position?.positionType === 'text';
};

const firstNoteFrom = (discussion: GqlTextDiffDiscussion): GqlTextDiffNote => {
  const note = discussion.notes.nodes[0];
  assert(note, 'discussion should contain at least one note');
  return note;
};

const uriForDiscussion = (
  rootFsPath: string,
  mr: RestMr,
  discussion: GqlTextDiffDiscussion,
): vscode.Uri => {
  const { position } = firstNoteFrom(discussion);
  return toReviewUri({
    path: pathFromPosition(position),
    commit: commitFromPosition(position),
    repositoryRoot: rootFsPath,
    projectId: mr.project_id,
    mrId: mr.id,
  });
};

export class MrItemModel extends ItemModel {
  private allUrisWithComments?: string[];

  readonly mr: RestMr;

  readonly projectInRepository: ProjectInRepository;

  constructor(mr: RestMr, projectInRepository: ProjectInRepository) {
    super();
    this.mr = mr;
    this.projectInRepository = projectInRepository;
  }

  getTreeItem(): vscode.TreeItem {
    const { iid, title, author } = this.mr;
    const item = new vscode.TreeItem(
      `!${iid} · ${title}`,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    if (author.avatar_url) {
      item.iconPath = vscode.Uri.parse(author.avatar_url);
    }
    item.contextValue = `mr-item-from-${this.isFromFork ? 'fork' : 'same-project'}`;
    return item;
  }

  private get overviewItem() {
    const result = new vscode.TreeItem('Overview');
    result.iconPath = new vscode.ThemeIcon('note');
    result.command = {
      command: PROGRAMMATIC_COMMANDS.SHOW_RICH_CONTENT,
      arguments: [this.mr, this.projectInRepository.pointer.repository.rootFsPath],
      title: 'Show MR Overview',
    };
    return result;
  }

  private async getMrDiscussions(): Promise<GqlTextDiffDiscussion[]> {
    try {
      const discussions = await getGitLabService(this.projectInRepository).getDiscussions({
        issuable: this.mr,
      });
      return discussions.filter(isTextDiffDiscussion);
    } catch (e) {
      const error =
        e instanceof UnsupportedVersionError
          ? e
          : new UserFriendlyError(
              `The extension failed to preload discussions on the MR diff. It's possible that you've encountered
            [this existing issue](https://gitlab.com/gitlab-org/gitlab/-/issues/298827).`,
              e,
            );
      handleError(error);
    }
    return [];
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    const { mrVersion } = await mrCache.reloadMr(this.mr, this.projectInRepository);

    // don't initialize comments twice
    if (!this.allUrisWithComments) {
      const discussions = await this.getMrDiscussions();
      await this.addAllCommentsToVsCode(mrVersion, discussions);

      this.allUrisWithComments = discussions.map(d =>
        uriForDiscussion(
          this.projectInRepository.pointer.repository.rootFsPath,
          this.mr,
          d,
        ).toString(),
      );
    }

    const hasCommentsFn: HasCommentsFn = uri =>
      (this.allUrisWithComments as string[]).includes(uri.toString());

    const createChangedFiles = (shownInList: boolean): FolderTreeItem[] =>
      mrVersion.diffs.map(diff => ({
        path: diff.new_path || diff.old_path,
        item: new ChangedFileItem(
          this.mr,
          mrVersion as RestMrVersion,
          diff,
          this.projectInRepository.pointer.repository.rootFsPath,
          hasCommentsFn,
          shownInList,
        ),
      }));

    const changedFiles =
      getSidebarViewState() === SidebarViewState.TreeView
        ? new ChangedFolderItem('', createChangedFiles(false)).getChildren()
        : createChangedFiles(true).map(file => file.item);

    return [this.overviewItem, ...changedFiles];
  }

  private async addAllCommentsToVsCode(
    mrVersion: RestMrVersion,
    discussions: GqlTextDiffDiscussion[],
  ): Promise<void> {
    const gitlabService = getGitLabService(this.projectInRepository);
    const userCanComment = await gitlabService.canUserCommentOnMr(this.mr);

    const commentController = commentControllerProvider.borrowCommentController(
      this.mr.references.full,
      this.mr.title,
      userCanComment ? new CommentingRangeProvider(this.mr, mrVersion) : undefined,
    );
    this.setDisposableChildren([commentController]);

    discussions.forEach(discussion => {
      const { position } = firstNoteFrom(discussion);
      const vsThread = commentController.createCommentThread(
        uriForDiscussion(
          this.projectInRepository.pointer.repository.rootFsPath,
          this.mr,
          discussion,
        ),
        commentRangeFromPosition(position),
        // the comments need to know about the thread, so we first
        // create empty thread to be able to create comments
        [],
      );
      return new GitLabCommentThread(
        vsThread,
        discussion,
        getGitLabService(this.projectInRepository),
        this.mr,
      );
    });
  }

  get isFromFork(): boolean {
    return this.mr.target_project_id !== this.mr.source_project_id;
  }
}
