<!-- The search bar, in the log toolbar's place (actions W4b, W4c): the query as typed, plain text, never a pattern; where the search stands ("3 of 12 in 2 steps", or among only the matches "12 lines of 2,086 · in 2 steps"); and what it can do. The field keeps its own keys: Enter next, ⇧Enter previous, as N would type a letter there; Tab only the matches, Esc close, ⌘F selects what is typed. The buttons don't take the focus from it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Search } from 'lucide-vue-next';
import { computed, onBeforeUnmount, useTemplateRef } from 'vue';

import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Kbd from '@/components/Kbd.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type { LogMatches } from './utils/findLogMatches.js';
import * as l from './WorkflowLogSearch.loc.js';

const props = defineProps<{
  /** As typed; the matches follow a moment later. */
  query: string;
  /** What was found; `null` with nothing searched for yet. */
  matches: LogMatches | null;
  /** The match landed on, by its position in the matches. */
  position: number | null;
  /** How many lines the log has. */
  lineTotal: number;
  /** Only the matching lines show. */
  onlyMatches: boolean;
}>();

const emit = defineEmits<{
  'update:query': [query: string];
  next: [];
  previous: [];
  toggleOnly: [];
  close: [];
  /** The field took or lost the focus; it lost it too as the bar goes. */
  fieldFocus: [focused: boolean];
}>();

/** Past it the query scrolls in its field, and what stands beside it stays. */
const MAX_QUERY_WIDTH = 48;
/** "Search log", as the field is empty. */
const PLACEHOLDER_WIDTH = 11;
const NUMBER_FORMAT = new Intl.NumberFormat(APP_LANGUAGE);

const t = useTranslate();
const field = useTemplateRef('field');

/** A mono field as wide as what is in it, which `field-sizing` isn't yet everywhere the app runs. */
const fieldWidth = computed(
  () => `${props.query ? Math.min(MAX_QUERY_WIDTH, props.query.length + 1) : PLACEHOLDER_WIDTH}ch`,
);
const total = computed(() => props.matches?.lines.length ?? 0);
const inSteps = computed(() => {
  const count = props.matches?.steps.size ?? 0;
  return count > 0 ? t(l.inSteps, { count }) : null;
});
const positionText = computed(() => {
  const found = props.matches;
  if (!found) {
    return null;
  }

  if (total.value === 0) {
    return t(l.noMatches);
  }

  // A line past the cap counts what it counted: there are more, and the bar says so.
  return t(l.position, {
    position: NUMBER_FORMAT.format(Math.min(total.value, (props.position ?? 0) + 1)),
    total: `${NUMBER_FORMAT.format(total.value)}${found.capped ? '+' : ''}`,
  });
});

onBeforeUnmount(() => emit('fieldFocus', false));

defineExpose({
  /** Puts the cursor in the field, what is typed selected to type over. */
  focus: selectField,
});

function selectField() {
  field.value?.focus();
  field.value?.select();
}

function onInput(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    emit('update:query', event.target.value);
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }

  if (matchesCommandKey(event, 'Mod+F')) {
    event.preventDefault();
    selectField();
    return;
  }

  switch (event.key) {
    case 'Enter':
      event.preventDefault();
      if (event.shiftKey) {
        emit('previous');
      } else {
        emit('next');
      }

      break;
    case 'Tab':
      if (!event.shiftKey) {
        event.preventDefault();
        emit('toggleOnly');
      }

      break;
    case 'Escape':
      event.preventDefault();
      emit('close');
      break;
  }
}
</script>

