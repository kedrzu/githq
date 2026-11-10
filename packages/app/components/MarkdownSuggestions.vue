<!-- The Markdown editor's suggestions at the caret, floating over the page (inside the modal dialog the editor is in, so the pointer reaches them there): for `@` the people ("People": avatar, login, name), for `#` the repository's issues and pull requests ("Issues and pull requests in owner/name": state icon, number, title). It is the listbox of the text area's combobox: the keys and the focus stay in the text area, which moves the highlight (`active`); a click picks a row without taking the focus. -->
<script lang="ts" setup>
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue';
import type { VirtualElement } from '@floating-ui/vue';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, toRef, useTemplateRef } from 'vue';

import { getItemKind } from '@/lists/utils/getItemKind.js';

import Avatar from './Avatar.vue';
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
}>();

const emit = defineEmits<{
  /** A row clicked. */
  pick: [index: number];
  /** The pointer moved onto a row. */
  highlight: [index: number];
}>();

const t = useTranslate();
const menuRef = useTemplateRef<HTMLElement>('menu');
const { floatingStyles, placement } = useFloating(toRef(props, 'anchor'), menuRef, {
  placement: 'bottom-start',
  strategy: 'fixed',
  middleware: [offset(4), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
});

// Inside the modal dialog the editor is in, if any: reka makes everything outside a modal's layer deaf to the pointer,
// and a press out there closes it. Floating over the page from there all the same (`strategy: 'fixed'`).
const portal = computed(() => props.anchor.contextElement?.closest<HTMLElement>('[role="dialog"]') ?? 'body');

const heading = computed(() =>
  props.suggestions.kind === 'mention' ? t(l.people) : t(l.references, { repository: props.repository }),
);
</script>

<template>
  <Teleport :to="portal">
    <div
      ref="menu"
      :class="[css.markdownSuggestions, css[`markdownSuggestions_${suggestions.kind}`]]"
      :style="floatingStyles"
      :data-side="placement.split('-')[0]"
      data-state="open"
    >
      <div
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
  max-width: calc(100vw - #{$spacing-16});
  padding: $spacing-4;
  font-size: $font-size-md;
  color: $color-fg;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
  box-shadow: $shadow-popover;

  @include motion-popper;
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

.markdownSuggestions_number {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
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
