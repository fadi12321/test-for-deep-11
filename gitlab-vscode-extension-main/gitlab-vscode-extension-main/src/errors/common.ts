export const prettyJson = (obj: Record<string, unknown> | unknown[]): string =>
  JSON.stringify(obj, null, 2);
export const stackToArray = (stack: string | undefined): string[] => (stack ?? '').split('\n');

export interface DetailedError extends Error {
  readonly details: Record<string, unknown>;
}

export function isDetailedError(object: any): object is DetailedError {
  return Boolean(object.details);
}
