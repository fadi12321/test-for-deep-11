import { Uri } from 'vscode';

export class FileSystemError extends Error {
  readonly code: string;

  static FileNotFound(messageOrUri?: string | Uri): FileSystemError {
    return new this('file-not-found', `File not found: ${messageOrUri}`);
  }

  static FileExists(messageOrUri?: string | Uri): FileSystemError {
    return new this('file-exists', `File exists: ${messageOrUri}`);
  }

  static FileNotADirectory(messageOrUri?: string | Uri): FileSystemError {
    return new this('file-not-a-directory', `File not a directory: ${messageOrUri}`);
  }

  static FileIsADirectory(messageOrUri?: string | Uri): FileSystemError {
    return new this('file-is-a-directory', `File is a directory: ${messageOrUri}`);
  }

  static NoPermissions(messageOrUri?: string | Uri): FileSystemError {
    return new this('no-permissions', `No permissions: ${messageOrUri}`);
  }

  static Unavailable(messageOrUri?: string | Uri): FileSystemError {
    return new this('unavailable', `Unavailable: ${messageOrUri}`);
  }

  private constructor(code: string, messageOrUri?: string | Uri) {
    super(typeof messageOrUri === 'string' ? messageOrUri : messageOrUri?.toString());
    this.code = code;
  }
}
