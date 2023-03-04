export const isEqual = (a: any, b: any): boolean => {
  if (!(a instanceof Object)) return a === b;
  // if the number of keys is different, they are different
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }

  return Object.keys(a).every(key => isEqual(a[key], b[key]));
};
