<!-- Find in the review's code (`Review / Find bar`, CR137–CR143): the query in a mono field growing with it, its three switches at the field's end (match case, whole word, regular expression), where the search stands ("3 of 128", "+" while more may come, "No results", an invalid or too slow pattern), previous, next and close. The field keeps its own keys: Enter and F3 and ⌘G next, with Shift previous; Esc closes, ⌘F selects what is typed. The buttons don't take the focus from it. -->
<script lang="ts">
/** The keys the find field takes while the cursor is in it, its own (commands D11); out of it find's commands run theirs. */
export const FIND_FIELD_KEYS = { next: 'Enter', previous: 'Shift+Enter' } as const;
</script>

<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowDown, ArrowUp, CaseSensitive, Regex, Search, WholeWord, X } from 'lucide-vue-next';
import { computed, useTemplateRef } from 'vue';

import { closeFind, find, findNext, findPrevious } from '@/commands/definitions/index.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { keyOf } from '@/commands/keyOf.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import IconButton from '@/components/IconButton.vue';
import SearchField from '@/components/SearchField.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import ReviewToggle from '../ReviewToggle.vue';
import type { FindOptions } from './compileFindQuery.js';
import type { FindState } from './createFindRunner.js';
import * as l from './ReviewFindBar.loc.js';

const props = defineProps<{
  /** As typed; the matches follow a moment later. */
  query: string;
  /** How the query is read: the three switches. */
  options: FindOptions;
  /** Where the search stands; while searching the last count stays. */
  state: FindState;
  /** How many matches there are to step through. */
  total: number;
  /** The current match's place among them, 0-based; `null` for none. */
  position: number | null;
  /** There may be more than `total`: not every file's lines are searched yet, or a line had more than are kept. */
  incomplete: boolean;
}>();

const emit = defineEmits<{
  'update:query': [query: string];
  next: [];
  previous: [];
  close: [];
  toggle: [option: keyof FindOptions];
}>();

/** Past it the query scrolls in its field. */
const MAX_QUERY_WIDTH = 48;
/** The field's width besides the query, in px: its padding, the glyph and the switches. */
const FIELD_CHROME_WIDTH = 114;
/** The narrowest the field gets, as the design draws it. */
const FIELD_MIN_WIDTH = 300;
const NUMBER_FORMAT = new Intl.NumberFormat(APP_LANGUAGE);

const t = useTranslate();
const field = useTemplateRef('field');

/** A field as wide as what is in it, measured in the mono font's `ch`. */
const fieldWidth = computed(
  () =>
    `max(${FIELD_MIN_WIDTH}px, calc(${Math.min(MAX_QUERY_WIDTH, props.query.length + 1)}ch + ${FIELD_CHROME_WIDTH}px))`,
);
/** The search found nothing, or failed: the field's outline says so too. */
const problem = computed(() => {
  switch (props.state.status) {
    case 'invalid':
      return 'invalid';
    case 'tooSlow':
      return 'tooSlow';
    case 'done':
      return props.total === 0 ? 'noResults' : null;
    case 'searching':
      return props.state.matches && props.total === 0 ? 'noResults' : null;
    case 'idle':
      return null;
    default:
      return assertNever(props.state);
  }
});
const positionText = computed(() => {
  if (props.total === 0) {
    return null;
  }

  const total = NUMBER_FORMAT.format(props.total);
  return props.position == null
    ? t(l.noPosition, { total })
    : t(l.position, { position: NUMBER_FORMAT.format(props.position + 1), total });
});
const toggles = computed(() => [
  { option: 'matchCase' as const, icon: CaseSensitive, label: t(l.matchCase) },
  { option: 'wholeWord' as const, icon: WholeWord, label: t(l.wholeWord) },
  { option: 'regex' as const, icon: Regex, label: t(l.regex) },
]);

defineExpose({
  /** Puts the cursor in the field, what is typed selected to type over. */
  focus: selectField,
});

function selectField() {
  field.value?.select();
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }

  if (matchesCommandKey(event, keyOf(find))) {
    event.preventDefault();
    selectField();
  } else if (matchesAny(event, [FIND_FIELD_KEYS.next, keyOf(findNext), ...(findNext.otherKeys ?? [])])) {
    event.preventDefault();
    emit('next');
  } else if (matchesAny(event, [FIND_FIELD_KEYS.previous, keyOf(findPrevious), ...(findPrevious.otherKeys ?? [])])) {
    event.preventDefault();
    emit('previous');
  } else if (matchesCommandKey(event, keyOf(closeFind))) {
    event.preventDefault();
    emit('close');
  }
}

