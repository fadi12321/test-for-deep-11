<script>
import UserAvatar from './UserAvatar';
import Date from './Date';
import { SafeHtmlDirective } from '../directives/safe_html/safe_html';

const md = require('markdown-it')().use(require('markdown-it-checkbox'));

export default {
  props: {
    issuable: {
      type: Object,
      required: true,
    },
  },
  directives: {
    SafeHtml: SafeHtmlDirective,
  },
  components: {
    UserAvatar,
    Date,
  },
  computed: {
    stateText() {
      const states = {
        opened: 'Open',
        closed: 'Closed',
      };

      return states[this.issuable.state] || '';
    },
    description() {
      if (this.issuable.markdownRenderedOnServer) {
        return this.issuable.description;
      }

      const description = this.issuable.description || '';
      const webUrl = this.issuable.web_url || '';
      const path = `${webUrl.split('/issues/')[0]}/uploads/`;
      const normalized = description.replace(/\/uploads/gm, path);

      return md.render(normalized);
    },
  },
  mounted() {
    window.vsCodeApi.postMessage({
      command: 'renderMarkdown',
      markdown: this.issuable.description,
      object: 'issuable',
      ref: this.issuable.id,
    });
  },
  created() {
    window.addEventListener('message', event => {
      if (event.data.type === 'markdownRendered') {
        const { ref, object, markdown } = event.data;
        if (object === 'issuable' && ref === this.issuable.id) {
          this.issuable.markdownRenderedOnServer = true;
          this.issuable.description = markdown;
        }
      }
    });
  },
};
</script>

<template>
  <div class="issuable-details">
    <div class="header">
      <span :class="{ [issuable.state]: true }" class="state">{{ stateText }}</span>
      <span class="capitalize"> opened</span>
      <date :date="issuable.created_at" />
      by
      <user-avatar :user="issuable.author" :show-handle="false" />
      <a :href="issuable.web_url" class="view-link"> Open in GitLab </a>
    </div>
    <div class="title">
      <h2>{{ issuable.title }}</h2>
    </div>
    <div class="description" v-safe-html="description" />
  </div>
</template>

<style lang="scss">
.issuable-details {
  border-bottom: 1px solid;
  border-color: var(--vscode-panel-border);
  line-height: 21px;

  .badge {
    padding: 0 8px;
    line-height: 16px;
    border-radius: 36px;
    font-size: 12px;
    display: inline-block;
  }

  .header {
    padding: 10px 0 6px;
    line-height: 36px;
    margin-bottom: 8px;
    border-bottom: 1px solid;
    border-color: var(--vscode-panel-border);
    position: relative;

    .view-link {
      position: absolute;
      right: 0;
    }

    .state {
      border-radius: 4px;
      padding: 2px 9px;
      margin-right: 5px;
      font-size: 12px;

      &.opened {
        background-color: #2a9d3f;
      }

      &.closed {
        background-color: #1d64c9;
      }
    }
  }

  .description {
    margin-bottom: 16px;
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
}
</style>
