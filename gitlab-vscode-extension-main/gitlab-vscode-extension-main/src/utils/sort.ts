/** Same as Array.prototype.sort, but copies the original array. It doesn't mutate the arr parameter. */
export const sort = <T>(arr: readonly T[], compareFn?: (a: T, b: T) => number): T[] => {
  const copy = [...arr];
  return copy.sort(compareFn);
};
