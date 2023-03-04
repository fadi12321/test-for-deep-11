import { jobLogCache } from './job_log_cache';

describe('JobLogCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    jobLogCache.clearAll();
  });

  it('adds new items', () => {
    expect(jobLogCache.get(123)).toBeUndefined();

    jobLogCache.set(123, 'raw');

    expect(jobLogCache.get(123)?.rawTrace).toBe('raw');
  });

  it('adds decorations to existing items', () => {
    jobLogCache.set(123, 'raw');
    expect(jobLogCache.get(123)?.filtered).toBeUndefined();
    jobLogCache.addDecorations(123, new Map(), new Map(), 'filtered');
    expect(jobLogCache.get(123)?.filtered).toBe('filtered');
  });

  it('removes a single item', async () => {
    jobLogCache.set(123, 'raw');
    expect(jobLogCache.get(123)).toBeDefined();

    const promise = jobLogCache.delete(123);

    jest.runAllTimers();
    await promise;

    expect(jobLogCache.get(123)).toBeUndefined();
  });

  it('aborts a removal when an item is touched', async () => {
    jest.setSystemTime(1665582000);

    jobLogCache.set(123, 'raw');
    expect(jobLogCache.get(123)).toBeDefined();

    jest.setSystemTime();

    const promise = jobLogCache.delete(123);

    jobLogCache.touch(123);

    jest.runAllTimers();
    await promise;

    expect(jobLogCache.get(123)).toBeDefined();
  });

  it('clears everything immediately', () => {
    jobLogCache.set(123, 'raw');
    jobLogCache.set(456, 'raw');
    expect(jobLogCache.get(123)).toBeDefined();
    expect(jobLogCache.get(456)).toBeDefined();

    jobLogCache.clearAll();

    expect(jobLogCache.get(123)).toBeUndefined();
    expect(jobLogCache.get(456)).toBeUndefined();
  });
});
