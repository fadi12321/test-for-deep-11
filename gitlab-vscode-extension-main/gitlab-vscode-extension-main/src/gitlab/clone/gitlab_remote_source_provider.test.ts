import { convertUrlToWikiUrl } from './gitlab_remote_source_provider';

describe('convertUrlToWikiUrl', () => {
  test('should convert urls to wiki urls', () => {
    expect(convertUrlToWikiUrl('git@gitlab.com:username/myproject.git')).toBe(
      'git@gitlab.com:username/myproject.wiki.git',
    );
    expect(convertUrlToWikiUrl('https://gitlab.com/username/myproject.git')).toBe(
      'https://gitlab.com/username/myproject.wiki.git',
    );
    expect(convertUrlToWikiUrl('https://gitlab.com/user.git./myproject.git')).toBe(
      'https://gitlab.com/user.git./myproject.wiki.git',
    );
    expect(convertUrlToWikiUrl('https://gitlab.com/user.git./myproject')).toBe(
      'https://gitlab.com/user.git./myproject',
    );
    expect(convertUrlToWikiUrl('wrong')).toBe('wrong');
  });
});
