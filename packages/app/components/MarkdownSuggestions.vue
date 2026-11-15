<!-- The Markdown editor's suggestions at the caret, floating over the page (inside the modal dialog the editor is in, so the pointer reaches them there): for `@` the people ("People": avatar, login, name), for `#` the repository's issues and pull requests ("Issues and pull requests in owner/name": state icon, number, title). It is the listbox of the text area's combobox: the keys and the focus stay in the text area, which moves the highlight (`active`); a click picks a row without taking the focus. Docked (`docked`, the phone's composer above the keyboard, mobile D51, MB239) it is no floating menu but a menu at the bottom in the editor's flow, under the text: its head names it with what is typed under the name (`typed`, "@s") and a × closing it as Escape does (`dismiss`), its rows a finger's height — the keyboard stays up, the focus in the text. -->
<script lang="ts" setup>
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/vue';
import type { VirtualElement } from '@floating-ui/vue';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { X } from 'lucide-vue-next';
import { computed, useTemplateRef } from 'vue';

import { getItemKind } from '@/lists/utils/getItemKind.js';

import Avatar from './Avatar.vue';
import IconButton from './IconButton.vue';
import * as l from './MarkdownSuggestions.loc.js';
import type { SuggestionList } from './SuggestionTypes.js';

const props = defineProps<{
  /** The listbox's id, which the text area controls; each row's is `<id>-<index>`. */
  id: string;
  suggestions: SuggestionList;
  /** The highlighted row's index. */
  active: number;
  /** Where the typed `@` or `#` is drawn: the menu opens under it, or over it without room below. */
  anchor: VirtualElement;
  /** `owner/name`, which the references are of. */
  repository: string;
  /** In the editor's flow above the keyboard, a menu at the bottom (a phone's composer), not floating at the caret. */
  docked?: boolean;
  /** Docked, what is typed from the `@` or `#`, under the name. */
  typed?: string;
}>();

const emit = defineEmits<{
  /** A row clicked. */
  pick: [index: number];
  /** The pointer moved onto a row. */
  highlight: [index: number];
  /** Docked, its × tapped: closed as Escape closes it. */
  dismiss: [];
}>();

/** The space the menu keeps from the edges of the area it stays in. */
const EDGE = 8;

const t = useTranslate();
const menuRef = useTemplateRef<HTMLElement>('menu');
// Inside the modal dialog the editor is in, if any: reka makes everything outside a modal's layer deaf to the pointer,
// and a press out there closes it. Floating over the page from there all the same (`strategy: 'fixed'`).
const portal = computed(() => props.anchor.contextElement?.closest<HTMLElement>('[role="dialog"]') ?? 'body');
// The area the menu stays in: what scrolls the editor where it marks itself (`data-suggestions-boundary`: the item
// view's content, not the list beside it or the status bar under it), else the window. Not floating-ui's clipping
// ancestors: they are the menu's, teleported out of the editor.
const boundary = computed(
  () => props.anchor.contextElement?.closest<HTMLElement>('[data-suggestions-boundary]') ?? 'clippingAncestors',
);
// Docked, it stands in the editor's flow: nothing to float.
const reference = computed(() => (props.docked ? null : props.anchor));
const { floatingStyles, placement } = useFloating(reference, menuRef, {
  placement: 'bottom-start',
  strategy: 'fixed',
  middleware: computed(() => [
    offset(4),
    flip({ boundary: boundary.value, padding: EDGE }),
    shift({ boundary: boundary.value, padding: EDGE }),
    // Without room for all of it either side of the caret, as much as fits, scrolling.
    size({
      boundary: boundary.value,
      padding: EDGE,
      apply: ({ availableWidth, availableHeight, elements }) => {
        elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
        elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
      },
    }),
  ]),
  whileElementsMounted: autoUpdate,
});

const heading = computed(() =>
  props.suggestions.kind === 'mention' ? t(l.people) : t(l.references, { repository: props.repository }),
);
</script>

