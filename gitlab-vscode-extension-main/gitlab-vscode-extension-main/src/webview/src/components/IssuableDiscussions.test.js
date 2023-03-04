import { mount } from '@vue/test-utils';
import IssuableDiscussions from './IssuableDiscussions';
import Discussion from './Discussion';
import SystemNote from './SystemNote';
import LabelNote from './LabelNote';

const {
  singleNote,
  multipleNotes,
  systemNote,
  note1TextSnippet,
  note2TextSnippet,
  systemNoteTextSnippet,
} = require('../../../../test/integration/fixtures/graphql/discussions');
const labelNote = require('../../../../test/integration/fixtures/rest/label_events/added_normal.json');

const partOfLabelNote = 'added Category:Editor Extension';

describe('IssuableDiscussions', () => {
  beforeEach(() => {
    window.vsCodeApi = { postMessage: jest.fn() };
  });
  it.each`
    name                           | discussion       | component     | noteText
    ${'single note'}               | ${singleNote}    | ${Discussion} | ${note1TextSnippet}
    ${'multiple notes with note1'} | ${multipleNotes} | ${Discussion} | ${note1TextSnippet}
    ${'multiple notes with note2'} | ${multipleNotes} | ${Discussion} | ${note2TextSnippet}
    ${'system note'}               | ${systemNote}    | ${SystemNote} | ${systemNoteTextSnippet}
    ${'label event'}               | ${labelNote}     | ${LabelNote}  | ${partOfLabelNote}
  `('renders $name with correct component and text', ({ discussion, component, noteText }) => {
    const wrapper = mount(IssuableDiscussions, {
      propsData: {
        discussions: [discussion],
      },
      stubs: {
        date: true,
      },
    });
    const discussions = wrapper.findAllComponents(component);
    expect(discussions.length).toBe(1);
    expect(discussions.at(0).text()).toMatch(noteText);
  });
});
