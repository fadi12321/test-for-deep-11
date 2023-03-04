/** doNotAwait is used to circumvent the otherwise invaluable
 * @typescript-eslint/no-floating-promises rule. This util is meant
 * for informative messages that would otherwise block execution */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const doNotAwait = (promise: Thenable<any>): void => {
  // not waiting for the promise
};
