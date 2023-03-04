import { Credentials } from '../accounts/credentials';

export const testCredentials = (instanceUrl = 'https://gitlab.example.com'): Credentials => ({
  instanceUrl,
  token: 'token',
});
