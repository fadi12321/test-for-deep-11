import { GitContentProvider } from './git_content_provider';
import { ApiContentProvider } from './api_content_provider';
import { toReviewUri } from './review_uri';
import { getFileContent } from '../git/get_file_content';
import { asMock } from '../test_utils/as_mock';
import { gitlabProjectRepository } from '../gitlab/gitlab_project_repository';
import { projectInRepository } from '../test_utils/entities';

jest.mock('../git/git_extension_wrapper');
jest.mock('./api_content_provider');
jest.mock('../git/get_file_content');
jest.mock('../gitlab/gitlab_project_repository');

describe('GitContentProvider', () => {
  const gitContentProvider = new GitContentProvider();

  const reviewUriParams = {
    commit: 'abcdef',
    path: '/review',
    projectId: 1234,
    mrId: 2345,
    repositoryRoot: 'path/to/workspace',
  };

  beforeEach(() => {
    asMock(gitlabProjectRepository.getProjectOrFail).mockReturnValue(projectInRepository);
  });

  it('provides file content from a git repository', async () => {
    asMock(getFileContent).mockReturnValue('Test text');

    const result = await gitContentProvider.provideTextDocumentContent(
      toReviewUri(reviewUriParams),
    );
    expect(result).toBe('Test text');
  });

  it('falls back to the API provider if file does not exist in the git repository', async () => {
    asMock(getFileContent).mockReturnValue(null);

    const apiContentProvider = new ApiContentProvider();
    apiContentProvider.provideTextDocumentContent = jest.fn().mockReturnValue('Api content');
    asMock(ApiContentProvider).mockReturnValue(apiContentProvider);

    const result = await gitContentProvider.provideTextDocumentContent(
      toReviewUri(reviewUriParams),
    );
    expect(result).toBe('Api content');
  });
});
