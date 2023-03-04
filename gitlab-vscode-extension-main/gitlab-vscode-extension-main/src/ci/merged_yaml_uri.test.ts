import { MERGED_YAML_URI_SCHEME } from '../constants';
import { fromMergedYamlUri, MergedYamlParams, toMergedYamlUri } from './merged_yaml_uri';

describe('MergedYamlParams', () => {
  const input: MergedYamlParams = {
    initial: '# Initial Merged YAML',
    repositoryRoot: 'repositoryRoot',
    path: 'path/to/repository',
  };

  it('has a uri scheme', () => {
    expect(toMergedYamlUri(input).scheme).toBe(MERGED_YAML_URI_SCHEME);
  });

  it('can serialize and deserialize', () => {
    const output = fromMergedYamlUri(toMergedYamlUri(input));
    expect(output).toStrictEqual(input);
  });
});
