<!-- A message about something that went wrong in the background (reka-ui's `Toast`, inside a `Toaster`): an icon in its tone, the title, what happened below it, and its actions — always "Dismiss" (Esc). It closes by itself after a while (not while hovered or focused), or when dismissed; Escape dismisses it unless something else has the key — a field being typed in, an open picker or menu. -->
<script lang="ts" setup>
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleX, TriangleAlert, X } from 'lucide-vue-next';
import { ToastDescription, ToastRoot, ToastTitle } from 'reka-ui';

import { isEditableTarget } from '@/utils/isEditableTarget.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';

import Button from './Button.vue';
import IconButton from './IconButton.vue';
import * as l from './Toast.loc.js';

withDefaults(
  defineProps<{
    title: string;
    /** `danger`: a change failed; `warning`: some of it went through. */
    tone?: 'danger' | 'warning';
    /** How long it stays, in ms. */
    duration?: number;
  }>(),
  { tone: 'danger', duration: 12_000 },
);

const emit = defineEmits<{
  /** The user dismissed it (not the timeout). */
  dismiss: [];
}>();

defineSlots<{
  /** What happened. */
  default?(): unknown;
  /** Buttons before "Dismiss". */
  actions?(): unknown;
}>();

const open = defineModel<boolean>('open', { default: true });
const t = useTranslate();

// Escape dismisses it before the screen sees the key (an opened item would close) — unless the key is someone
// else's: typed into a field, or closing a picker, a menu or a tooltip that is open.
onWindowEvent(
  'keydown',
  event => {
    if (event.key !== 'Escape' || !open.value || isEditableTarget(event.target) || isLayerOpen()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dismiss();
  },
  { capture: true },
);

function dismiss() {
  open.value = false;
  emit('dismiss');
}

// reka-ui closes a toast on any Escape that reaches the window. The handler above took the ones that are the toast's;
// one that gets this far is someone else's — closing the help sheet over it, say — so the toast stays. Not with
// `preventDefault()`: the layer the Escape is for would take it as handled and stay open too.
let keepOnEscape = false;

function onEscapeKeyDown() {
  keepOnEscape = true;
  queueMicrotask(() => (keepOnEscape = false));
}

function onOpenChange(value: boolean) {
  if (!value && keepOnEscape) {
    keepOnEscape = false;
    return;
  }

  open.value = value;
}
</script>

<template>
  <ToastRoot
    :open="open"
    :class="[css.toast, css[`toast_${tone}`]]"
    :duration="duration"
    @update:open="onOpenChange"
    @escape-key-down="onEscapeKeyDown"
  >
    <component
      :is="tone === 'danger' ? CircleX : TriangleAlert"
      :class="css.toast_icon"
      aria-hidden="true"
    />
    <div :class="css.toast_content">
      <ToastTitle :class="css.toast_title">{{ title }}</ToastTitle>
      <ToastDescription
        v-if="$slots.default"
        :class="css.toast_description"
      >
        <slot />
      </ToastDescription>
      <div :class="css.toast_actions">
        <slot name="actions" />
        <Button
          variant="secondary"
          size="sm"
          kbd="Escape"
          aria-keyshortcuts="Escape"
          @click="dismiss"
        >
          {{ t(l.dismiss) }}
        </Button>
      </div>
    </div>
    <IconButton
      :class="css.toast_close"
      :icon="X"
      :label="t(l.dismiss)"
      size="sm"
      @click="dismiss"
    />
  </ToastRoot>
</template>

<style lang="scss" module="css">
.toast {
  display: flex;
  gap: $spacing-10;
  align-items: flex-start;
  padding: 14px $spacing-16;
  color: $color-fg;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
  box-shadow: 0 12px 32px rgb(0 0 0 / 45%);
}

.toast_icon {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 1px;

  .toast_danger & {
    color: $color-red;
  }

  .toast_warning & {
    color: $color-amber;
  }
}

.toast_content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
}

.toast_title {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  line-height: 18px;
}

.toast_description {
  font-size: $font-size-sm;
  line-height: 19px;
  color: $color-fg-2;
}

.toast_actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  margin-top: $spacing-4;
}

.toast_close {
  flex: none;
  margin: -4px -6px 0 0;
}
</style>
