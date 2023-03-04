import { EnsureLatestPromise } from './ensure_latest_promise';

const delay = () =>
  new Promise(res => {
    setTimeout(res, 10);
  });

describe('EnsureLatestPromise', () => {
  let elp: EnsureLatestPromise<string>;

  beforeEach(() => {
    elp = new EnsureLatestPromise();
  });

  it('handles single promise', async () => {
    const result = await elp.discardIfNotLatest(async () => 'a');
    expect(result).toBe('a');
  });

  it('discards older promise', async () => {
    const firstPromise = elp.discardIfNotLatest(async () => {
      await delay();
      return 'a';
    });
    const secondPromise = elp.discardIfNotLatest(async () => 'b');
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toBeUndefined();
    expect(second).toBe('b');
  });
});
