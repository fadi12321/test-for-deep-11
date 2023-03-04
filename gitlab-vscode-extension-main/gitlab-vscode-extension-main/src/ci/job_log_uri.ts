import { Uri } from 'vscode';
import { JOB_LOG_URI_SCHEME } from '../constants';
import { jsonStringifyWithSortedKeys } from '../utils/json_stringify_with_sorted_keys';

export function toJobLogUri(repositoryRoot: string, job: number): Uri {
  const query = { repositoryRoot, job };
  // The Uri's path is used only as a display label.
  return Uri.parse(`${JOB_LOG_URI_SCHEME}:Job ${job}`).with({
    query: jsonStringifyWithSortedKeys(query),
  });
}

export function fromJobLogUri(uri: Uri): { repositoryRoot: string; job: number } {
  const { repositoryRoot, job } = JSON.parse(uri.query);
  return { repositoryRoot, job };
}
