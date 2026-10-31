<!-- A modal window over a dimmed app (reka-ui's `Dialog`): focus moves in and stays there, Escape or the close button closes it and focus goes back where it was. Titled for screen readers always; the title can be visually hidden where the content speaks for itself (quick capture). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { X } from 'lucide-vue-next';
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  VisuallyHidden,
} from 'reka-ui';

import * as l from './Dialog.loc.js';
import IconButton from './IconButton.vue';

// Without a description reka-ui still points `aria-describedby` at one; this drops the dangling reference.
const NO_DESCRIPTION = { 'aria-describedby': undefined };

withDefaults(
  defineProps<{
    /** The dialog's name: its heading, or with `titleHidden` read out only. */
    title: string;
    titleHidden?: boolean;
    /** A line under the title, also the dialog's description. */
    description?: string;
    /** Width in px; it never grows past the window. 560 when not given. */
    width?: number;
    /**
     * The content draws its own header and close button: the title is read out only, there is no padding and no
     * close button, and the dialog is as tall as the window allows.
     */
    bare?: boolean;
    /** With `bare`: as tall as the content, up to the window (the command menu), instead of the window. */
    fitContent?: boolean;
  }>(),
  { description: undefined, width: 560 },
);

defineSlots<{
  /** What opens it: one button, which gets the dialog's handlers. Or open it through `v-model:open`. */
  trigger?(): unknown;
  default(): unknown;
  /** Actions along the bottom. */
  footer?(): unknown;
}>();

const emit = defineEmits<{
  /** Escape is about to close it; `preventDefault()` keeps it open (a submenu steps back instead). */
  escapeKeyDown: [event: KeyboardEvent];
  /** It opened and is about to focus its first control; `preventDefault()` and focus another (a title field). */
  openAutoFocus: [event: Event];
}>();

const open = defineModel<boolean>('open', { default: false });
const t = useTranslate();
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger
      v-if="$slots.trigger"
      as-child
    >
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay :class="css.dialog_overlay" />
      <DialogContent
        :class="[css.dialog, bare && (fitContent ? css.dialog_fit : css.dialog_bare)]"
        :style="{ width: `${width}px` }"
        v-bind="description ? {} : NO_DESCRIPTION"
        @escape-key-down="emit('escapeKeyDown', $event)"
        @open-auto-focus="emit('openAutoFocus', $event)"
      >
        <VisuallyHidden
          v-if="titleHidden || bare"
          as-child
        >
          <DialogTitle>{{ title }}</DialogTitle>
        </VisuallyHidden>
        <DialogTitle
          v-else
          :class="css.dialog_title"
        >
          {{ title }}
        </DialogTitle>
        <DialogDescription
          v-if="description"
          :class="css.dialog_description"
        >
          {{ description }}
        </DialogDescription>
        <slot v-if="bare" />
        <div
          v-else
          :class="[css.dialog_body, titleHidden && css.dialog_body_untitled]"
        >
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          :class="css.dialog_footer"
        >
          <slot name="footer" />
        </footer>
        <!-- Last in the tab order, so opening focuses the content's first field; drawn in the corner. -->
        <IconButton
          v-if="!bare"
          :class="css.dialog_close"
          :icon="X"
          :label="t(l.close)"
          kbd="Esc"
          @click="open = false"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style lang="scss" module="css">
.dialog_overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: rgb(0 0 0 / 55%);
}

.dialog {
  position: fixed;
  top: 14vh;
  left: 50%;
  z-index: 11;
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - #{$spacing-24 * 2});
  max-height: calc(86vh - #{$spacing-24});
  overflow: hidden;
  color: $color-fg;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-xl;
  outline: none;
  box-shadow: 0 16px 48px rgb(0 0 0 / 50%);
  transform: translateX(-50%);
}

.dialog_bare {
  top: 11vh;
  height: 78vh;
}

.dialog_fit {
  top: 11vh;
  max-height: 78vh;
}

.dialog_title {
  padding: 14px 44px $spacing-8 $spacing-16;
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
}

.dialog_close {
  position: absolute;
  top: $spacing-10;
  right: $spacing-10;
}

.dialog_description {
  padding: 0 $spacing-16 $spacing-8;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.dialog_body {
  flex: 1;
  min-height: 0;
  padding: $spacing-8 $spacing-16 $spacing-16;
  overflow-y: auto;
}

// No title above: the content starts at the top, clear of the close button.
.dialog_body_untitled {
  padding: $spacing-16 44px $spacing-16 $spacing-16;
}

.dialog_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: flex-end;
  padding: $spacing-12 $spacing-16;
  border-top: 1px solid $color-border;
}
</style>
