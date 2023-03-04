import { log } from '../log';

/**
 * EnsureLatestPromise prevents race conditions when you create the same promise multiple times.
 *
 * Wrap a promise in the `discardIfNotLatest` method if you plan to create that promise
 * multiple times, but you only want the last result.
 *
 * Each promise has to have separate EnsureLatestPromise instance.
 * EnsureLatestPromise is only able to track the order of execution of one function.
 *
 * correct:
 * ```ts
 * const elp = EnsureLatestPromise<User>();
 * addEventListener(async () => {
 *   const user = await elp.discardIfNotLatest(() => getLastUser()); // this can get executed many times
 *   if(!user) return;
 *   setUser(user);
 * }
 * ```
 */
export class EnsureLatestPromise<T> {
  #currentId = 0;

  #getId() {
    this.#currentId += 1;
    return this.#currentId;
  }

  #isLatest(id: number) {
    return this.#currentId === id;
  }

  /**
   *
   * @param f function that returns promise, the expectation is that you'll call discardIfNotLatest many times with the same function
   * @param discardMessage message that will get logged if there has been more recent function call
   * @returns promise result or undefined if there was/is a more recent promise
   */
  async discardIfNotLatest(f: () => Promise<T>, discardMessage?: string): Promise<T | undefined> {
    const id = this.#getId();
    const result = await f();
    if (!this.#isLatest(id)) {
      if (discardMessage) log.info(discardMessage);
      return undefined;
    }
    return result;
  }
}
