import * as vscode from 'vscode';
import { MrItemModel } from '../tree_view/items/mr_item_model';
import { checkoutMrBranch } from './checkout_mr_branch';
import { mr, projectInRepository } from '../test_utils/entities';
import { GitErrorCodes, Repository } from '../api/git';
import { getLastCommitSha } from '../git/get_last_commit_sha';
import { checkout } from '../git/checkout';
import { asMock } from '../test_utils/as_mock';
import { ProjectInRepository } from '../gitlab/new_project';

jest.mock('../git/get_last_commit_sha');
jest.mock('../git/checkout');

describe('checkout MR branch', () => {
  let mrItemModel: MrItemModel;

  let testProjectInRepo: ProjectInRepository;
  let fetch: jest.Mock;

  beforeEach(() => {
    fetch = jest.fn();
    asMock(getLastCommitSha).mockReturnValue(mr.sha);
    testProjectInRepo = {
      ...projectInRepository,
      pointer: {
        ...projectInRepository.pointer,
        repository: {
          ...projectInRepository.pointer.repository,
          rawRepository: { fetch } as unknown as Repository,
        },
      },
    };
    (vscode.window.withProgress as jest.Mock).mockImplementation((_, task) => task());
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('with branch from the same project', () => {
    beforeEach(() => {
      const mrFromTheSameProject = {
        ...mr,
        source_project_id: 123,
        target_project_id: 123,
        source_branch_name: 'feature-a',
      };
      mrItemModel = new MrItemModel(mrFromTheSameProject, testProjectInRepo);
    });

    it('checks out the local branch', async () => {
      await checkoutMrBranch(mrItemModel);

      expect(fetch).toBeCalled();
      expect(checkout).toBeCalledWith(
        testProjectInRepo.pointer.repository.rawRepository,
        'feature-a',
      );
    });

    it('shows a success message', async () => {
      await checkoutMrBranch(mrItemModel);

      expect(vscode.window.showInformationMessage).toBeCalledWith('Branch changed to feature-a');
    });

    it('rejects with an error if error occurred', async () => {
      asMock(checkout).mockRejectedValue(new Error('error'));

      await expect(checkoutMrBranch(mrItemModel)).rejects.toEqual(new Error('error'));
    });

    it('handles errors from the Git Extension', async () => {
      asMock(checkout).mockRejectedValue({
        gitErrorCode: GitErrorCodes.DirtyWorkTree,
        stderr: 'Git standard output',
      });

      await checkoutMrBranch(mrItemModel);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Checkout failed: Git standard output',
        'See Git Log',
      );
    });

    it('warns user that their local branch is not in sync', async () => {
      asMock(getLastCommitSha).mockReturnValue('abdef'); // simulate local sha being different from mr.sha

      await checkoutMrBranch(mrItemModel);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        "Branch changed to feature-a, but it's out of sync with the remote branch. Synchronize it by pushing or pulling.",
      );
    });
  });

  describe('with branch from a forked project', () => {
    beforeEach(() => {
      const mrFromAFork = {
        ...mr,
        source_project_id: 123,
        target_project_id: 456,
        source_branch_name: 'feature-a',
      };
      mrItemModel = new MrItemModel(mrFromAFork, testProjectInRepo);
    });
    it('throws an error', async () => {
      await expect(checkoutMrBranch(mrItemModel)).rejects.toMatchObject({
        message: 'this command is only available for same-project MRs',
      });
    });
  });
});
