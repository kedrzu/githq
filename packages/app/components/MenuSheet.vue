<!-- A `Menu`'s or a `ContextMenu`'s entries on a phone (mobile D45): the same items, labels and lines, as rows a finger's height in a menu at the bottom (`BottomMenu`) named by what it is for, with what it acts on under the name. A submenu's entry drills in place (MB109): its entries replace the menu's, its name in the head, ← or Escape back to the entry. Picking an entry closes it, as on the computer; for a keyboard ↑/↓ move between the entries, Home and End to the ends. No keys are shown on its entries (D52). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue';

import BottomMenu from './BottomMenu.vue';
import * as l from './MenuSheet.loc.js';
import { MenuSheetContext } from './MenuSheetContext.js';
import type { MenuSheetLevel } from './MenuSheetContext.js';

withDefaults(
  defineProps<{
    /** What it is for ("Item actions"); "Actions" when not given. */
    title?: string;
    /** What it acts on, under the name (an item's reference). */
    context?: string;
  }>(),
  { title: undefined, context: undefined },
);

const emit = defineEmits<{
  /** It closed and is about to give the focus back to its trigger; `preventDefault()` when an entry moved it elsewhere. */
  closeAutoFocus: [event: Event];
}>();

defineSlots<{
  /** What opens it: one button. Or open it through `v-model:open`. */
  trigger?(): unknown;
  /** The entries: `MenuItem`s, `MenuSub`s, `MenuLabel`s, `MenuSeparator`s, `MenuRadioGroup`s. */
  default(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });

const t = useTranslate();
const headingId = useId();
const levelsRef = useTemplateRef<HTMLElement>('levels');
/** The submenus drilled into, the one shown last. */
const levels = shallowRef<readonly MenuSheetLevel[]>([]);

provideContext(MenuSheetContext, { close, drill });

watch(open, isOpen => {
  if (!isOpen) {
    leaveAll();
  }
});

function close() {
  open.value = false;
}

function drill(level: MenuSheetLevel) {
  levels.value = [...levels.value, level];
  void nextTick(() => getEntries()[0]?.focus());
}

function back() {
  const level = levels.value.at(-1);
  if (!level) {
    return;
  }

  levels.value = levels.value.slice(0, -1);
  level.leave();
  void nextTick(() => level.entry?.focus());
}

function leaveAll() {
  const left = levels.value;
  levels.value = [];
  for (const level of left.toReversed()) {
    level.leave();
  }
}

function onEscape(event: KeyboardEvent) {
  if (levels.value.length > 0) {
    event.preventDefault();
    back();
  }
}

/** The entries of the menu shown: the top one, or the submenu drilled into last. */
function getEntries() {
  const shown = levelsRef.value?.querySelector(`[data-level="${levels.value.length}"]`);
  return [...(shown?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])];
}

function onKeydown(event: KeyboardEvent) {
  const entries = getEntries();
  const index = entries.findIndex(entry => entry === document.activeElement);
  let next: HTMLElement | undefined;
  switch (event.key) {
    case 'ArrowDown':
      next = entries[(index + 1) % entries.length];
      break;
    case 'ArrowUp':
      next = entries.at(index <= 0 ? -1 : index - 1);
      break;
    case 'Home':
      next = entries[0];
      break;
    case 'End':
      next = entries.at(-1);
      break;
    default:
      return;
  }

  if (next) {
    event.preventDefault();
    next.focus();
  }
}
</script>

<template>
  <BottomMenu
    v-model:open="open"
    :title="title ?? t(l.actions)"
    :context="context"
    :back="levels.length > 0"
    :heading-id="headingId"
    @back="back"
    @escape-key-down="onEscape"
    @close-auto-focus="emit('closeAutoFocus', $event)"
  >
    <template
      v-if="$slots.trigger"
      #trigger
    >
      <slot name="trigger" />
    </template>
    <template
      v-if="levels.length > 0"
      #heading
    >
      <component :is="levels.at(-1)?.heading" />
    </template>
    <div
      ref="levels"
      :class="css.menuSheet"
      data-no-commands
      @keydown="onKeydown"
    >
      <!-- Every level stays put while a submenu shows, so its entry is there to go back to. -->
      <div
        v-show="levels.length === 0"
        role="menu"
        :aria-labelledby="headingId"
        data-level="0"
      >
        <slot />
      </div>
      <div
        v-for="(level, index) in levels"
        v-show="index === levels.length - 1"
        :key="index"
        role="menu"
        :aria-labelledby="headingId"
        :data-level="index + 1"
      >
        <component :is="level.content" />
      </div>
    </div>
  </BottomMenu>
</template>

<style lang="scss" module="css">
// Under the head a line, as MB109 draws it (a picker's filter takes its place).
.menuSheet {
  display: flex;
  flex-direction: column;
  padding-top: $spacing-4;
  border-top: 1px solid $color-border;
}
</style>
