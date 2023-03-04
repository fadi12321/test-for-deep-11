<script>
import NoteBody from './NoteBody';
import UserAvatar from './UserAvatar';
import icons from '../assets/icons';
import Date from './Date';
import { SafeHtmlDirective } from '../directives/safe_html/safe_html';

export default {
  props: {
    noteable: {
      type: Object,
      required: true,
    },
  },
  directives: {
    SafeHtml: SafeHtmlDirective,
  },
  components: {
    NoteBody,
    UserAvatar,
    Date,
  },
  computed: {
    author() {
      return this.noteable.author;
    },
  },
  created() {
    this.icon = icons.gitLabLogo;
    this.multiLine = false;
    this.firstLine = '';
    if (this.noteable.body.match(/commit/)) {
      this.icon = icons.commit;
    }
    if (this.noteable.body.match(/moved/)) {
      this.icon = icons.arrow_right;
    }
    if (this.noteable.body.match(/description/)) {
      this.icon = icons.pencil_square;
    }
    if (this.noteable.body.match(/merge/)) {
      this.icon = icons.git_merge;
    }
    if (this.noteable.body.match(/merged/)) {
      this.icon = icons.git_merge;
    }
    if (this.noteable.body.match(/opened/)) {
      this.icon = icons.issue_open;
    }
    if (this.noteable.body.match(/closed/)) {
      this.icon = icons.issue_close;
    }
    if (this.noteable.body.match(/time estimate/)) {
      this.icon = icons.timer;
    }
    if (this.noteable.body.match(/time spent/)) {
      this.icon = icons.timer;
    }
    if (this.noteable.body.match(/assigned/)) {
      this.icon = icons.user;
    }
    if (this.noteable.body.match(/title/)) {
      this.icon = icons.pencil_square;
    }
    if (this.noteable.body.match(/task/)) {
      this.icon = icons.task_done;
    }
    if (this.noteable.body.match(/mentioned in/)) {
      this.icon = icons.comment_dots;
    }
    if (this.noteable.body.match(/branch/)) {
      this.icon = icons.fork;
    }
    if (this.noteable.body.match(/confidential/)) {
      this.icon = icons.eye_slash;
    }
    if (this.noteable.body.match(/visible/)) {
      this.icon = icons.eye;
    }
    if (this.noteable.body.match(/milestone/)) {
      this.icon = icons.clock;
    }
    if (this.noteable.body.match(/discussion/)) {
      this.icon = icons.comment;
    }
    if (this.noteable.body.match(/outdated/)) {
      this.icon = icons.pencil_square;
    }
    if (this.noteable.body.match(/pinned/)) {
      this.icon = icons.thumbtack;
    }
    if (this.noteable.body.match(/duplicate/)) {
      this.icon = icons.issue_duplicate;
    }
    if (this.noteable.body.match(/locked/)) {
      this.icon = icons.lock;
    }
    if (this.noteable.body.match(/unlocked/)) {
      this.icon = icons.lock_open;
    }
    if (this.noteable.body.match(/due date/)) {
      this.icon = icons.calendar;
    }
    if (this.noteable.body.match(/Compare with/)) {
      this.icon = icons.timeline;
      const { body } = this.noteable;
      const lines = body.split('\n');
      // FIXME: disabling rule to limit changes to production code when introducing eslint
      // eslint-disable-next-line prefer-destructuring
      this.firstLine = lines[0];
      lines.splice(0, 1);
      this.noteable.body = lines.join('\n');
      this.multiLine = true;
    }
  },
};
</script>

<template>
  <li class="note system-note">
    <div class="timeline-entry-inner">
      <div class="timelineIcon">
        <span v-safe-html="icon" />
      </div>
      <div class="timelineContent" v-if="multiLine">
        <div class="note-header">
          <user-avatar :user="author" :show-avatar="false" style="margin-right: 2px" />
          {{ firstLine }} <date :date="noteable.createdAt" style="margin-left: 2px" />
        </div>
        <note-body :note="noteable" style="margin-left: 25px" />
      </div>
      <div class="timelineContent" v-if="!multiLine">
        <div class="note-header">
          <user-avatar :user="author" :show-avatar="false" style="margin-right: 2px" />
          <note-body :note="noteable" style="margin-right: 2px" /> ·
          <date :date="noteable.createdAt" style="margin-left: 2px" />
        </div>
      </div>
    </div>
  </li>
</template>

<style lang="scss">
.system-note {
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

  ul {
    list-style-type: disc;
    padding-inline-start: 16px;
  }
}
</style>
