<script>
const dayjs = require('dayjs');
const dayjsUtc = require('dayjs/plugin/utc');
const dayjsTimezone = require('dayjs/plugin/timezone');
const dayjsRelativeTime = require('dayjs/plugin/relativeTime');

dayjs.extend(dayjsRelativeTime);
dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);

dayjs.tz.setDefault(Intl.DateTimeFormat().resolvedOptions().timeZone);

export default {
  props: {
    date: {
      type: String,
      required: true,
    },
  },
  computed: {
    dateAgo() {
      return dayjs(this.date).fromNow();
    },
    formatedDate() {
      return dayjs(this.date).format('MMM D, YYYY h:mma [GMT]ZZ');
    },
  },
};
</script>
<template>
  <span v-tooltip="{ content: formatedDate, placement: 'top' }">
    {{ dateAgo }}
  </span>
</template>
<style lang="scss">
.tooltip {
  display: block !important;
  z-index: 10000;

  .tooltip-inner {
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground);
    border-radius: 2px;
    padding: 5px 10px 4px;
  }

  .tooltip-arrow {
    width: 0;
    height: 0;
    border-style: solid;
    position: absolute;
    margin: 5px;
    border-color: var(--vscode-editorWidget-background);
    z-index: 1;
  }

  &[x-placement^='top'] {
    margin-bottom: 5px;

    .tooltip-arrow {
      border-width: 5px 5px 0 5px;
      border-left-color: transparent !important;
      border-right-color: transparent !important;
      border-bottom-color: transparent !important;
      bottom: -5px;
      left: calc(50% - 5px);
      margin-top: 0;
      margin-bottom: 0;
    }
  }

  &[x-placement^='bottom'] {
    margin-top: 5px;

    .tooltip-arrow {
      border-width: 0 5px 5px 5px;
      border-left-color: transparent !important;
      border-right-color: transparent !important;
      border-top-color: transparent !important;
      top: -5px;
      left: calc(50% - 5px);
      margin-top: 0;
      margin-bottom: 0;
    }
  }

  &[x-placement^='right'] {
    margin-left: 5px;

    .tooltip-arrow {
      border-width: 5px 5px 5px 0;
      border-left-color: transparent !important;
      border-top-color: transparent !important;
      border-bottom-color: transparent !important;
      left: -5px;
      top: calc(50% - 5px);
      margin-left: 0;
      margin-right: 0;
    }
  }

  &[x-placement^='left'] {
    margin-right: 5px;

    .tooltip-arrow {
      border-width: 5px 0 5px 5px;
      border-top-color: transparent !important;
      border-right-color: transparent !important;
      border-bottom-color: transparent !important;
      right: -5px;
      top: calc(50% - 5px);
      margin-left: 0;
      margin-right: 0;
    }
  }

  &[aria-hidden='true'] {
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.15s, visibility 0.15s;
  }

  &[aria-hidden='false'] {
    visibility: visible;
    opacity: 1;
    transition: opacity 0.15s;
  }
}
</style>
