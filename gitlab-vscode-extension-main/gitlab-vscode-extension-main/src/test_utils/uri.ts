import * as path from 'path';
import * as vscode from 'vscode';

interface UriOptions {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
}

/**
 * This is a test double for unit-testing vscode.Uri related logic.
 * `vscode` module gets injected into the runtime only in integration tests so
 * Jest tests don't have access to the real implementation.
 *
 * This double approximates the vscode.Uri behavior closely enough, that
 * we can use it in tests. But the logic is not identical.
 */
export class Uri implements vscode.Uri {
  scheme: string;

  authority: string;

  path: string;

  query: string;

  fragment: string;

  get fsPath(): string {
    return this.path;
  }

  constructor(options: UriOptions) {
    this.scheme = options.scheme;
    this.authority = options.authority;
    this.path = options.path;
    this.query = options.query;
    this.fragment = options.fragment;
  }

  with(change: Partial<UriOptions>): vscode.Uri {
    return new Uri({
      scheme: change.scheme ?? this.scheme,
      authority: change.authority ?? this.authority,
      path: change.path ?? this.path,
      query: change.query ?? this.query,
      fragment: change.fragment ?? this.fragment,
    });
  }

  toString(): string {
    // eslint-disable-next-line prefer-const
    let { scheme, authority, path, query, fragment } = this;
    if (query.length > 0) query = `?${query}`;
    if (fragment.length > 0) fragment = `#${fragment}`;
    return `${scheme}://${authority}${path}${query}${fragment}`;
  }

  toJSON(): string {
    return JSON.stringify({ ...this });
  }

  static parse(stringUri: string): Uri {
    const url = new URL(stringUri);
    return new Uri({
      scheme: url.protocol.replace(/:$/, ''),
      authority: url.hostname,
      path: url.pathname,
      query: url.search.replace(/^\?/, ''),
      fragment: url.hash.replace(/^#/, ''),
    });
  }

  static file(filePath: string): Uri {
    return new Uri({
      scheme: 'file',
      authority: '',
      path: filePath.split('?')[0] || '',
      query: filePath.split('?')[1] || '',
      fragment: '',
    });
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const { path: p, ...rest } = base;
    return new this({ ...rest, path: path.join(p, ...pathSegments) });
  }
}