<template>
  <div
    :class="css.workflowLogSearch"
    role="search"
    tid="workflow-log-search"
  >
    <Search
      :class="css.workflowLogSearch_icon"
      aria-hidden="true"
    />
    <input
      ref="field"
      :class="css.workflowLogSearch_field"
      :style="{ width: fieldWidth }"
      :value="query"
      :aria-label="t(l.label)"
      :placeholder="t(l.placeholder)"
      type="text"
      autocomplete="off"
      spellcheck="false"
      tid="workflow-log-search-field"
      @input="onInput"
      @keydown="onKeydown"
      @focus="emit('fieldFocus', true)"
      @blur="emit('fieldFocus', false)"
    />
    <span
      v-if="onlyMatches"
      :class="css.workflowLogSearch_position"
      role="status"
      tid="workflow-log-search-position"
      >{{
        t(l.matchingLines, { count: matches?.lineCount ?? 0, shown: NUMBER_FORMAT.format(matches?.lineCount ?? 0) })
      }}</span
    >
    <span
      v-else-if="positionText"
      :class="css.workflowLogSearch_position"
      role="status"
      tid="workflow-log-search-position"
      >{{ positionText }}</span
    >
    <span
      v-if="onlyMatches"
      :class="css.workflowLogSearch_where"
      tid="workflow-log-search-where"
    >
      {{ t(l.ofLines, { total: NUMBER_FORMAT.format(lineTotal) }) }}<template v-if="inSteps"> · {{ inSteps }}</template>
    </span>
    <span
      v-else-if="inSteps"
      :class="css.workflowLogSearch_where"
      tid="workflow-log-search-where"
      >{{ inSteps }}</span
    >
    <span :class="css.workflowLogSearch_spacer" />
    <template v-if="!onlyMatches">
      <button
        type="button"
        :class="css.workflowLogSearch_action"
        aria-keyshortcuts="Enter"
        tid="workflow-log-search-next"
        @mousedown.prevent
        @click="emit('next')"
      >
        <Kbd keys="Enter" />
        {{ t(l.next) }}
      </button>
      <button
        type="button"
        :class="css.workflowLogSearch_action"
        aria-keyshortcuts="Shift+Enter"
        tid="workflow-log-search-previous"
        @mousedown.prevent
        @click="emit('previous')"
      >
        <Kbd keys="Shift+Enter" />
        {{ t(l.previous) }}
      </button>
    </template>
    <button
      type="button"
      :class="[css.workflowLogSearch_action, onlyMatches && css.workflowLogSearch_action_on]"
      :aria-pressed="onlyMatches"
      aria-keyshortcuts="Tab"
      tid="workflow-log-search-only"
      @mousedown.prevent
      @click="emit('toggleOnly')"
    >
      <template v-if="onlyMatches">
        {{ t(l.onlyMatches) }}
        <Kbd keys="Tab" />
      </template>
      <template v-else>
        <Kbd keys="Tab" />
        {{ t(l.onlyMatches) }}
      </template>
    </button>
    <button
      type="button"
      :class="css.workflowLogSearch_action"
      aria-keyshortcuts="Escape"
      tid="workflow-log-search-close"
      @mousedown.prevent
      @click="emit('close')"
    >
      <Kbd keys="Escape" />
      {{ t(l.close) }}
    </button>
  </div>
</template>

<style lang="scss" module="css">
.workflowLogSearch {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-12 0 $spacing-14;
  font-size: $font-size-xs;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;
}

.workflowLogSearch_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.workflowLogSearch_field {
  flex: none;
  min-width: 0;
  max-width: 45%;
  padding: 0;
  font-family: $font-family-mono;
  font-size: $font-size-sm;
  color: $color-fg;
  caret-color: $color-accent;
  background: none;
  border: 0;
  outline: none;

  &::placeholder {
    color: $color-fg-dim;
    opacity: 1;
  }
}

.workflowLogSearch_position {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg;
}

.workflowLogSearch_where {
  flex: none;
  color: $color-fg-dim;
}

.workflowLogSearch_spacer {
  flex: 1;
}

.workflowLogSearch_action {
  @include focus-ring;

  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  padding: 0;
  font: inherit;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  cursor: pointer;
  background: none;
  border: 0;

  &:hover {
    color: $color-fg-2;
  }
}

.workflowLogSearch_action_on {
  gap: $spacing-6;
  padding: $spacing-2 $spacing-7;
  color: $color-fg;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: 5px;
}
</style>