<template>
  <Teleport
    :to="portal"
    :disabled="docked"
  >
    <div
      ref="menu"
      :class="[
        css.markdownSuggestions,
        docked ? css.markdownSuggestions_docked : css[`markdownSuggestions_${suggestions.kind}`],
      ]"
      :style="docked ? undefined : floatingStyles"
      :data-side="docked ? undefined : placement.split('-')[0]"
      :data-state="docked ? undefined : 'open'"
    >
      <!-- The × keeps the focus in the text: the keyboard stays up. -->
      <div
        v-if="docked"
        :class="css.markdownSuggestions_head"
      >
        <div :class="css.markdownSuggestions_name">
          <span
            :id="`${id}-heading`"
            :class="css.markdownSuggestions_title"
            >{{ heading }}</span
          >
          <span
            v-if="typed"
            :class="css.markdownSuggestions_typed"
            >{{ typed }}</span
          >
        </div>
        <IconButton
          :icon="X"
          :label="t(l.close)"
          @pointerdown.prevent
          @click="emit('dismiss')"
        />
      </div>
      <div
        v-else
        :id="`${id}-heading`"
        :class="css.markdownSuggestions_heading"
      >
        {{ heading }}
      </div>
      <ul
        :id="id"
        :class="css.markdownSuggestions_list"
        role="listbox"
        :aria-labelledby="`${id}-heading`"
      >
        <template v-if="suggestions.kind === 'mention'">
          <li
            v-for="(person, index) in suggestions.rows"
            :id="`${id}-${index}`"
            :key="person.login"
            :class="css.markdownSuggestions_row"
            role="option"
            :aria-selected="index === active"
            @pointerdown.prevent
            @pointermove="emit('highlight', index)"
            @click="emit('pick', index)"
          >
            <Avatar
              :name="person.login"
              :src="person.avatarUrl"
              size="sm"
              decorative
            />
            <span :class="css.markdownSuggestions_label">{{ person.login }}</span>
            <span
              v-if="person.name"
              :class="css.markdownSuggestions_detail"
              >{{ person.name }}</span
            >
          </li>
        </template>
        <template v-else>
          <li
            v-for="(item, index) in suggestions.rows"
            :id="`${id}-${index}`"
            :key="item.number"
            :class="css.markdownSuggestions_row"
            role="option"
            :aria-selected="index === active"
            @pointerdown.prevent
            @pointermove="emit('highlight', index)"
            @click="emit('pick', index)"
          >
            <component
              :is="getItemKind(item).icon"
              :class="[css.markdownSuggestions_icon, css[`markdownSuggestions_icon_${getItemKind(item).tone}`]]"
              aria-hidden="true"
            />
            <span :class="[css.markdownSuggestions_label, css.markdownSuggestions_number]">#{{ item.number }}</span>
            <span :class="css.markdownSuggestions_detail">{{ item.title }}</span>
          </li>
        </template>
      </ul>
    </div>
  </Teleport>
</template>

<style lang="scss" module="css">
.markdownSuggestions {
  z-index: 20;
  padding: $spacing-4;
  overflow-y: auto;
  font-size: $font-size-md;
  color: $color-fg;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
  box-shadow: $shadow-popover;

  @include motion-popper;
}

// Above the keyboard, the width of the composer: a menu at the bottom as `BottomMenu` draws one, its rows a finger's
// height, as many as fit before it scrolls.
.markdownSuggestions_docked {
  @include touch-icon-buttons($phone-row-icon-size, $radius-lg);

  max-height: 240px;
  padding: 0 0 $spacing-4;
  font-size: $font-size-xl;
  border-width: 1px 0 0;
  border-radius: $radius-xl $radius-xl 0 0;
  box-shadow: none;

  .markdownSuggestions_row {
    gap: $spacing-14;
    min-height: $touch-target-size;
    padding: 0 $spacing-20;
    border-radius: 0;
  }

  .markdownSuggestions_detail {
    margin-left: auto;
  }
}

.markdownSuggestions_head {
  position: sticky;
  top: 0;
  display: flex;
  gap: $spacing-4;
  align-items: center;
  padding: $spacing-8 $spacing-6 $spacing-8 $spacing-20;
  margin-bottom: $spacing-4;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;
}

.markdownSuggestions_name {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
}

.markdownSuggestions_title {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
}

.markdownSuggestions_typed {
  font-family: $font-family-mono;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.markdownSuggestions_mention {
  width: 280px;
}

.markdownSuggestions_reference {
  width: 480px;
}

.markdownSuggestions_heading {
  padding: $spacing-6 $spacing-8 $spacing-4;
  font-size: $font-size-2xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.markdownSuggestions_list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.markdownSuggestions_row {
  display: flex;
  gap: $spacing-9;
  align-items: center;
  padding: $spacing-5 $spacing-8;
  cursor: pointer;
  border-radius: $radius-md;

  &[aria-selected='true'] {
    background: $color-sel;
  }
}

.markdownSuggestions_icon {
  flex: none;
  width: 14px;
  height: 14px;

  @include item-kind-tones;
}

.markdownSuggestions_label {
  flex: none;
}

// One width for `#1` to `#12345`: the titles start in one column.
.markdownSuggestions_number {
  min-width: 6ch;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  font-variant-numeric: tabular-nums;
}

.markdownSuggestions_detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  white-space: nowrap;
}
</style>
