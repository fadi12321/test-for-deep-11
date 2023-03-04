import * as vscode from 'vscode';
import assert from 'assert';
import { README_SECTIONS, REMOTE_URI_SCHEME } from '../constants';
import { FetchError } from '../errors/fetch_error';
import { GitLabService } from '../gitlab/gitlab_service';
import { handleError } from '../log';
import { accountService } from '../accounts/account_service';
import { HelpError } from '../errors/help_error';
import { removeTrailingSlash } from '../utils/remove_trailing_slash';
import { ReadOnlyFileSystem } from './readonly_file_system';
import { getGitLabServiceForAccount } from '../gitlab/get_gitlab_service';

const encoder = new TextEncoder();

export function newGitLabService(instance: vscode.Uri): GitLabService {
  const instanceUrl = removeTrailingSlash(instance.toString());
  const account = accountService.getOneAccountForInstance(instanceUrl);
  assert(account, `There is no account for ${instanceUrl}`);
  return getGitLabServiceForAccount(account);
}

/**
 * nullIf40x returns null if the promise throws a 40x fetch error. This allows
 * callers to convert 40x into a FileNotFound error while simplifying handling
 * of unexpected errors.
 * @param p The initial promise - this is expected to be the return from a call
 * to GitLabService.
 * @returns A new promise that does not throw 40x fetch errors.
 */
async function nullIf40x<T>(p: Promise<T>) {
  try {
    return await p;
  } catch (e) {
    if (e instanceof FetchError) {
      const s = e.response.status;

      // Let the handler deal with 40x responses
      if (s === 401 || s === 403 || s === 404) {
        return null;
      }
    }

    throw e;
  }
}

interface GitLabRemotePath {
  instance: vscode.Uri;
  project: string;
  ref: string;
  path: string;
}

type RegisterOptions = Parameters<typeof vscode.workspace.registerFileSystemProvider>[2];

export class GitLabRemoteFileSystem extends ReadOnlyFileSystem {
  static OPTIONS: RegisterOptions = {
    isReadonly: true,
    isCaseSensitive: true,
  };

  /**
   * GitLab remote filesystem URIs must be of the form:
   *
   * `gitlab-remote://<instance>/<subpath>/<project_label>[/<file_path>]?project=<id>&ref=<ref>`
   *
   * If the URI is not in this form, or if the instance does not match any known
   * instances, parseUri will throw an assertion error.
   * @param uri The URI.
   * @returns The parsed GitLab remote fs path.
   *
   */
  static parseUri(uri: vscode.Uri): GitLabRemotePath {
    if (uri.scheme !== REMOTE_URI_SCHEME) {
      throw new HelpError(
        `URI is not a GitLab remote. It begins with ${uri.scheme} but it should begin with ${REMOTE_URI_SCHEME}`,
        { section: README_SECTIONS.REMOTEFS },
      );
    }

    const query = new URLSearchParams(uri.query);
    const project = query.get('project');
    if (!project)
      throw new HelpError(
        'URI is not a GitLab remote. The URI must contain a project= query parameter',
        { section: README_SECTIONS.REMOTEFS },
      );

    const ref = query.get('ref');
    if (!ref)
      throw new HelpError(
        'URI is not a GitLab remote. The URI must contain a ref= query parameter',
        { section: README_SECTIONS.REMOTEFS },
      );

    // Find the instance with a matching authority and a subpath that is a
    // prefix of the URI's path.
    const instance = accountService
      .getInstanceUrls()
      .map(x => vscode.Uri.parse(x))
      .find(x => uri.authority === x.authority && uri.path.startsWith(x.path));
    if (!instance)
      throw new HelpError(
        `Cannot open ${uri}: missing token for GitLab instance ${uri.authority}`,
        { section: README_SECTIONS.SETUP },
      );

    // To get the file path, we first remove the instance subpath, then the
    // project label.
    const pathWithoutInstanceSubpath = uri.path.substring(instance.path.length).replace(/^\//, '');
    const pathWithoutFirstSegment = pathWithoutInstanceSubpath.replace(/^[^/]+(\/|$)/, '');
    return { instance, project, ref, path: pathWithoutFirstSegment };
  }

  /**
   * Checks whether the given value is a valid label for a gitlab-remote URL.
   * @param value the value
   * @returns A human-readable diagnostic message, or `null` when the value is valid.
   */
  static validateLabel(value?: string): string | null {
    const m = value?.match(/[^-._ a-z0-9]/i);
    if (!m) return null;
    return `Illegal character: "${m[0]}". Allowed: alphanumeric, dash, dot, space, and underscore.`;
  }

  static async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const { instance, project, path, ref } = await this.parseUri(uri);
    const service = newGitLabService(instance);

    const [tree, file] = await Promise.all([
      nullIf40x(service.getTree(path, ref, project)),
      nullIf40x(service.getFile(path, ref, project)),
    ]);

    // a (git) directory cannot be empty, so an empty response means the path is not a directory
    if (tree?.length) {
      return { type: vscode.FileType.Directory, ctime: Date.now(), mtime: Date.now(), size: 0 };
    }

    if (file) {
      return {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: file.size,
      };
    }

    throw vscode.FileSystemError.FileNotFound(uri);
  }

  static async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const { instance, project, path, ref } = await this.parseUri(uri);
    const service = newGitLabService(instance);

    const tree = await nullIf40x(service.getTree(path, ref, project));
    // a (git) directory cannot be empty, so an empty response means the path is not a directory
    if (!tree || tree.length === 0) {
      // URI is not a directory - is it a file, or is it missing or inaccessible?
      const file = await nullIf40x(service.getFile(path, ref, project));
      if (file) throw vscode.FileSystemError.FileNotADirectory(uri);
      else throw vscode.FileSystemError.FileNotFound(uri);
    }

    // Reformat the tree entries as VSCode directory entries
    return tree.map(entry => {
      const type = entry.type === 'tree' ? vscode.FileType.Directory : vscode.FileType.File;
      return [entry.name, type];
    });
  }

  static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const { instance, project, path, ref } = await this.parseUri(uri);
    const service = newGitLabService(instance);

    const file = await nullIf40x(service.getFileContent(path, ref, project));
    if (!file) {
      // URI is not a file - is it a directory, or is it missing or inaccessible?
      const tree = await nullIf40x(service.getTree(path, ref, project));
      // a (git) directory cannot be empty, so a non-empty response means the path is a directory
      if (tree && tree.length) throw vscode.FileSystemError.FileIsADirectory(uri);
      else throw vscode.FileSystemError.FileNotFound(uri);
    }

    // UTF-8 encode the file
    return encoder.encode(file);
  }

  /* eslint-disable class-methods-use-this */
  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    try {
      return await GitLabRemoteFileSystem.stat(uri);
    } catch (e) {
      if (!(e instanceof vscode.FileSystemError)) {
        handleError(e);
      }
      throw e;
    }
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    try {
      return await GitLabRemoteFileSystem.readDirectory(uri);
    } catch (e) {
      if (!(e instanceof vscode.FileSystemError)) {
        handleError(e);
      }
      throw e;
    }
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    try {
      return await GitLabRemoteFileSystem.readFile(uri);
    } catch (e) {
      if (!(e instanceof vscode.FileSystemError)) {
        handleError(e);
      }
      throw e;
    }
  }
  /* eslint-enable class-methods-use-this */
}
