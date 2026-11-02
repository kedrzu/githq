<!-- A workflow unfolded in place in its repository's Workflows tab (actions W3b), under its row: a ref filter — every ref, or one seen in its runs; F types one, Enter takes it (the first seen ref holding what was typed, or the ref typed), Esc leaves the field; Esc on the screen shows every ref again —, then its runs, one line each (`WorkflowRunLine`), the newest first: the ones kept at once, older ones read on demand below them as the end comes into view ("Reading older runs…"). A read GitHub fails is said under the runs, as a line the tab's keys select: Enter or a click asks again. The tab's keys select the lines; the caller says which one is. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useIntersectionObserver } from '@nzyme/vue-utils/useIntersectionObserver.js';
import { TriangleAlert } from 'lucide-vue-next';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Kbd from '@/components/Kbd.vue';

import type { UnfoldedWorkflow, UnfoldedRun } from './buildUnfoldedWorkflow.js';
import * as l from './UnfoldedWorkflowRuns.loc.js';
import { matchTypedRef } from './utils/matchTypedRef.js';
import WorkflowRunLine from './WorkflowRunLine.vue';

const props = defineProps<{
  /** The workflow's name, which the runs are named after. */
  name: string;
  unfolded: UnfoldedWorkflow;
  /** Epoch ms the ages are counted to. */
  now: number;
  /** The tab's selected row's key: a run's (`run:<id>`) or {@link retryKey}'s marks its line. */
  selectedKey: string | null;
  /** The key of the line that asks again after a failed read, as the tab's rows know it. */
  retryKey: string;
}>();

const emit = defineEmits<{
  /** A ref picked or typed; `null`: every ref. */
  filter: [ref: string | null];
  /** A run's line clicked: the caller opens the run. */
  openRun: [line: UnfoldedRun];
  /** The end came into view, or the failed read's line was clicked: the caller reads older runs. */
  readMore: [];
}>();

/** At most this many refs are offered as chips; any other is typed. */
const MAX_REF_CHIPS = 6;

const t = useTranslate();
const end = useTemplateRef('end');
const field = useTemplateRef('field');

/** What is typed in the ref field; `null` while the field is closed. */
const typed = ref<string | null>(null);

const chips = computed(() => {
  const text = typed.value?.trim().toLowerCase() ?? '';
  const { refs, ref: active } = props.unfolded;
  const shown = refs.filter(name => name.toLowerCase().includes(text)).slice(0, MAX_REF_CHIPS);
  // The ref filtered by stays in sight, whatever is typed.
  return active !== null && !shown.includes(active) ? [...shown, active] : shown;
});
const empty = computed(() => {
  const { runs, complete, ref: active } = props.unfolded;
  if (runs.length > 0 || !complete) {
    return null;
  }

  return active === null ? t(l.noRuns) : t(l.noRunsOn, { ref: active });
});
const endVisibility = useIntersectionObserver({ element: end });

// Older runs are read while the end is in view, a page at a time, until there are none.
watch(
  () => [endVisibility.isIntersecting, props.unfolded.status, props.unfolded.complete] as const,
  ([visible, status, complete]) => {
    if (visible && status === 'idle' && !complete) {
      emit('readMore');
    }
  },
);

useCommands(() => [
  { id: 'workflows.filterRef', title: t(l.filterRef), section: 'view', key: 'F', run: openField },
  {
    id: 'workflows.clearRef',
    title: t(l.clearRef),
    section: 'view',
    key: 'Escape',
    menu: false,
    when: () => props.unfolded.ref !== null,
    run: () => emit('filter', null),
  },
]);

function openField() {
  typed.value = '';
  void nextTick(() => field.value?.focus());
}

function onFieldKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Enter':
      event.preventDefault();
      emit('filter', matchTypedRef(typed.value ?? '', props.unfolded.refs));
      typed.value = null;
      return;
    case 'Escape':
      event.preventDefault();
      typed.value = null;
  }
}

function pick(name: string | null) {
  typed.value = null;
  emit('filter', name);
}
</script>

