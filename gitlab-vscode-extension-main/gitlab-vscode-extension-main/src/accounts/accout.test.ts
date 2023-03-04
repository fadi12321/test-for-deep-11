import { serializeAccountSafe } from './account';

describe('accounts/account', () => {
  describe('serializeAccountSafe', () => {
    it('only includes safe properties', () => {
      const safeProps = {
        instanceUrl: 'https://example.com',
        id: 'https://example.com|777',
        username: 'paul',
        scopes: ['api'],
      };

      expect(
        serializeAccountSafe({
          ...safeProps,
          type: 'oauth',
          expiresAtTimestampInSeconds: 1000,
          refreshToken: 'af123',
          token: 'be456',
        }),
      ).toBe(JSON.stringify(safeProps));
    });
  });
});
