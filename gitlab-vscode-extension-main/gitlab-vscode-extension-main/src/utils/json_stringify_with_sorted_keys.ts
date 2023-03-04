/**
 * Strings produced by this method are always equal if the `object`s were equal.
 * This is achieved by serializing the keys in deterministic order.
 */
export const jsonStringifyWithSortedKeys = (object: {
  [k: string | symbol | number]: string | number | symbol | undefined;
}) => JSON.stringify(object, Object.keys(object).sort());