<template>
  <div
    :class="css.unfoldedWorkflowRuns"
    role="group"
    :aria-label="t(l.label, { name })"
  >
    <div :class="css.unfoldedWorkflowRuns_filter">
      <span :class="css.unfoldedWorkflowRuns_filterLabel">{{ t(l.ref) }}</span>
      <input
        v-if="typed !== null"
        ref="field"
        v-model="typed"
        :class="css.unfoldedWorkflowRuns_field"
        type="text"
        :aria-label="t(l.filterRef)"
        :placeholder="t(l.typeRef)"
        @keydown="onFieldKeydown"
      />
      <button
        type="button"
        :class="[css.unfoldedWorkflowRuns_chip, unfolded.ref === null && css.unfoldedWorkflowRuns_chip_on]"
        :aria-pressed="unfolded.ref === null"
        @click="pick(null)"
      >
        {{ t(l.allRefs) }}
      </button>
      <button
        v-for="chip in chips"
        :key="chip"
        type="button"
        :class="[
          css.unfoldedWorkflowRuns_chip,
          css.unfoldedWorkflowRuns_chip_ref,
          unfolded.ref === chip && css.unfoldedWorkflowRuns_chip_on,
        ]"
        :aria-pressed="unfolded.ref === chip"
        @click="pick(chip)"
      >
        {{ chip }}
      </button>
      <Kbd
        v-if="typed === null"
        keys="F"
      />
    </div>

    <WorkflowRunLine
      v-for="line in unfolded.runs"
      :key="line.key"
      :data-workflow-key="line.key"
      :run="line.run"
      :git-ref="line.ref"
      :now="now"
      :selected="line.key === selectedKey"
      @open="emit('openRun', line)"
    />

    <p
      v-if="empty"
      :class="css.unfoldedWorkflowRuns_note"
    >
      {{ empty }}
    </p>
    <button
      v-if="unfolded.status === 'failed'"
      type="button"
      :class="[css.unfoldedWorkflowRuns_failed, retryKey === selectedKey && css.unfoldedWorkflowRuns_failed_selected]"
      :data-workflow-key="retryKey"
      :aria-current="retryKey === selectedKey ? 'true' : undefined"
      @click="emit('readMore')"
    >
      <TriangleAlert
        :class="css.unfoldedWorkflowRuns_failedIcon"
        aria-hidden="true"
      />
      {{ t(l.readFailed) }}
      <span :class="css.unfoldedWorkflowRuns_retry">
        <Kbd keys="Enter" />
        {{ t(l.retry) }}
      </span>
    </button>
    <p
      v-else-if="!unfolded.complete"
      ref="end"
      :class="css.unfoldedWorkflowRuns_note"
    >
      <template v-if="unfolded.status === 'reading'">{{ t(l.readingOlder) }}</template>
    </p>
  </div>
</template>

<style lang="scss" module="css">
.unfoldedWorkflowRuns {
  padding: $spacing-4 0 $spacing-6;
  background: $color-bg-2;
  border-top: 1px solid $color-border;
  border-bottom: 1px solid $color-border;
}

.unfoldedWorkflowRuns_filter {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
  padding: $spacing-6 $spacing-16 $spacing-6 $workflow-run-indent;
  overflow: hidden;
}

.unfoldedWorkflowRuns_filterLabel {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.unfoldedWorkflowRuns_field {
  flex: none;
  width: 180px;
  height: 22px;
  padding: 0 $spacing-7;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: 5px;

  &:focus-visible {
    outline: 2px solid $color-focus;
    outline-offset: -1px;
  }
}

.unfoldedWorkflowRuns_chip {
  flex: none;
  padding: $spacing-2 $spacing-7;
  font: inherit;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  white-space: nowrap;
  cursor: default;
  background: none;
  border: 1px solid $color-border-2;
  border-radius: 5px;

  &:hover {
    color: $color-fg;
  }

  @include focus-ring;
}

.unfoldedWorkflowRuns_chip_ref {
  font-family: $font-family-mono;
}

.unfoldedWorkflowRuns_chip_on {
  color: $color-fg;
  background: $color-bg-3;
  border-color: $color-bg-3;
}

.unfoldedWorkflowRuns_note {
  min-height: $spacing-4;
  padding: 0 $spacing-16 0 $workflow-run-indent;
  margin: 0;
  font-size: $font-size-xs;
  line-height: 24px;
  color: $color-fg-dim;

  &:empty {
    line-height: $spacing-4;
  }
}

.unfoldedWorkflowRuns_failed {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  height: $workflow-run-line-height;
  padding: 0 $spacing-16 0 $workflow-run-indent;
  font: inherit;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-align: left;
  cursor: default;
  background: none;
  border: none;

  @include workflow-line-button;
}

.unfoldedWorkflowRuns_failed_selected {
  @include row-selected;
}

.unfoldedWorkflowRuns_failedIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-amber;
}

.unfoldedWorkflowRuns_retry {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
  margin-left: auto;
  color: $color-fg-dim;
}
</style>
