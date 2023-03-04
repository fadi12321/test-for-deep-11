import { validateInstanceUrl } from './validate_instance_url';

describe('validateInstanceUrl', () => {
  it('has to start with http:// or https://', () => {
    expect(validateInstanceUrl('gitlab.com')).toBe('Must begin with http:// or https://');
  });

  it('has to be valid URL', () => {
    expect(validateInstanceUrl('http://hthttt dafda^^&*!')).toBe('Must be a valid URL');
  });

  it('returns undefined for valid URL', () => {
    expect(validateInstanceUrl('https://dev.gitlab.com')).toBeUndefined;
  });
});
