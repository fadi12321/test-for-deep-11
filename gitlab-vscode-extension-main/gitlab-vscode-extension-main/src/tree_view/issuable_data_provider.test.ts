import { extensionState } from '../extension_state';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { asMock } from '../test_utils/as_mock';
import { gitRepository } from '../test_utils/entities';
import { IssuableDataProvider } from './issuable_data_provider';

jest.mock('../extension_state');
jest.mock('../gitlab/gitlab_project_repository');

describe('Issuable Data Provider', () => {
  let provider: IssuableDataProvider;
  beforeEach(() => {
    asMock(extensionState.isValid).mockReturnValue(true);
    provider = new IssuableDataProvider();
  });

  it('returns empty array when there are no repositories', async () => {
    jest.spyOn(gitExtensionWrapper, 'gitRepositories', 'get').mockReturnValue([]);
    expect(await provider.getChildren(undefined)).toEqual([]);
  });

  it('returns an error item if the repository does not contain GitLab project', async () => {
    jest.spyOn(gitExtensionWrapper, 'gitRepositories', 'get').mockReturnValue([gitRepository]);
    asMock(gitlabProjectRepository.getSelectedOrDefaultForRepository).mockReturnValue(undefined);
    const children = await provider.getChildren(undefined);
    expect(children.length).toBe(1);
    expect((children[0] as any).label).toMatch(/no GitLab project/);
  });
});
