import { mount } from '@vue/test-utils';
import CommentForm from './CommentForm';

const getSubmitButton = wrapper => wrapper.find('.js-submit');
const getCancelButton = wrapper => wrapper.find('.js-cancel');

describe('CommentForm', () => {
  let wrapper;

  beforeEach(() => {
    window.vsCodeApi = { postMessage: jest.fn() };
  });

  describe('not a part of a discussion thread', () => {
    beforeEach(() => {
      wrapper = mount(CommentForm, {
        propsData: {},
      });
    });

    it("doesn't show cancel button", async () => {
      expect(getCancelButton(wrapper).exists()).toBe(false);
    });

    describe('upon submitting the message', () => {
      beforeEach(async () => {
        await wrapper.find('textarea').setValue('test message');
        await getSubmitButton(wrapper).trigger('click');
      });

      it('sends out VS Code event', () => {
        expect(window.vsCodeApi.postMessage).toHaveBeenCalledWith({
          command: 'saveNote',
          note: 'test message',
        });
      });

      it('indicates the message is being sent', () => {
        expect(getSubmitButton(wrapper).text()).toBe('Saving...');
      });

      it('handles success', async () => {
        const event = new Event('message');
        event.data = { type: 'noteSaved' };
        await window.dispatchEvent(event);
        expect(wrapper.find('textarea').element.value).toBe('');
      });

      it('handles failure', async () => {
        const event = new Event('message');
        event.data = { type: 'noteSaved', status: false };
        await window.dispatchEvent(event);
        expect(wrapper.find('textarea').element.value).toBe('test message');
        expect(wrapper.text()).toContain('Failed to save your comment. Please try again.');
      });
    });

    it('submits the message', async () => {
      await wrapper.find('textarea').setValue('test message');
      await getSubmitButton(wrapper).trigger('click');
      expect(window.vsCodeApi.postMessage).toHaveBeenCalledWith({
        command: 'saveNote',
        note: 'test message',
      });
    });
  });

  describe('is a part of a discussion thread', () => {
    beforeEach(() => {
      wrapper = mount(CommentForm, {
        propsData: { replyId: 'testReplyId' },
      });
    });

    it('submits the message with replyId', async () => {
      await wrapper.find('textarea').setValue('test message');
      await getSubmitButton(wrapper).trigger('click');
      expect(window.vsCodeApi.postMessage).toHaveBeenCalledWith({
        command: 'saveNote',
        note: 'test message',
        replyId: 'testReplyId',
      });
    });
  });
});
