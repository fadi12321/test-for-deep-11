import { mount } from '@vue/test-utils';
import UserAvatar from './UserAvatar';

describe('UserAvatar', () => {
  describe('shows avatar picture', () => {
    it.each`
      responseType | avatarUrlPropName
      ${'REST'}    | ${'avatar_url'}
      ${'GraphQL'} | ${'avatarUrl'}
    `(
      'contains correct url for $responseType response ($avatarUrlPropName)',
      ({ avatarUrlPropName }) => {
        const wrapper = mount(UserAvatar, {
          propsData: {
            user: {
              name: 'John Doe',
              username: 'johndoe',
              [avatarUrlPropName]: 'https://example.com/avatar.jpg',
            },
          },
        });
        const avatarImg = wrapper.find('.js-avatar');
        expect(avatarImg.attributes().src).toBe('https://example.com/avatar.jpg');
      },
    );
  });
});
