import { mount } from '@vue/test-utils';
import LabelNote from './LabelNote';

const addedLabelEvent = require('../../../../test/integration/fixtures/rest/label_events/added_normal.json');
const scopedLabelEvent = require('../../../../test/integration/fixtures/rest/label_events/added_scoped.json');

describe('LabelNote', () => {
  let wrapper;
  const tooltipDirective = jest.fn();

  beforeEach(() => {
    tooltipDirective.mockReset();
    window.vsCodeApi = { postMessage: jest.fn() };
  });
  describe('added normal event', () => {
    beforeEach(() => {
      wrapper = mount(LabelNote, {
        propsData: {
          noteable: addedLabelEvent,
        },
        stubs: {
          date: true,
        },
        directives: {
          tooltip: tooltipDirective,
        },
      });
    });
    it('contains correct text', () => {
      expect(wrapper.text()).toBe('Tomas Vik  @viktomas added Category:Editor Extension  label ·');
    });

    describe('label pill', () => {
      it('has correct colors', () => {
        expect(wrapper.find('.label-pill').attributes().style).toBe(
          'background-color: rgb(66, 139, 202); color: rgb(255, 255, 255); border-color: #428bca;',
        );
      });

      it('has correct tooltip', () => {
        expect(tooltipDirective.mock.calls[0][1].value).toBe(
          'Issues related to the Editor Extension category: https://about.gitlab.com/direction/create/editor_extension/',
        );
      });
    });
  });

  describe('added scoped event', () => {
    beforeEach(() => {
      wrapper = mount(LabelNote, {
        propsData: {
          noteable: scopedLabelEvent,
        },
        stubs: {
          date: true,
        },
        directives: {
          tooltip: tooltipDirective,
        },
      });
    });
    it('contains correct text', () => {
      expect(wrapper.text()).toBe('Tomas Vik  @viktomas added group code review label ·');
    });

    describe('label pill', () => {
      it('has correct colors', () => {
        expect(wrapper.find('.label-pill').attributes().style).toBe(
          'background-color: rgb(168, 214, 149); color: rgb(51, 51, 51); border-color: #a8d695;',
        );
      });

      it('has scoped label with inverted colors inside', () => {
        expect(wrapper.find('.scoped-pill').attributes().style).toBe(
          'background-color: rgb(51, 51, 51); color: rgb(168, 214, 149);',
        );
      });
    });
  });
});
