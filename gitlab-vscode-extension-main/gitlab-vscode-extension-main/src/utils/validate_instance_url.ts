export const validateInstanceUrl = (input: string): string | undefined => {
  if (!/^https?:\/\/.*$/.test(input)) return 'Must begin with http:// or https://';
  try {
    // eslint-disable-next-line no-new
    new URL(input);
  } catch (e) {
    return 'Must be a valid URL';
  }
  return undefined;
};
