import { compare } from './compare';

/** creates a comparison method for T objects that can be used for sorting. Can be replaced with lodash sortBy. */
export const compareBy =
  <T>(key: keyof T): ((a: T, b: T) => -1 | 0 | 1) =>
  (a: T, b: T) =>
    compare(a[key], b[key]);
