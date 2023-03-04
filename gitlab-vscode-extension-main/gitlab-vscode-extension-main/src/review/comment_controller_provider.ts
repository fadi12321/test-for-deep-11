import * as vscode from 'vscode';

export class CommentControllerProvider {
  controllers: Record<string, vscode.CommentController | undefined> = {};

  /**
   * Creates comment controller and ensures it is the only existing controller for given MR
   * This method exists for several reasons:
   * - if we open MR multiple times,  we want to prevent multiple comments being displayed
   * - multiple comment controllers for the same MR make commenting on MR harder
   * - we want to make sure that we add commentingRangeProvider correctly
   */
  borrowCommentController(
    mrFullReference: string,
    title: string,
    commentingRangeProvider?: vscode.CommentingRangeProvider,
  ): vscode.CommentController {
    const existingController = this.controllers[mrFullReference];
    if (existingController) {
      existingController.dispose();
    }
    const controller = vscode.comments.createCommentController(
      `gitlab-mr-${mrFullReference}`,
      title,
    );
    // we must assign commentingRangeProvider right after we create the controller
    // if there was an `async` call between, VS Code wouldn't show the commenting range
    // this bug has been reported https://github.com/microsoft/vscode/issues/126475
    controller.commentingRangeProvider = commentingRangeProvider;
    this.controllers[mrFullReference] = controller;
    return controller;
  }
}

export const commentControllerProvider = new CommentControllerProvider();
