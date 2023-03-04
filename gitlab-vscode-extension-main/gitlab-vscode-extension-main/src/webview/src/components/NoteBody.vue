<script>
import { SafeHtmlDirective } from '../directives/safe_html/safe_html';

const md = require('markdown-it')().use(require('markdown-it-checkbox'));

export default {
  name: 'NoteBody',
  directives: {
    SafeHtml: SafeHtmlDirective,
  },
  props: {
    note: {
      type: Object,
      required: true,
    },
  },
  computed: {
    renderedNoteBody() {
      return this.note.markdownRenderedOnServer ? this.note.body : md.render(this.note.body);
    },
  },
  mounted() {
    window.vsCodeApi.postMessage({
      command: 'renderMarkdown',
      markdown: this.note.body,
      object: 'note',
      ref: this.note.id,
    });
  },
  created() {
    window.addEventListener('message', event => {
      if (event.data.type === 'markdownRendered') {
        const { ref, object, markdown } = event.data;
        if (object === 'note' && ref === this.note.id) {
          this.note.markdownRenderedOnServer = true;
          this.note.body = markdown;
        }
      }
    });
  },
};
</script>

<template>
  <div class="note-body">
    <div class="body" v-safe-html="renderedNoteBody" />
  </div>
</template>

<style lang="scss">
.note-body {
  word-wrap: break-word;

  .badge {
    padding: 0 8px;
    line-height: 16px;
    border-radius: 36px;
    font-size: 12px;
    display: inline-block;
  }

  .body p {
    &:first-child {
      margin-top: 0;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
