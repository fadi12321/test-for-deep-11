<script>
import UserAvatar from './UserAvatar';
import Date from './Date';
import { SafeHtmlDirective } from '../directives/safe_html/safe_html';

export default {
  name: 'Note',
  directives: {
    SafeHtml: SafeHtmlDirective,
  },
  props: {
    noteable: {
      type: Object,
      required: true,
    },
  },
  components: {
    UserAvatar,
    Date,
  },
  computed: {
    author() {
      return this.noteable.author;
    },
  },
  mounted() {
    this.initializeSuggestions();
  },
  methods: {
    initializeSuggestions() {
      const suggestions = this.$el.querySelectorAll('pre.language-suggestion');
      suggestions.forEach(suggestionEl => {
        const initializedSuggestionHtml = `
          <div class="suggestion">
            <div class="header">
              <strong>Suggested change:</strong>
              <emphasis><a href="${this.noteable.url}">open on the web</a></emphasis>
            </div>
            ${suggestionEl.outerHTML}
          </div>
          `;
        const initializedSuggestionEl = document.createElement('div');
        initializedSuggestionEl.innerHTML = initializedSuggestionHtml;
        suggestionEl.parentNode.insertBefore(initializedSuggestionEl, suggestionEl);
        suggestionEl.remove();
      });
    },
  },
};
</script>

<template>
  <li class="note">
    <div class="timeline-entry-inner">
      <div class="timelineIcon">
        <user-avatar :user="author" :size="40" :show-username="false" />
      </div>
      <div class="timelineContent">
        <div class="note-header">
          <user-avatar :user="author" :size="40" :show-avatar="false" style="margin-right: 2px" />
          ·
          <date :date="noteable.createdAt" style="margin-left: 2px" />
        </div>
        <div class="note-body">
          <div class="body" v-safe-html="noteable.bodyHtml" />
        </div>
      </div>
    </div>
  </li>
</template>

<style lang="scss">
.note {
  border: 1px solid;
  border-radius: 4px;
  padding: 16px;
  margin: 16px 0;
  box-sizing: border-box;
  display: block;

  .timeline-entry-inner {
    display: flex;
  }

  .timelineContent {
    width: 100%;
  }

  .note-header {
    display: flex;
    min-height: 29px;
  }

  .note-body {
    display: block;
  }

  table:not(.code) {
    margin: 16px 0;
    border: 0;
    width: auto;
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
  }

  table:not(.code) tbody td {
    border: 1px solid;
    border-color: var(--vscode-panel-border);
    border-collapse: collapse;
    border-image-repeat: stretch;
    padding-bottom: 10px;
    padding-left: 16px;
    padding-right: 16px;
    padding-top: 10px;
    text-align: start;
    text-size-adjust: 100%;
    vertical-align: middle;
    box-sizing: border-box;
  }

  table:not(.code) thead th {
    border-bottom: 2px solid;
    border-right: 1px solid;
    border-left: 1px solid;
    border-top: 1px solid;
    border-color: var(--vscode-panel-border);
    border-collapse: collapse;
    border-image-repeat: stretch;
    padding-bottom: 10px;
    padding-left: 16px;
    padding-right: 16px;
    padding-top: 10px;
    text-align: start;
    text-size-adjust: 100%;
    vertical-align: middle;
    box-sizing: border-box;
  }

  .suggestion {
    border: 1px solid;
    border-radius: 4px;
    border-color: var(--vscode-panel-border);
    margin-top: 1em;
    margin-bottom: 1em;
    .header {
      padding: 16px;
      background-color: var(--vscode-input-background);
      display: flex;
      justify-content: space-between;
    }
  }

  pre.language-suggestion {
    margin: 0;
    padding: 16px;
    code {
      display: flex;
      flex-direction: column;
      color: var(--vscode-gitDecoration-addedResourceForeground);
    }
    .line::before {
      content: '+ ';
    }
  }
}
</style>
