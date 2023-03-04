export const isMr = (issuable: RestIssuable): issuable is RestMr =>
  Boolean((issuable as RestMr).sha);
