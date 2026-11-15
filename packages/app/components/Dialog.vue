<!-- A modal window over a dimmed app (reka-ui's `Dialog`): focus moves in and stays there, Escape or the close button closes it and focus goes back where it was. Hanging from near the window's top, centred, or a sheet along its left edge (the phone's places panel) or rising from its bottom (a phone's list options, its command menu) — a phone's task, while which the command line steps aside (mobile D18, `PhoneLayout.openTask`). Titled for screen readers always; the title can be visually hidden where the content speaks for itself (quick capture). It is put in the page only while open, so the one opened last is on top. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
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
import { onScopeDispose, watch } from 'vue';

import { PhoneLayout } from '@/shell/PhoneLayout.js';

import * as l from './Dialog.loc.js';
import IconButton from './IconButton.vue';

// Without a description reka-ui still points `aria-describedby` at one; this drops the dangling reference.
const NO_DESCRIPTION = { 'aria-describedby': undefined };

const props = withDefaults(
  defineProps<{
    /** The dialog's name: its heading, or with `titleHidden` read out only. */
    title: string;
    titleHidden?: boolean;
    /** A line under the title, also the dialog's description. */
    description?: string;
    /**
     * The content draws its own header and close button: the title and description are read out only, there is no
     * padding and no close button, and the dialog is as tall as the window allows.
     */
    bare?: boolean;
    /** With `bare`: as tall as the content, up to the window (the command menu), instead of the window. */
    fitContent?: boolean;
    /** Centred on the window both ways (the merge panel), instead of hanging from near its top. */
    centered?: boolean;
    /**
     * A sheet along an edge instead of hanging from near the top: `left` all the window's height (the phone's places
     * panel), `bottom` all its width, as tall as its content, rising from below (a phone's list options).
     */
    edge?: 'bottom' | 'left';
  }>(),
  { description: undefined },
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
  /** It closed and is about to give the focus back to its trigger; `preventDefault()` when an action moved it elsewhere. */
  closeAutoFocus: [event: Event];
}>();

const open = defineModel<boolean>('open', { default: false });
/** Width in px; it never grows past the window. Not for `edge="bottom"`, as wide as the window. */
const width = defineModel<number>('width', { default: 560 });
const t = useTranslate();
const phoneLayout = useService(PhoneLayout);
let closeTask: (() => void) | null = null;

// A sheet from below is a task: the phone's command line leaves while it is open (mobile D18).
watch(
  () => open.value && props.edge === 'bottom',
  isTask => {
    if (isTask) {
      closeTask = phoneLayout.openTask();
    } else {
      endTask();
    }
  },
  { immediate: true },
);
onScopeDispose(endTask);

function endTask() {
  closeTask?.();
  closeTask = null;
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger
      v-if="$slots.trigger"
      as-child
    >
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal v-if="open">
      <DialogOverlay :class="css.dialog_overlay" />
      <DialogContent
        :class="[
          css.dialog,
          bare && (fitContent ? css.dialog_fit : css.dialog_bare),
          centered && css.dialog_centered,
          edge && css[`dialog_${edge}`],
        ]"
        :style="edge === 'bottom' ? undefined : { width: `${width}px` }"
        v-bind="description ? {} : NO_DESCRIPTION"
        @escape-key-down="emit('escapeKeyDown', $event)"
        @open-auto-focus="emit('openAutoFocus', $event)"
        @close-auto-focus="emit('closeAutoFocus', $event)"
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
        <VisuallyHidden
          v-if="description && bare"
          as-child
        >
          <DialogDescription>{{ description }}</DialogDescription>
        </VisuallyHidden>
        <DialogDescription
          v-else-if="description"
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
          kbd="Escape"
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

  &[data-state='open'] {
    @include motion {
      animation-name: global(motion-fade-in);
      animation-duration: $motion-open;
      animation-timing-function: ease-out;
    }
  }
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

  &[data-state='open'] {
    --motion-slide-y: #{-$motion-slide-distance};

    @include motion {
      animation-name: global(motion-slide-in);
      animation-duration: $motion-open;
      animation-timing-function: ease-out;
    }
  }
}

.dialog_bare {
  top: 11vh;
  height: 78vh;
}

.dialog_fit {
  top: 11vh;
  max-height: 78vh;
}

.dialog_centered {
  top: 50%;
  transform: translate(-50%, -50%);
}

.dialog_left {
  top: 0;
  bottom: 0;
  left: 0;
  height: auto;
  max-width: calc(100vw - #{$phone-places-room});
  max-height: none;
  border-width: 0 1px 0 0;
  border-radius: 0;
  transform: none;

  &[data-state='open'] {
    --motion-slide-x: #{-$motion-slide-distance};
    --motion-slide-y: 0;
  }
}

.dialog_bottom {
  top: auto;
  right: 0;
  bottom: 0;
  left: 0;
  max-width: none;
  max-height: calc(100vh - #{$phone-top-bar-height});
  padding-bottom: $phone-home-indicator-room;
  border-width: 1px 0 0;
  border-radius: $radius-xl $radius-xl 0 0;
  transform: none;

  &[data-state='open'] {
    --motion-slide-y: #{$motion-slide-distance};
  }
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
