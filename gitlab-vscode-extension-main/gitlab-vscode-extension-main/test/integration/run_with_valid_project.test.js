const assert = require('assert');
const sinon = require('sinon');
const vscode = require('vscode');
const {
  getActiveProject,
  getActiveProjectOrSelectOne,
} = require('../../src/commands/run_with_valid_project');
const { gitlabProjectRepository } = require('../../src/gitlab/gitlab_project_repository');
const { projectInRepository } = require('../../src/test_utils/entities');
const {
  createAndOpenFile,
  closeAndDeleteFile,
  simulateQuickPickChoice,
  getRepositoryRoot,
} = require('./test_infrastructure/helpers');

describe('run_with_valid_project', () => {
  describe('getting repositories', () => {
    const sandbox = sinon.createSandbox();

    describe('one repository, no open files', () => {
      it('getActiveRepository returns the open repository', () => {
        const result = getActiveProject();
        assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
      });

      it('getActiveRepositoryOrSelectOne returns the open repository', async () => {
        const result = await getActiveProjectOrSelectOne();
        assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
      });
    });

    describe('multiple repositories', () => {
      beforeEach(() => {
        const originalProjects = gitlabProjectRepository.getDefaultAndSelectedProjects();
        sandbox
          .stub(gitlabProjectRepository, 'getDefaultAndSelectedProjects')
          .returns([...originalProjects, projectInRepository]);
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('getActiveRepository returns undefined', () => {
        const result = getActiveProject();
        assert.strictEqual(result, undefined);
      });

      it('getActiveRepositoryOrSelectOne lets user select a repository', async () => {
        // simulating user selecting second option
        simulateQuickPickChoice(sandbox, 1);
        const result = await getActiveProjectOrSelectOne();
        assert.strictEqual(result.pointer.repository.rootFsPath, '/path/to/repo');
      });

      describe('with open editor', () => {
        let testFileUri;
        beforeEach(async () => {
          testFileUri = vscode.Uri.file(`${getRepositoryRoot()}/newfile.js`);
          await createAndOpenFile(testFileUri);
        });

        afterEach(async () => {
          await closeAndDeleteFile(testFileUri);
        });

        it('getActiveRepository returns repository for the open file', () => {
          const result = getActiveProject();
          assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
        });

        it('getActiveRepositoryOrSelectOne returns repository for the open file', async () => {
          const result = await getActiveProjectOrSelectOne();
          assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
        });
      });
    });
  });
});
