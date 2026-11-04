<!-- The log pane's head (actions W4a): the job and how far its log is, whatever the log viewer puts next to them, and the toggles of how a log shows, in every state of the pane as they stay on for the next log (W4e, W4g, W4i, W4j): W wraps, T shows times. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';

import { useCommands } from '@/commands/useCommands.js';
import Kbd from '@/components/Kbd.vue';
import { LocalPreferences } from '@/services/LocalPreferences.js';

import * as l from './WorkflowLogToolbar.loc.js';

defineProps<{
  /** The job's name; `null` while none is known. */
  job: string | null;
  /** "2,086 lines · 176 KB", or what stands in for it. */
  size: string;
  /** The search bar stands in its place, its keys staying on. Not `v-show`, which applies after the render: the log's scroll would be set against a view of the wrong height. */
  hidden?: boolean;
}>();

const emit = defineEmits<{
  /** A toggle was pressed, and has given up the focus. */
  pressed: [];
}>();

defineSlots<{
  /** Before the toggles. */
  default?(): unknown;
}>();

const t = useTranslate();
const preferences = useService(LocalPreferences);

const wrap = preferences.logWrap;
const showTimes = preferences.logTimes;

useCommands(() => [
  {
    id: 'workflowLog.wrap',
    title: t(l.wrapLines),
    section: 'view',
    key: 'W',
    run: toggleWrap,
  },
  {
    id: 'workflowLog.times',
    title: t(l.showTimes),
    section: 'view',
    key: 'T',
    run: toggleTimes,
  },
]);

function toggleWrap() {
  wrap.value = !wrap.value;
}

function toggleTimes() {
  showTimes.value = !showTimes.value;
}

/** A button pressed gives the keys back: Enter and Space do what they do on the page rather than pressing it again. */
function giveKeysBack(event: MouseEvent) {
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.blur();
  }

  emit('pressed');
}
</script>

<template>
  <div :class="[css.workflowLogToolbar, hidden && css.workflowLogToolbar_hidden]">
    <span
      v-if="job !== null"
      :class="css.workflowLogToolbar_job"
      >{{ job }}</span
    >
    <span
      :class="css.workflowLogToolbar_size"
      tid="workflow-log-size"
      >{{ size }}</span
    >
    <span :class="css.workflowLogToolbar_spacer" />
    <slot />
    <button
      type="button"
      :class="[css.workflowLogToolbar_toggle, wrap && css.workflowLogToolbar_toggle_on]"
      :aria-pressed="wrap"
      aria-keyshortcuts="W"
      tid="workflow-log-wrap"
      @click="
        toggleWrap();
        giveKeysBack($event);
      "
    >
      {{ t(l.wrap) }}
      <Kbd keys="W" />
    </button>
    <button
      type="button"
      :class="[css.workflowLogToolbar_toggle, showTimes && css.workflowLogToolbar_toggle_on]"
      :aria-pressed="showTimes"
      aria-keyshortcuts="T"
      tid="workflow-log-times"
      @click="
        toggleTimes();
        giveKeysBack($event);
      "
    >
      {{ t(l.times) }}
      <Kbd keys="T" />
    </button>
  </div>
</template>

<style lang="scss" module="css">
.workflowLogToolbar {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-12 0 $spacing-14;
  font-size: $font-size-xs;
  border-bottom: 1px solid $color-border;
}

.workflowLogToolbar_hidden {
  display: none;
}

.workflowLogToolbar_job {
  overflow: hidden;
  font-family: $font-family-mono;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowLogToolbar_size {
  flex: none;
  color: $color-fg-dim;
}

.workflowLogToolbar_spacer {
  flex: 1;
}

.workflowLogToolbar_toggle {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  padding: 0;
  font: inherit;
  color: $color-fg-dim;
  cursor: pointer;
  background: none;
  border: 0;
}

.workflowLogToolbar_toggle_on {
  color: $color-fg;
}
</style>
