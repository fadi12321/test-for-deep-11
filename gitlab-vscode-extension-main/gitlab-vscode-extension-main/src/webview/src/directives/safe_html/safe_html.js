/* Copied from https://gitlab.com/gitlab-org/gitlab-ui/-/blob/main/src/directives/safe_html/safe_html.js */
import { sanitize } from 'dompurify';
import { forbiddenDataAttrs } from './constants';

// Mitigate against future dompurify mXSS bypasses by
// avoiding additional serialize/parse round trip.
// See https://gitlab.com/gitlab-org/gitlab-ui/-/merge_requests/1782
// and https://gitlab.com/gitlab-org/gitlab-ui/-/merge_requests/2127
// for more details.
const DEFAULT_CONFIG = { RETURN_DOM_FRAGMENT: true, FORBID_ATTR: [...forbiddenDataAttrs] };

const transform = (el, binding) => {
  if (binding.oldValue !== binding.value) {
    const config = { ...DEFAULT_CONFIG, ...(binding.arg || {}) };

    // eslint-disable-next-line no-param-reassign
    el.textContent = '';
    el.appendChild(sanitize(binding.value, config));
  }
};

// eslint-disable-next-line import/prefer-default-export
export const SafeHtmlDirective = {
  bind: transform,
  update: transform,
};
