import * as vscode from 'vscode';
import { FetchError } from '../errors/fetch_error';
import { GitLabService } from '../gitlab/gitlab_service';
import { accountService } from '../accounts/account_service';
import { asMock } from '../test_utils/as_mock';
import { createTokenAccount } from '../test_utils/entities';
import { GitLabRemoteFileSystem } from './gitlab_remote_file_system';

jest.mock('../accounts/account_service');
jest.mock('../gitlab/gitlab_service');

const encoder = new TextEncoder();

interface ProjectInfo {
  id?: number;
  path?: string;
  trees?: Record<string, RestRepositoryTreeEntry[]>;
  files?: Record<string, RestRepositoryFile>;
}

function newFetchError(url: string | undefined, status: number, text: string, bodyJson?: unknown) {
  const response: Partial<Response> = {
    url: url as string,
    ok: false,
    redirected: false,
    status,
    statusText: text,
  };

  if (bodyJson) {
    response.json = () => Promise.resolve(bodyJson);
  } else {
    response.json = () => Promise.reject(new Error('no content'));
  }

  return new FetchError(text, response as Response);
}

function newTreeEntry({
  name,
  type,
}: {
  name: string;
  type: 'blob' | 'tree';
}): RestRepositoryTreeEntry {
  const e: Partial<RestRepositoryTreeEntry> = { name, type };
  return e as RestRepositoryTreeEntry;
}

function newRepoFile({ size, content }: { size?: number; content?: string }): RestRepositoryFile {
  const f: Partial<RestRepositoryFile> = { size, content };
  return f as RestRepositoryFile;
}

