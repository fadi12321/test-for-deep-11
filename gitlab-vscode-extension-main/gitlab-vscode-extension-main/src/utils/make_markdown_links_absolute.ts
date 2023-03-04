export const makeMarkdownLinksAbsolute = (
  markdown: string,
  namespaceWithPath: string,
  instanceUrl: string,
): string =>
  markdown.replace(/\]\(\/uploads\//gm, `](${instanceUrl}/${namespaceWithPath}/uploads/`);
