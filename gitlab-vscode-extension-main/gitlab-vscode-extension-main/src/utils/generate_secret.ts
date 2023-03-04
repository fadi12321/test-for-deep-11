import crypto from 'crypto';

/** Generates a random alphanumeric string between 50 and 60 characters long */
export const generateSecret = (): string => {
  const secret = crypto.randomBytes(44).toString('base64');
  const alphanumericSecret = secret.replace(/[^a-zA-Z0-9]/g, '');
  return alphanumericSecret.length >= 50 ? alphanumericSecret : generateSecret();
};
