import { Uri } from 'vscode';
import { MERGED_YAML_URI_SCHEME } from '../constants';
import { jsonStringifyWithSortedKeys } from '../utils/json_stringify_with_sorted_keys';

export interface MergedYamlParams {
  path: string;
  initial: string;
  repositoryRoot: string;
}

export function toMergedYamlUri({ path = '', initial, repositoryRoot }: MergedYamlParams): Uri {
  const query = { path, initial, repositoryRoot };
  // The Uri's path is used only as a display label.
  return Uri.parse(`${MERGED_YAML_URI_SCHEME}:.gitlab-ci (Merged).yml`).with({
    query: jsonStringifyWithSortedKeys(query),
  });
}

export function fromMergedYamlUri(uri: Uri): MergedYamlParams {
  const { path, initial, repositoryRoot } = JSON.parse(uri.query);
  return {
    path,
    initial,
    repositoryRoot,
  };
}
