<!-- What drops from a trigger on the computer, on a phone (mobile D45): a menu pinned to the bottom of the screen, a sheet rising from below over the dimmed screen (`Dialog edge="bottom"`, so the command line steps aside, D18). Its head names what it is for ("Assignees") with what it acts on under it in monospace ("fitloop/webapp#1187", MB74, MB108), ← before the name when it has a way back (a submenu, MB109), × to close; Escape and a tap above it close it too. As it opens the first entry takes the focus — or a picker's list — never a filter, so no keyboard comes up until the filter is tapped. `Picker` shows its list in it, `MenuSheet` a menu's entries. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronLeft, X } from 'lucide-vue-next';
import { useTemplateRef } from 'vue';

import * as l from './BottomMenu.loc.js';
import Dialog from './Dialog.vue';
import IconButton from './IconButton.vue';

withDefaults(
  defineProps<{
    /** What it is for ("Assignees", "Item actions"): the head's name and the dialog's. */
    title: string;
    /** What it acts on, under the name in monospace (an item's reference); also the dialog's description. */
    context?: string;
    /** A ← before the name, which emits `back` (inside a submenu). */
    back?: boolean;
    /** The id of the head's visible name, for the entries' list to be named by it (a submenu's name). */
    headingId?: string;
  }>(),
  { context: undefined, headingId: undefined },
);

const emit = defineEmits<{
  /** The ← tapped. */
  back: [];
  /** Escape is about to close it; `preventDefault()` keeps it open (a submenu steps back instead). */
  escapeKeyDown: [event: KeyboardEvent];
  /** It closed and is about to give the focus back to its trigger; `preventDefault()` when an entry moved it elsewhere. */
  closeAutoFocus: [event: Event];
}>();

defineSlots<{
  /** What opens it: one button, which gets the dialog's handlers. Or open it through `v-model:open`. */
  trigger?(): unknown;
  /** The head's visible name in place of `title` (a submenu's). */
  heading?(): unknown;
  /** The entries. */
  default(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });

const t = useTranslate();
const bodyRef = useTemplateRef<HTMLElement>('body');

/** The first entry, or a picker's list, rather than the first control (the ×, or a filter bringing the keyboard up). */
function focusFirstEntry(event: Event) {
  event.preventDefault();
  bodyRef.value
    ?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"]), [role="listbox"]')
    ?.focus();
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="title"
    :description="context"
    edge="bottom"
    bare
    fit-content
    @open-auto-focus="focusFirstEntry"
    @escape-key-down="emit('escapeKeyDown', $event)"
    @close-auto-focus="emit('closeAutoFocus', $event)"
  >
    <template
      v-if="$slots.trigger"
      #trigger
    >
      <slot name="trigger" />
    </template>
    <div :class="css.bottomMenu">
      <header :class="css.bottomMenu_head">
        <IconButton
          v-if="back"
          :class="css.bottomMenu_back"
          :icon="ChevronLeft"
          :label="t(l.back)"
          @click="emit('back')"
        />
        <!-- The dialog's own title and description are what a screen reader hears. -->
        <div
          :class="css.bottomMenu_heading"
          aria-hidden="true"
        >
          <span
            :id="headingId"
            :class="css.bottomMenu_title"
            ><slot name="heading">{{ title }}</slot></span
          >
          <span
            v-if="context"
            :class="css.bottomMenu_context"
            >{{ context }}</span
          >
        </div>
        <IconButton
          :icon="X"
          :label="t(l.close)"
          @click="open = false"
        />
      </header>
      <div
        ref="body"
        :class="css.bottomMenu_body"
      >
        <slot />
      </div>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
.bottomMenu {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.bottomMenu_head {
  --icon-button-width: #{$touch-target-size};
  --icon-button-height: #{$touch-target-size};
  --icon-button-radius: #{$radius-lg};
  --icon-button-glyph-size: #{$phone-row-icon-size};

  display: flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  padding: $spacing-8 $spacing-6 $spacing-8 $spacing-20;
}

// The ← sits where the name would start, its glyph in line with the rows' icons below.
.bottomMenu_back {
  margin-left: -$spacing-12;
}

.bottomMenu_heading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
}

.bottomMenu_title {
  overflow: hidden;
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottomMenu_context {
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottomMenu_body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-bottom: $spacing-8;
  overflow-y: auto;
}
</style>
