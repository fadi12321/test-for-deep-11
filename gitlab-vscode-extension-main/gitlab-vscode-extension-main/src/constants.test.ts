import { promises as fs } from 'fs';
import * as path from 'path';
import { README_SECTIONS } from './constants';

describe('readme sections', () => {
  const headings: string[] = [];

  beforeAll(async () => {
    const readme = await fs.readFile(path.join(__dirname, '..', 'README.md'), 'utf-8');

    readme.replace(/^#+(.*)$/gm, (s, heading) => {
      headings.push((heading as string).trim().toLowerCase().replace(/\W/g, '-'));
      return s;
    });
  });

  it.each(Object.values(README_SECTIONS))('Readme contains "%s" section', (section: string) => {
    expect(headings).toContain(section);
  });
});
