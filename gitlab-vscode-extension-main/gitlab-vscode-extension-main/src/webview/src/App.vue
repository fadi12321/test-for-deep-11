<script>
import IssuableDetails from './components/IssuableDetails';
import IssuableDiscussions from './components/IssuableDiscussions';
import CommentForm from './components/CommentForm';

const vscode = acquireVsCodeApi();

export default {
  name: 'App',
  data() {
    return {
      isLoading: false,
      issuable: {},
      discussions: [],
    };
  },
  components: {
    IssuableDetails,
    IssuableDiscussions,
    CommentForm,
  },
  created() {
    window.vsCodeApi = vscode;
    this.isLoading = true;

    window.addEventListener('message', event => {
      if (event.data.type === 'issuableFetch') {
        this.issuable = event.data.issuable;
        this.discussions = event.data.discussions;
        this.isLoading = false;
      }
    });

    window.vsCodeApi.postMessage({
      command: 'appReady',
    });
  },
};
</script>

<template>
  <div id="app">
    <p v-if="isLoading" class="loading">
      Fetching issuable details and discussions. This may take a while.
      <br />
      If it doesn't work, please
      <a href="https://gitlab.com/gitlab-org/gitlab-vscode-extension/issues/new" class="hello"
        >create an issue.</a
      >
    </p>
    <template v-else>
      <issuable-details :issuable="issuable" />
      <issuable-discussions :discussions="discussions" />
      <comment-form />
    </template>
  </div>
</template>

<style lang="scss">
.issuable-details .state {
  color: var(--vscode-foreground);
}

.capitalize {
  text-transform: capitalize;
}

.code {
  padding: 2px 4px;
  color: var(--vscode-editor-foreground);
  background-color: var(--vscode-textCodeBlock-background);
  border-radius: 4px;
  border-color: var(--vscode-textBlockQuote-border);
  font-family: var(--vscode-editor-font-family);
  font-weight: var(--vscode-editor-font-weight);
  font-size: var(--vscode-editor-font-size);
}

.idiff.deletion {
  background: var(--vscode-diffEditor-removedTextBackground);
  border-color: var(--vscode-diffEditor-removedTextBorder);
}

.idiff.addition {
  background: var(--vscode-diffEditor-insertedTextBackground);
  border-color: var(--vscode-diffEditor-insertedTextBorder);
}

#app {
  margin-bottom: 600px; // to give editor scroll past end effect
  max-width: 960px;
  .loading {
    text-align: center;
    font-size: 14px;
    line-height: 30px;
  }
}
</style>
