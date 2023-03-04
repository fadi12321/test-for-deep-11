import { asMock } from '../test_utils/as_mock';
import { getExtensionConfiguration } from '../utils/extension_configuration';
import { projectInRepository } from '../test_utils/entities';
import { runWithValidProject } from './run_with_valid_project';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';

jest.mock('../gitlab/gitlab_project_repository');
jest.mock('../utils/extension_configuration');
jest.mock('../log');

describe('runWithValidProject', () => {
  beforeEach(() => {
    asMock(getExtensionConfiguration).mockReturnValue({ instanceUrl: 'https://gitlab.com' });
  });

  describe('with valid project', () => {
    beforeEach(() => {
      asMock(gitlabProjectRepository.getDefaultAndSelectedProjects).mockReturnValue([
        projectInRepository,
      ]);
    });

    it('injects repository, remote, and GitLab project into the command', async () => {
      const command = jest.fn();

      await runWithValidProject(command)();

      expect(command).toHaveBeenCalledWith(projectInRepository);
    });
  });

  describe('without project', () => {
    beforeEach(() => {
      asMock(gitlabProjectRepository.getDefaultAndSelectedProjects).mockReturnValue([]);
    });

    it('does not run the command', async () => {
      const command = jest.fn();

      await runWithValidProject(command)();

      expect(command).not.toHaveBeenCalled();
    });
  });
});
