<script>
export default {
  props: {
    replyId: {
      type: String,
      default: undefined,
    },
  },
  data() {
    return {
      note: '',
      isSaving: false,
      isFailed: false,
      command: 'saveNote',
    };
  },
  computed: {
    buttonTitle() {
      return this.isSaving ? 'Saving...' : 'Comment';
    },
    canSubmit() {
      return !this.isSaving && this.note.length > 0;
    },
    isThreadReply() {
      return Boolean(this.replyId);
    },
  },
  methods: {
    addComment() {
      if (!this.canSubmit) {
        return;
      }

      const { note, command, replyId } = this;

      this.isSaving = true;
      this.isFailed = false;
      window.vsCodeApi.postMessage({ command, note, replyId });
    },
    handleKeydown({ key, ctrlKey, shiftKey, metaKey, altKey }) {
      if (key === 'Enter' && (ctrlKey || metaKey) && !shiftKey && !altKey) {
        this.addComment();
      }
    },
    cancelEdit() {
      this.$emit('cancel-edit');
    },
  },
  mounted() {
    window.addEventListener('message', event => {
      if (event.data.type === 'noteSaved') {
        if (event.data.status !== false) {
          this.note = '';
          this.cancelEdit();
        } else {
          this.isFailed = true;
        }

        this.isSaving = false;
      }
    });
  },
};
</script>

<template>
  <div class="main-comment-form" :class="{ 'thread-reply': isThreadReply }">
    <textarea v-model="note" @keydown="handleKeydown" placeholder="Write a comment..." />
    <button class="primary js-submit" @click="addComment" :disabled="!canSubmit">
      {{ buttonTitle }}
    </button>
    <button class="secondary js-cancel" v-if="isThreadReply" @click="cancelEdit">Cancel</button>
    <span v-if="isFailed">Failed to save your comment. Please try again.</span>
  </div>
</template>

<style lang="scss">
.main-comment-form {
  margin: 20px 0 30px 0;
  background: var(--vscode-editor-background);
  &.thread-reply {
    padding: 30px;
    margin: 0px;
  }

  textarea {
    width: 100%;
    min-height: 140px;
    border-radius: 4px;
    padding: 16px;
    font-size: 13px;
    box-sizing: border-box;
    border: 1px solid var(--vscode-input-border);
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    resize: vertical;
    margin-bottom: 8px;
    outline: 0;

    &:focus {
      box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }
  }

  button {
    border: 0;
    padding: 6px 10px;
    font-size: 14px;
    outline: 0;
    margin-right: 10px;
    cursor: pointer;

    &.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      &:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
    }

    &.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      &:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
      }
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
