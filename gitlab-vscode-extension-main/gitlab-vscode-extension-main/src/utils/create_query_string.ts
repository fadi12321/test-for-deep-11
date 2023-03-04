import { notNullOrUndefined } from './not_null_or_undefined';

export type QueryValue = string | boolean | string[] | number | undefined | null;

export const createQueryString = (query: Record<string, QueryValue>): string => {
  const q = new URLSearchParams();
  Object.entries(query).forEach(([name, value]) => {
    if (notNullOrUndefined(value)) {
      q.set(name, `${value}`);
    }
  });
  return q.toString() && `?${q}`;
};
