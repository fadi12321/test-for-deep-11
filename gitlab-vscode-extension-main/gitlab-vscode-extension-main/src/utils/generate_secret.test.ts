import { generateSecret } from './generate_secret';

describe('generateSecret', () => {
  it.each(
    Array(100)
      .fill('')
      .map(() => generateSecret()),
  )('hash %s is alphanumeric character between 50 and 60 characters', (hash: string) => {
    expect(hash.length).toBeLessThanOrEqual(60);
    expect(hash.length).toBeGreaterThanOrEqual(50);
    expect(hash).toMatch(/^[a-zA-Z0-9]+$/);
  });
});
