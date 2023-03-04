import { mount } from '@vue/test-utils';
import Discussion from './Discussion';
import CommentForm from './CommentForm';

const {
  multipleNotes,
  note1TextSnippet,
  note2TextSnippet,
} = require('../../../../test/integration/fixtures/graphql/discussions');

const getReplyButton = wrapper => wrapper.find('.js-reply');
const getCollapseButton = wrapper => wrapper.find('.js-collapse');
const getCommentForm = wrapper => wrapper.findComponent(CommentForm);

describe('Discussion', () => {
  let wrapper;

  describe('with multiple comments', () => {
    beforeEach(() => {
      wrapper = mount(Discussion, {
        propsData: {
          noteable: multipleNotes,
        },
        stubs: {
          date: true,
        },
      });
    });
    it('shows all comments by default', () => {
      expect(wrapper.text()).toContain(note1TextSnippet);
      expect(wrapper.text()).toContain(note2TextSnippet);
    });

    it('shows reply button', () => {
      expect(getReplyButton(wrapper).exists()).toBe(true);
    });

    describe('collapsing and uncollapsing', () => {
      it('hides reply button and second message when we collapse replies', async () => {
        await getCollapseButton(wrapper).trigger('click');
        expect(wrapper.text()).not.toContain(note2TextSnippet);
        expect(getReplyButton(wrapper).exists()).toBe(false);
      });

      it('shows reply button and the replies if they were uncollapsed', async () => {
        const collapseButton = getCollapseButton(wrapper);
        await collapseButton.trigger('click');
        await collapseButton.trigger('click');
        expect(wrapper.text()).toContain(note2TextSnippet);
        expect(getReplyButton(wrapper).exists()).toBe(true);
      });
    });

    describe('comment form', () => {
      it("doesn't show comment form by default", () => {
        expect(getCommentForm(wrapper).exists()).toBe(false);
      });

      it('opens the comment form when we click reply button', async () => {
        await getReplyButton(wrapper).trigger('click');
        expect(getCommentForm(wrapper).exists()).toBe(true);
      });

      it('hides the comment form when we click cancel button', async () => {
        await getReplyButton(wrapper).trigger('click');
        const commentForm = getCommentForm(wrapper);
        await commentForm.find('.js-cancel').trigger('click');
        expect(getCommentForm(wrapper).exists()).toBe(false);
      });
    });
  });
});
