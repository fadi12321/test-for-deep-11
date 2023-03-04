<script>
import UserAvatar from './UserAvatar';
import Date from './Date';
import LabelIcon from './icons/LabelIcon';

export default {
  props: {
    noteable: {
      type: Object,
      required: true,
    },
  },
  components: {
    UserAvatar,
    Date,
    LabelIcon,
  },
  computed: {
    author() {
      return this.noteable.user;
    },
    action() {
      return this.noteable.action === 'add' ? 'added' : 'removed';
    },
    labelName() {
      return this.noteable.label.name.split('::')[0];
    },
    scopedName() {
      return this.noteable.label.name.split('::')[1];
    },
  },
};
</script>

<template>
  <li class="note label-note">
    <div class="timeline-entry-inner">
      <div class="timelineIcon">
        <span class="avatar">
          <label-icon />
        </span>
      </div>
      <div class="timelineContent">
        <div class="note-header">
          <user-avatar :user="author" :show-avatar="false" />
          <span class="label-action">{{ action }}</span>
          <span
            class="label-pill"
            v-tooltip="noteable.label.description"
            :style="{
              backgroundColor: noteable.label.color,
              color: noteable.label.text_color,
              borderColor: noteable.label.color,
            }"
          >
            <span class="label-name">{{ labelName }}</span>
            <span
              class="scoped-pill"
              v-if="scopedName"
              :style="{
                backgroundColor: noteable.label.text_color,
                color: noteable.label.color,
              }"
              >{{ scopedName }}</span
            >
          </span>
          <span class="label-divider">label ·</span>
          <date :date="noteable.created_at" />
        </div>
      </div>
    </div>
  </li>
</template>

<style lang="scss">
.label-note {
  border: none;
  padding-bottom: 4px;
  padding-left: 20px;
  padding-right: 20px;
  padding-top: 4px;
  position: static;

  &:last-child {
    // hides the timeline that connects all notes (through avatar pictures)
    background: var(--vscode-editor-background);
  }

  .timelineContent {
    margin-left: 30px;
  }

  .timelineIcon {
    border: 1px solid;
    border-color: var(--vscode-panel-border);
    background: var(--vscode-editor-background);
    display: flex;
    width: 32px;
    height: 32px;
    border-radius: 32px;
    float: left;
    margin-right: 20px;
    margin-top: -6px;

    svg {
      width: 16px;
      height: 16px;
      margin: 7px;
      overflow-x: hidden;
      overflow-y: hidden;
      display: block;
    }
  }

  .note-header {
    align-items: baseline;
    .label-action,
    .label-divider,
    .label-pill {
      margin-right: 3px;
    }
    .label-action {
      margin-left: 3px;
    }
  }

  .label-pill {
    line-height: 1rem;
    font-size: 0.75rem;
    border-radius: 0.6rem; // slightly larger than the line-height because of the 1px border
    border-width: 1px;
    border-style: solid;
    display: flex;
    .label-name,
    .scoped-pill {
      padding: 0 3px;
    }

    .scoped-pill {
      border-top-right-radius: 0.5rem;
      border-bottom-right-radius: 0.5rem;
      height: 100%;
    }
  }

  ul {
    list-style-type: disc;
    padding-inline-start: 16px;
  }
}
</style>
