<script>
export default {
  props: {
    user: {
      type: Object,
      required: true,
    },
    size: {
      type: Number,
      required: false,
      default: 24,
    },
    showAvatar: {
      type: Boolean,
      required: false,
      default: true,
    },
    showLink: {
      type: Boolean,
      required: false,
      default: true,
    },
    showUsername: {
      type: Boolean,
      required: false,
      default: true,
    },
    showHandle: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  computed: {
    sizeClass() {
      return `s${this.size}`;
    },
    userUrl() {
      return this.user.webUrl || this.user.web_url; // labels contain snake_case variables
    },
    avatarUrl() {
      return this.user.avatarUrl || this.user.avatar_url;
    },
  },
};
</script>

<template>
  <span>
    <component :is="showLink ? 'a' : 'span'" :href="userUrl" target="_blank">
      <img v-if="showAvatar" :src="avatarUrl" :class="sizeClass" class="avatar js-avatar" />
      <span v-if="showUsername" class="author">
        <strong> {{ user.name }}</strong>
        <span v-if="showHandle"> @{{ user.username }}</span>
      </span>
    </component>
  </span>
</template>

<style lang="scss" scoped>
a {
  color: var(--vscode-foreground);
  text-decoration: none;
}
.avatar {
  float: left;
  margin-right: 16px;
  border-radius: 100%;
  max-width: 64px;
  max-height: 64px;
  vertical-align: middle;
  background: var(--vscode-editor-background);
}

.s24 {
  width: 24px;
  height: 24px;
}

.s40 {
  width: 40px;
  height: 40px;
}

.capitalize {
  text-transform: capitalize;
}
</style>
