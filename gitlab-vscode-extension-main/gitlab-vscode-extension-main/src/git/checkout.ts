import assert from 'assert';
import { Repository } from '../api/git';

export const checkout = async (rawRepository: Repository, branchName: string): Promise<void> => {
  await rawRepository.checkout(branchName);

  assert(
    rawRepository.state.HEAD,
    "We can't read repository HEAD. We suspect that your `git head` command fails and we can't continue till it succeeds",
  );

  const currentBranchName = rawRepository.state.HEAD.name;
  assert(
    currentBranchName === branchName,
    `The branch name after the checkout (${currentBranchName}) is not the branch that the extension tried to check out (${branchName}). Inspect your repository before making any more changes.`,
  );
};
