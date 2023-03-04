/**
 * This function is [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards)
 * used for narrowing down type for common collection.filter() use case.
 *
 * - Open GitHub issue: https://github.com/microsoft/TypeScript/issues/16069#issuecomment-369374214
 */
export function notNullOrUndefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