function matchesAny(event: KeyboardEvent, keys: readonly string[]) {
  return keys.some(key => matchesCommandKey(event, key));
}
</script>

<template>
  <div
    :class="css.reviewFindBar"
    role="search"
    :aria-label="t(l.label)"
    tid="review-find-bar"
  >
    <SearchField
      ref="field"
      :class="[css.reviewFindBar_field, problem && css[`reviewFindBar_field_${problem}`]]"
      :style="{ width: fieldWidth }"
      :model-value="query"
      :icon="Search"
      :label="t(l.label)"
      :placeholder="t(l.placeholder)"
      size="sm"
      autocomplete="off"
      tid="review-find-field"
      @update:model-value="emit('update:query', $event ?? '')"
      @keydown="onKeydown"
    >
      <template #end>
        <span :class="css.reviewFindBar_toggles">
          <ReviewToggle
            v-for="toggle of toggles"
            :key="toggle.option"
            :icon="toggle.icon"
            :label="toggle.label"
            :pressed="options[toggle.option]"
            quiet
            :tid="`review-find-${toggle.option}`"
            @mousedown.prevent
            @click="emit('toggle', toggle.option)"
          />
        </span>
      </template>
    </SearchField>
    <span
      :class="css.reviewFindBar_counter"
      role="status"
      tid="review-find-counter"
    >
      <span
        v-if="problem"
        :class="[css.reviewFindBar_message, problem !== 'noResults' && css.reviewFindBar_message_error]"
        >{{ problem === 'noResults' && incomplete ? t(l.noResultsYet) : t(l[problem]) }}</span
      >
      <template v-else-if="positionText">
        <span :class="css.reviewFindBar_position">{{ positionText }}</span>
        <span
          v-if="incomplete"
          :class="css.reviewFindBar_more"
          >+</span
        >
      </template>
    </span>
    <IconButton
      :class="css.reviewFindBar_action"
      :icon="ArrowUp"
      :label="t(l.previous)"
      :kbd="FIND_FIELD_KEYS.previous"
      :keyshortcuts="formatAriaKeyShortcuts(FIND_FIELD_KEYS.previous)"
      :disabled="total === 0"
      tid="review-find-previous"
      @mousedown.prevent
      @click="emit('previous')"
    />
    <IconButton
      :class="css.reviewFindBar_action"
      :icon="ArrowDown"
      :label="t(l.next)"
      :kbd="FIND_FIELD_KEYS.next"
      :keyshortcuts="formatAriaKeyShortcuts(FIND_FIELD_KEYS.next)"
      :disabled="total === 0"
      tid="review-find-next"
      @mousedown.prevent
      @click="emit('next')"
    />
    <IconButton
      :class="css.reviewFindBar_action"
      :icon="X"
      :label="t(l.close)"
      :kbd="keyOf(closeFind)"
      :keyshortcuts="formatAriaKeyShortcuts(keyOf(closeFind))"
      tid="review-find-close"
      @mousedown.prevent
      @click="emit('close')"
    />
  </div>
</template>

<style lang="scss" module="css">
.reviewFindBar {
  display: inline-flex;
  gap: $spacing-4;
  align-items: center;
  padding: $spacing-5;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
  box-shadow: $shadow-popover;
}

// Mono, so the `ch` its width is counted in is the query's; the switches sit at its end as the file filter's does.
.reviewFindBar_field {
  --search-field-background: #{$color-bg-2};

  flex: none;
  max-width: 100%;
  padding-right: $spacing-2;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
}

// Doubled so the outline stays while the field has the focus.
.reviewFindBar_field.reviewFindBar_field_invalid {
  --search-field-color: #{$color-red};

  &,
  &:focus-within {
    border-color: $color-red;
  }
}

.reviewFindBar_field.reviewFindBar_field_noResults,
.reviewFindBar_field.reviewFindBar_field_tooSlow {
  &,
  &:focus-within {
    border-color: $color-red-quiet;
  }
}

// Wider apart than the design's 1px: 20px targets need 24px between their centres (WCAG 2.5.8).
.reviewFindBar_toggles {
  display: flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
}

.reviewFindBar_counter {
  display: flex;
  flex: none;
  align-items: center;
  padding: 0 $spacing-6;
  font-size: $font-size-xs;
}

.reviewFindBar_position {
  font-family: $font-family-mono;
  color: $color-fg;
}

.reviewFindBar_more {
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.reviewFindBar_message {
  color: $color-fg-2;
}

.reviewFindBar_message_error {
  color: $color-red;
}

.reviewFindBar_action {
  --icon-button-width: 30px;

  &:disabled {
    opacity: 0.4;
  }
}
</style>
