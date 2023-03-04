const assert = require('assert');
const simpleGit = require('simple-git');
const {
  getRepositoryRoot,
  updateRepositoryStatus,
  getRawRepository,
} = require('../test_infrastructure/helpers');
const { getTrackingBranchName } = require('../../../src/git/get_tracking_branch_name');

describe('getTrackingBranchName', () => {
  const git = simpleGit(getRepositoryRoot());

  beforeEach(async () => {
    await git.checkoutLocalBranch('new-branch');
    // TODO if we use git branch command, we don't have to create a commit
    await git.commit('Test commit', [], { '--allow-empty': null });
  });

  afterEach(async () => {
    await git.checkout('master');
    await git.deleteLocalBranch('new-branch', true);
    await git.raw('config', '--unset', 'branch.new-branch.merge');
  });

  it('returns local branch name if tracking branch is not defined', async () => {
    await updateRepositoryStatus();
    const result = getTrackingBranchName(getRawRepository());

    assert.strictEqual(result, 'new-branch');
  });

  it('returns tracking branch if it is configured', async () => {
    await git.addConfig('branch.new-branch.merge', `refs/heads/test-branch`);

    await updateRepositoryStatus();
    const result = getTrackingBranchName(getRawRepository());

    assert.strictEqual(result, 'test-branch');
  });
});
