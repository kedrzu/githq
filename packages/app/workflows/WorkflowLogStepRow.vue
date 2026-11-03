<!-- A step's head in the log viewer (actions W4a): whether it is folded and how it went, its name, the lines it holds, a search's matches in it and how long it took. Pressing it folds or opens the step; a step with no lines has nothing to fold. The same in the document and stuck to the top of the view. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, ChevronDown, ChevronRight, CircleSlash, CircleX } from 'lucide-vue-next';
import { computed } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type { LogSection } from './buildLogDocument.js';
import { formatTimeTaken } from './utils/formatTimeTaken.js';
import { getJobMark } from './utils/getJobMark.js';
import * as l from './WorkflowLogStepRow.loc.js';

const props = defineProps<{
  section: LogSection;
  /** The numbers of the first and last lines it holds; `null` with none. */
  range: { readonly first: number; readonly last: number } | null;
  /** The cursor's line is folded under it. */
  cursor?: boolean;
  /** A search's matches in it, folded or not; none when there is no count to tell. */
  matchCount?: number;
}>();

const emit = defineEmits<{
  /** Folded or opened. */
  toggle: [];
}>();

const NUMBER_FORMAT = new Intl.NumberFormat(APP_LANGUAGE);

const t = useTranslate();

const mark = computed(() => (props.section.step ? getJobMark(props.section.step) : 'none'));
const icon = computed(() => {
  switch (mark.value) {
    case 'failed':
      return CircleX;
    case 'passed':
      return Check;
    case 'running':
    case 'waiting':
    case 'skipped':
    case 'none':
      return CircleSlash;
    default:
      return assertNever(mark.value);
  }
});
const meta = computed(() => {
  if (props.range) {
    return props.range.first === props.range.last
      ? t(l.oneLine, { line: props.range.first })
      : t(l.lineRange, props.range);
  }

  return mark.value === 'skipped' ? t(l.skipped) : t(l.noLines);
});
const taken = computed(() => {
  const { startedAt, completedAt } = props.section.step ?? {};
  return startedAt && completedAt && props.range ? formatTimeTaken(startedAt, completedAt) : null;
});
</script>

<template>
  <button
    type="button"
    :class="[css.workflowLogStepRow, cursor && css.workflowLogStepRow_cursor]"
    :disabled="!range"
    :aria-expanded="range ? !section.folded : undefined"
    :data-mark="mark"
    @click="emit('toggle')"
  >
    <component
      :is="section.folded || !range ? ChevronRight : ChevronDown"
      :class="css.workflowLogStepRow_chevron"
      aria-hidden="true"
    />
    <component
      :is="icon"
      :class="[css.workflowLogStepRow_mark, mark === 'failed' && css.workflowLogStepRow_mark_failed]"
      aria-hidden="true"
    />
    <span :class="[css.workflowLogStepRow_name, !range && css.workflowLogStepRow_name_empty]">{{
      section.step?.name
    }}</span>
    <span :class="css.workflowLogStepRow_meta">{{ meta }}</span>
    <span :class="css.workflowLogStepRow_spacer" />
    <span
      v-if="matchCount"
      :class="css.workflowLogStepRow_matches"
      tid="workflow-log-step-matches"
      >{{ t(l.matches, { count: matchCount, shown: NUMBER_FORMAT.format(matchCount) }) }}</span
    >
    <span
      v-if="taken"
      :class="css.workflowLogStepRow_time"
      >{{ taken }}</span
    >
  </button>
</template>

<style lang="scss" module="css">
.workflowLogStepRow {
  display: flex;
  gap: $spacing-7;
  align-items: center;
  width: 100%;
  height: 26px;
  padding: 0 $spacing-12 0 $spacing-10;
  font-family: $font-family-sans;
  color: $color-fg;
  text-align: left;
  cursor: pointer;
  background: $color-bg-2;
  border: 0;
  border-bottom: 1px solid $color-border;

  &:disabled {
    cursor: default;
  }
}

.workflowLogStepRow_cursor {
  @include row-selected;
}

.workflowLogStepRow_chevron,
.workflowLogStepRow_mark {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}

.workflowLogStepRow_mark_failed {
  color: $color-red;
}

.workflowLogStepRow_name {
  overflow: hidden;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowLogStepRow_name_empty {
  color: $color-fg-dim;
}

.workflowLogStepRow_meta {
  flex: none;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.workflowLogStepRow_spacer {
  flex: 1;
}

.workflowLogStepRow_matches {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-3xs;
  color: $color-accent;
}

.workflowLogStepRow_time {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-3xs;
  color: $color-fg-dim;
}
</style>
