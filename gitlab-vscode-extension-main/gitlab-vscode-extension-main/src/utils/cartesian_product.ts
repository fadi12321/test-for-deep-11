/**
 * Combines all elements from the sets.
 *
 * const result = cartesianProduct([1, 2, 3], [4, 5, 6], [7, 8])
 *
 * expect(result).toEqual([
 *   [1, 4, 7],
 *   [1, 4, 8],
 *   [1, 5, 7],
 *   [1, 5, 8],
 *   [1, 6, 7],
 *   [1, 6, 8],
 *   [2, 4, 7],
 *   [2, 4, 8],
 *   [2, 5, 7],
 *   [2, 5, 8],
 *   [2, 6, 7],
 *   [2, 6, 8],
 *   [3, 4, 7],
 *   [3, 4, 8],
 *   [3, 5, 7],
 *   [3, 5, 8],
 *   [3, 6, 7],
 *   [3, 6, 8]
 * ])
 */
export const cartesianProduct = <T>(...sets: T[][]) =>
  sets.reduce<T[][]>(
    (accSets, set) => accSets.flatMap(accSet => set.map(value => [...accSet, value])),
    [[]],
  );