describe('GitLabRemoteFileSystem', () => {
  const gitlabAbs = 'https://1.example.com/';
  const gitlabRel = 'https://2.example.com/gitlab/';
  let instanceUrls: string[];

  let projectInfo: ProjectInfo | null;
  const getProjectInfo = (url: string | undefined, id: number | string) => {
    if (projectInfo && (projectInfo.id === Number(id) || projectInfo.path === id)) {
      return projectInfo;
    }
    throw newFetchError(url, 404, 'not found');
  };

  const testProject = { id: 1 };
  const testProjectFooURI = vscode.Uri.parse(
    `gitlab-remote://1.example.com/X/foo?project=1&ref=main`,
  );
  const testProjectWithTree = {
    ...testProject,
    trees: {
      foo: [
        newTreeEntry({ name: 'bar', type: 'blob' }),
        newTreeEntry({ name: 'baz', type: 'tree' }),
      ],
    },
  };
  const testProjectWithFile = {
    ...testProject,
    files: {
      foo: newRepoFile({ size: 123, content: 'this is a test file\nfoo bar baz\n' }),
    },
  };

  beforeEach(() => {
    instanceUrls = [gitlabAbs, gitlabRel];
    projectInfo = null;

    accountService.getInstanceUrls = () => instanceUrls;
    accountService.getOneAccountForInstance = () => createTokenAccount();

    asMock(GitLabService).mockImplementation(() => ({
      async getTree(
        path: string,
        ref: string,
        projectId: number | string,
      ): Promise<RestRepositoryTreeEntry[]> {
        const proj = getProjectInfo(undefined, projectId);
        if (!proj.trees || !(path in proj.trees)) return [];
        return proj.trees[path];
      },

      async getFile(
        path: string,
        ref: string,
        projectId: number | string,
      ): Promise<RestRepositoryFile> {
        const proj = getProjectInfo(undefined, projectId);
        if (!proj.files || !(path in proj.files)) throw newFetchError(undefined, 404, 'not found');
        return proj.files[path];
      },

      async getFileContent(path: string, ref: string, projectId: number | string): Promise<string> {
        const proj = getProjectInfo(undefined, projectId);
        if (!proj.files || !(path in proj.files)) throw newFetchError(undefined, 404, 'not found');
        return proj.files[path].content;
      },
    }));
  });

  describe('parseUri', () => {
    it('correctly parses a root URI for a non-relative instance', () => {
      const testUri = vscode.Uri.parse(
        `gitlab-remote://1.example.com/FooBar?project=foo/bar&ref=main`,
      );
      const r = GitLabRemoteFileSystem.parseUri(testUri);
      expect(r.instance.toString()).toStrictEqual('https://1.example.com/');
      expect(r.project).toStrictEqual('foo/bar');
      expect(r.ref).toStrictEqual('main');
      expect(r.path).toStrictEqual('');
    });

    it('correctly parses a non-root URI for a non-relative instance', () => {
      const testUri = vscode.Uri.parse(
        `gitlab-remote://1.example.com/FooBar/baz/bat?project=foo/bar&ref=main`,
      );
      const r = GitLabRemoteFileSystem.parseUri(testUri);
      expect(r.instance.toString()).toStrictEqual('https://1.example.com/');
      expect(r.project).toStrictEqual('foo/bar');
      expect(r.ref).toStrictEqual('main');
      expect(r.path).toStrictEqual('baz/bat');
    });

    it('correctly parses a root URI for a relative instance', () => {
      const testUri = vscode.Uri.parse(
        `gitlab-remote://2.example.com/gitlab/FooBar?project=foo/bar&ref=main`,
      );
      const r = GitLabRemoteFileSystem.parseUri(testUri);
      expect(r.instance.toString()).toStrictEqual('https://2.example.com/gitlab/');
      expect(r.project).toStrictEqual('foo/bar');
      expect(r.ref).toStrictEqual('main');
      expect(r.path).toStrictEqual('');
    });

    it('correctly parses a non-root URI for a relative instance', () => {
      const testUri = vscode.Uri.parse(
        `gitlab-remote://2.example.com/gitlab/FooBar/baz/bat?project=foo/bar&ref=main`,
      );
      const r = GitLabRemoteFileSystem.parseUri(testUri);
      expect(r.instance.toString()).toStrictEqual('https://2.example.com/gitlab/');
      expect(r.project).toStrictEqual('foo/bar');
      expect(r.ref).toStrictEqual('main');
      expect(r.path).toStrictEqual('baz/bat');
    });

    it('fails if the scheme is wrong', () => {
      const testUri = vscode.Uri.parse(
        `not-gitlab-remote://1.example.com/FooBar?project=foo/bar&ref=main`,
      );
      expect(() => GitLabRemoteFileSystem.parseUri(testUri)).toThrow(
        /it should begin with gitlab-remote/,
      );
    });

    it('fails if the project is missing', () => {
      const testUri = vscode.Uri.parse(`gitlab-remote://1.example.com/FooBar?ref=main`);
      expect(() => GitLabRemoteFileSystem.parseUri(testUri)).toThrow(
        /must contain a project= query parameter/,
      );
    });

    it('fails if the ref is missing', () => {
      const testUri = vscode.Uri.parse(`gitlab-remote://1.example.com/FooBar?project=foo/bar`);
      expect(() => GitLabRemoteFileSystem.parseUri(testUri)).toThrow(
        /must contain a ref= query parameter/,
      );
    });

    it('fails if the token is missing', () => {
      instanceUrls = [];
      const testUri = vscode.Uri.parse(
        `gitlab-remote://1.example.com/FooBar?project=foo/bar&ref=main`,
      );
      expect(() => GitLabRemoteFileSystem.parseUri(testUri)).toThrow(/missing token/i);
    });
  });

  describe('validateLabel', () => {
    it.each`
      scenario          | value          | error
      ${'alphanumeric'} | ${'FooBar123'} | ${null}
      ${'space'}        | ${'foo bar'}   | ${null}
      ${'underscore'}   | ${'foo_bar'}   | ${null}
      ${'dash'}         | ${'foo-bar'}   | ${null}
      ${'dot'}          | ${'foo.bar'}   | ${null}
      ${'slash'}        | ${'foo/bar'}   | ${'/'}
      ${'colon'}        | ${'foo:bar'}   | ${':'}
    `('$scenario', ({ value, error }) => {
      const r = GitLabRemoteFileSystem.validateLabel(value);
      if (!error) {
        expect(r).toBeNull();
      } else {
        expect(r).toContain(`Illegal character: "${error}"`);
      }
    });
  });

  describe('stat', () => {
    it('returns directory info for a tree', async () => {
      projectInfo = testProjectWithTree;

      const r = await GitLabRemoteFileSystem.stat(testProjectFooURI);
      expect(r.type).toStrictEqual(vscode.FileType.Directory);
    });

    it('returns file info for a file', async () => {
      projectInfo = testProjectWithFile;

      const r = await GitLabRemoteFileSystem.stat(testProjectFooURI);
      expect(r.type).toStrictEqual(vscode.FileType.File);
      expect(r.size).toStrictEqual(123);
    });

    it('throws FileNotFound if no file or tree exists', async () => {
      projectInfo = testProject;

      const r = GitLabRemoteFileSystem.stat(testProjectFooURI);
      await r.catch(e => expect(e.code).toStrictEqual('file-not-found'));
      await expect(r).rejects.toThrow(vscode.FileSystemError);
    });
  });

  describe('readDirectory', () => {
    it('returns directory entries for a tree', async () => {
      projectInfo = testProjectWithTree;

      const r = await GitLabRemoteFileSystem.readDirectory(testProjectFooURI);
      expect(r).toEqual([
        ['bar', vscode.FileType.File],
        ['baz', vscode.FileType.Directory],
      ]);
    });

    it('throws FileNotFound if no file or tree exists', async () => {
      projectInfo = testProject;

      const r = GitLabRemoteFileSystem.readDirectory(testProjectFooURI);
      await r.catch(e => expect(e.code).toStrictEqual('file-not-found'));
      await expect(r).rejects.toThrow(vscode.FileSystemError);
    });

    it('throws FileNotADirectory if a file exists', async () => {
      projectInfo = testProjectWithFile;

      const r = GitLabRemoteFileSystem.readDirectory(testProjectFooURI);
      await r.catch(e => expect(e.code).toStrictEqual('file-not-a-directory'));
      await expect(r).rejects.toThrow(vscode.FileSystemError);
    });
  });

  describe('readFile', () => {
    it('returns file contents for a file', async () => {
      projectInfo = testProjectWithFile;

      const r = await GitLabRemoteFileSystem.readFile(testProjectFooURI);
      expect(r).toEqual(encoder.encode(testProjectWithFile.files.foo.content));
    });

    it('throws FileNotFound if no file or tree exists', async () => {
      projectInfo = testProject;

      const r = GitLabRemoteFileSystem.readFile(testProjectFooURI);
      await r.catch(e => expect(e.code).toStrictEqual('file-not-found'));
      await expect(r).rejects.toThrow(vscode.FileSystemError);
    });

    it('throws FileIsADirectory if a tree exists', async () => {
      projectInfo = testProjectWithTree;

      const r = GitLabRemoteFileSystem.readFile(testProjectFooURI);
      await r.catch(e => expect(e.code).toStrictEqual('file-is-a-directory'));
      await expect(r).rejects.toThrow(vscode.FileSystemError);
    });
  });
});
