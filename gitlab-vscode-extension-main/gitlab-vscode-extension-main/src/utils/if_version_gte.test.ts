import { ifVersionGte } from './if_version_gte';

describe('ifVersionGte', () => {
  const then = async () => 'then';
  const otherwise = async () => 'otherwise';
  it('runs the happy branch if current version is equal to the minimal required', async () => {
    const result = await ifVersionGte('14.4', '14.4.0', then, otherwise);
    expect(result).toBe('then');
  });

  it('runs the happy branch if current version is greater to the minimal required', async () => {
    const result = await ifVersionGte('14.5.1', '14.4.0', then, otherwise);
    expect(result).toBe('then');
  });

  it('runs the happy branch if we could not parse current version', async () => {
    const result = await ifVersionGte('xxx', '14.4.0', then, otherwise);
    expect(result).toBe('then');
  });

  it('runs the alternate branch if the version is older than the minimal required', async () => {
    const result = await ifVersionGte('14.3', '14.4.0', then, otherwise);
    expect(result).toBe('otherwise');
  });

  it('fails if the minimum required version is not complete', async () => {
    expect(() => ifVersionGte('14.3', '14.4', then, otherwise)).toThrow(/isn't valid/);
  });
});
