import { makeHtmlLinksAbsolute } from './make_html_links_absolute';

describe('makeHtmlLinksAbsolute', () => {
  it('replaces GitLab lazy-load image attributes for relative URLs', () => {
    const img =
      '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="image" class="lazy gfm" data-src="/gitlab-org/gitlab-vscode-extension/uploads/579142d40b64825a32ad658221146d37/image.png" data-canonical-src="/uploads/579142d40b64825a32ad658221146d37/image.png">';
    expect(makeHtmlLinksAbsolute(img, 'https://gitlab.com')).toBe(
      '<img ignore-src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="image" class="lazy gfm" src="https://gitlab.com/gitlab-org/gitlab-vscode-extension/uploads/579142d40b64825a32ad658221146d37/image.png" data-canonical-src="/uploads/579142d40b64825a32ad658221146d37/image.png">',
    );
  });

  it('replaces GitLab lazy-load image attributes for absolute URLs', () => {
    const img =
      '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="image" class="lazy gfm" data-src="https://gitlab.com/viktomas/test-project/uploads/b386695a1e3172d6023ad911e51a427b/image.png" data-canonical-src="/uploads/b386695a1e3172d6023ad911e51a427b/image.png">';
    expect(makeHtmlLinksAbsolute(img, 'https://gitlab.com')).toBe(
      '<img ignore-src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="image" class="lazy gfm" src="https://gitlab.com/viktomas/test-project/uploads/b386695a1e3172d6023ad911e51a427b/image.png" data-canonical-src="/uploads/b386695a1e3172d6023ad911e51a427b/image.png">',
    );
  });

  it('ignores src attributes without "data-" prefix', () => {
    const src = 'make sure the attribute is src="/relative"';
    expect(makeHtmlLinksAbsolute(src, 'https://gitlab.com')).toBe(
      'make sure the attribute is src="/relative"',
    );
  });

  it('replaces GitLab issue links', () => {
    const img =
      '<a href="/gitlab-org/gitlab-vscode-extension/-/issues/384" data-original="#384" data-link="false" data-link-reference="false" data-project="5261717" data-issue="86774523" data-reference-type="issue" data-container="body" data-placement="top" title="Change TreeView to list repositories first and then filters" class="gfm gfm-issue has-tooltip">#384</a>';
    expect(makeHtmlLinksAbsolute(img, 'https://gitlab.com')).toBe(
      '<a href="https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/384" data-original="#384" data-link="false" data-link-reference="false" data-project="5261717" data-issue="86774523" data-reference-type="issue" data-container="body" data-placement="top" title="Change TreeView to list repositories first and then filters" class="gfm gfm-issue has-tooltip">#384</a>',
    );
  });
});
