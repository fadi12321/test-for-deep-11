import { createFakeRepository } from '../test_utils/fake_git_extension';
import { createRemoteUrlPointers, GitRepositoryImpl } from './new_git';

describe('new_git', () => {
  describe('GitRepositoryImpl', () => {
    describe('remotes', () => {
      it('handles single remote', () => {
        const fakeRepository = createFakeRepository({
          remotes: [['origin', 'git@gitlab.com/group/project']],
        });
        const gitRepository = new GitRepositoryImpl(fakeRepository);

        const { remotes } = gitRepository;

        expect(remotes).toHaveLength(1);
        const [remote] = remotes;
        expect(remote.name).toBe('origin');
        expect(remote.urlEntries).toHaveLength(1);
        const [urlEntry] = remote.urlEntries;
        expect(urlEntry.type).toBe('fetch');
        expect(urlEntry.url).toBe('git@gitlab.com/group/project');
      });

      it.each`
        fetchUrl                           | pushUrl                            | expected
        ${'git@gitlab.com/group/project'}  | ${'git@gitlab.com/group/project'}  | ${[{ type: 'both', url: 'git@gitlab.com/group/project' }]}
        ${'git@gitlab.com/group/project'}  | ${undefined}                       | ${[{ type: 'fetch', url: 'git@gitlab.com/group/project' }]}
        ${undefined}                       | ${'git@gitlab.com/group/project'}  | ${[{ type: 'push', url: 'git@gitlab.com/group/project' }]}
        ${'git@gitlab.com/group1/project'} | ${'git@gitlab.com/group2/project'} | ${[{ type: 'fetch', url: 'git@gitlab.com/group1/project' }, { type: 'push', url: 'git@gitlab.com/group2/project' }]}
      `(
        'for urls fetch: $fetchUrl, push: $pushUrl, we expect the URL Entries to be parsed as $expected ',
        ({ fetchUrl, pushUrl, expected }) => {
          const fakeRepository = createFakeRepository({
            remotes: [['origin', fetchUrl, pushUrl]],
          });
          const gitRepository = new GitRepositoryImpl(fakeRepository);

          const { remotes } = gitRepository;

          expect(remotes[0].urlEntries).toEqual(expected);
        },
      );

      it('fails when there is invalid remote', () => {
        // VS Code Git extension allows this scenario in their data model, but Git doesn't
        const fakeRepository = createFakeRepository({ remotes: [['origin']] });
        const gitRepository = new GitRepositoryImpl(fakeRepository);

        expect(() => gitRepository.remotes).toThrow(/origin doesn't have any urls/i);
      });
    });
  });

  describe('createRemoteUrlPointers', () => {
    it('creates pointers for repository', () => {
      const fakeRepository = createFakeRepository({
        remotes: [
          ['origin', 'git@gitlab.com/group/project'],
          ['security', 'git@gitlab.com/group/security/project'],
        ],
      });
      const gitRepository = new GitRepositoryImpl(fakeRepository);

      const [originPointer, securityPointer] = createRemoteUrlPointers(gitRepository);

      expect(originPointer.repository).toBe(gitRepository);
      expect(originPointer.remote.name).toBe('origin');
      expect(originPointer.urlEntry.url).toBe('git@gitlab.com/group/project');

      expect(securityPointer.repository).toBe(gitRepository);
      expect(securityPointer.remote.name).toBe('security');
      expect(securityPointer.urlEntry.url).toBe('git@gitlab.com/group/security/project');
    });
  });
});
