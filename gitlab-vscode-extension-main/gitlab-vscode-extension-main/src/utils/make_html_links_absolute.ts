export const makeHtmlLinksAbsolute = (html: string, instanceUrl: string): string =>
  html
    .replace(/\shref="\//gm, ` href="${instanceUrl}/`)
    .replace(/\sdata-src="\//gm, ` src="${instanceUrl}/`)
    .replace(/\sdata-src="/gm, ` src="`)
    .replace(/\ssrc="data:/gm, ' ignore-src="data:');
