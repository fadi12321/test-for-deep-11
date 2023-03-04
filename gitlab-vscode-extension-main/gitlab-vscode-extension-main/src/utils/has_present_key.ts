/**
 * hasPresentKey is a predicate that can be used in collection.filter() function
 * to narrow down the type. hasPresentKey reduces a type where a value for given
 * key can be null or undefined to a type where the value can't be null or undefined.
 *
 * @param key name of a property of an object or key in a map
 * @returns function that takes an object and returns true if the key is not null or undefined
 *
 * Example:
 *
 * const collection = [{a: 1, b: 2}, {a: 3}] // type {a: number, b: number | undefined}[]
 * const result = collection.filter(hasPresentKey('b')) // result type is {a: number, b: number}[], the result is [{a: 1, b: 2}]
 */
export const hasPresentKey =
  <K extends string | number | symbol>(key: K) =>
  <T, V>(a: T & { [k in K]?: V | null }): a is T & { [k in K]: V } =>
    a[key] !== undefined && a[key] !== null;
