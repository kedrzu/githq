<!-- A message about something that happened in the background (reka-ui's `Toast`, inside a `Toaster`) — went wrong, went through in part, or a merge GitHub confirmed (`done`) — or a neutral one about what the user just did (T20): an icon in its tone (or the one it is given), the title, what happened below it, and its actions — always "Dismiss" (Esc). A `brief` or `long` one closes by itself (not while hovered or focused), counting down in a ring around its ×; a `pinned` one stays until dismissed. Only the newest toast of the `Toaster` takes keys: its `commands` run and its key hints show, and Escape dismisses it unless something else has the key — a field being typed in, an open picker or menu. -->
<script lang="ts">
/**
 * How long a toast stays, in ms, by what it says:
 * - `brief`: news and outcomes (merged, reverted, updated to a version, could not track);
 * - `long`: an Undo, or a failure the status bar keeps anyway;
 * - `pinned`: it needs a decision, so it stays until dismissed.
 */
export const TOAST_LASTS = {
  brief: 6_000,
  long: 10_000,
  pinned: Number.POSITIVE_INFINITY,
} as const;

/** One of the lifetimes of `TOAST_LASTS`. */
export type ToastLasts = keyof typeof TOAST_LASTS;
</script>

<script lang="ts" setup>
import { injectContext } from '@nzyme/vue-utils/context.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleX, GitMerge, Info, TriangleAlert, X } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { ToastDescription, ToastRoot, ToastTitle } from 'reka-ui';
import { computed, onUnmounted, ref, watch } from 'vue';

import type { Command } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';

import Button from './Button.vue';
import IconButton from './IconButton.vue';
import * as l from './Toast.loc.js';
import { ToasterStack } from './ToasterStack.js';

const props = withDefaults(
  defineProps<{
    title: string;
    /**
     * |Tone|For|Icon|
     * |-|-|-|
     * |`danger`|a change failed|`CircleX`, red|
     * |`warning`|some of it went through|`TriangleAlert`, amber|
     * |`done`|a merge GitHub confirmed|`GitMerge`, purple|
     * |`neutral`|nothing is wrong: what the user just did|the one given, else `Info`, dim|
     * |`accent`|news, nothing is wrong either|the one given, else `Info`, accent|
     */
    tone?: 'danger' | 'done' | 'warning' | 'neutral' | 'accent';
    /** Instead of the tone's own. */
    icon?: LucideIcon;
    /** How long it stays (`TOAST_LASTS`). */
    lasts?: ToastLasts;
    /**
     * Its actions for the command registry. Their keys work only while it is the newest open toast — its buttons show
     * them only then (`#actions`' `active`); an older toast keeps just those offered in the command menu, keyless.
     */
    commands?: readonly Command[];
  }>(),
  { tone: 'danger', lasts: 'long', icon: undefined, commands: () => [] },
);

const emit = defineEmits<{
  /** The user dismissed it (not the timeout). */
  dismiss: [];
}>();

defineSlots<{
  /** What happened. */
  default?(): unknown;
  /** Buttons before "Dismiss"; `active`: it is the newest toast, so its buttons show their keys. */
  actions?(props: { active: boolean }): unknown;
}>();

const open = defineModel<boolean>('open', { default: true });
const t = useTranslate();
const stack = injectContext(ToasterStack);
const icons = {
  danger: CircleX,
  done: GitMerge,
  warning: TriangleAlert,
  neutral: Info,
  accent: Info,
};

/** Its place in the order the `Toaster`'s toasts opened, while it is open. */
const arrival = ref<number | null>(null);
const active = computed(() => arrival.value != null && stack.isNewest(arrival.value));
const lifetime = computed(() => TOAST_LASTS[props.lasts]);
const timed = computed(() => Number.isFinite(lifetime.value));
/** When it opened, and whether reka's countdown has resumed since: see `getElapsed`. */
let openedAt = 0;
const resumed = ref(false);

watch(
  open,
  value => {
    leaveStack();
    if (value) {
      arrival.value = stack.add();
      openedAt = Date.now();
      resumed.value = false;
    }
  },
  { immediate: true },
);

useCommands(() =>
  active.value
    ? props.commands
    : props.commands
        .filter(command => command.menu !== false)
        .map(command => ({ ...command, key: undefined, otherKeys: undefined })),
);

onUnmounted(leaveStack);

// Escape dismisses it before the screen sees the key (an opened item would close) — unless the key is someone
// else's: typed into a field, or closing a picker, a menu or a tooltip that is open — or it is not the newest toast.
// An Escape the newest already took is not the next one's, though it becomes the newest at once.
onWindowEvent(
  'keydown',
  event => {
    if (
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      !active.value ||
      isEditableTarget(event.target) ||
      isLayerOpen()
    ) {
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

function leaveStack() {
  if (arrival.value != null) {
    stack.remove(arrival.value);
    arrival.value = null;
  }
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

/**
 * The part of its lifetime gone, from 0 to 1, for the ring's empty arc. Opened while the toasts were paused (the
 * pointer over them), reka's countdown has not started and counts `remaining` from the epoch, so 0: until it resumes,
 * a `remaining` of 0 before the lifetime could have passed is a full ring.
 */
function getElapsed(remaining: number, total: number) {
  if (remaining <= 0 && !resumed.value && Date.now() - openedAt < total) {
    return 0;
  }

  return Math.min(Math.max(1 - remaining / total, 0), 1);
}
</script>

<template>
  <ToastRoot
    v-slot="{ remaining, duration: total }"
    :open="open"
    :class="[css.toast, css[`toast_${tone}`]]"
    :style="{ order: arrival ?? undefined }"
    :duration="lifetime"
    @update:open="onOpenChange"
    @escape-key-down="onEscapeKeyDown"
    @resume="resumed = true"
  >
    <component
      :is="icon ?? icons[tone]"
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
        <slot
          name="actions"
          :active="active"
        />
        <Button
          variant="secondary"
          size="sm"
          :kbd="active ? 'Escape' : undefined"
          :aria-keyshortcuts="active ? 'Escape' : undefined"
          @click="dismiss"
        >
          {{ t(l.dismiss) }}
        </Button>
      </div>
    </div>
    <span :class="css.toast_close">
      <!-- Updated as reka counts down, with no transition: it shows the time left, it doesn't animate. -->
      <svg
        v-if="timed"
        :class="css.toast_countdown"
        tid="toast-countdown"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="11.16"
          pathLength="1"
          stroke-dasharray="1"
          :stroke-dashoffset="-getElapsed(remaining, total)"
        />
      </svg>
      <IconButton
        :class="css.toast_closeButton"
        :icon="X"
        :label="t(l.dismiss)"
        size="sm"
        @click="dismiss"
      />
    </span>
  </ToastRoot>
</template>

<style lang="scss" module="css">
.toast {
  display: flex;
  gap: $spacing-10;
  align-items: flex-start;
  padding: 12px 14px;
  color: $color-fg;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
  box-shadow: 0 12px 32px rgb(0 0 0 / 45%);

  &[data-state='open'] {
    --motion-slide-x: #{$motion-slide-distance};

    @include motion {
      animation-name: global(motion-slide-in);
      animation-duration: $motion-open;
      animation-timing-function: ease-out;
    }
  }
}

// Level with the title, both centred on the 24 px ring.
.toast_icon {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 5px;

  .toast_danger & {
    color: $color-red;
  }

  .toast_warning & {
    color: $color-amber;
  }

  .toast_done & {
    color: $color-purple;
  }

  .toast_neutral & {
    color: $color-fg-2;
  }

  .toast_accent & {
    color: $color-accent;
  }
}

.toast_content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
  padding-top: $spacing-4;
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
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

// Starts at 12 o'clock; the empty arc grows clockwise from there.
.toast_countdown {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  transform: rotate(-90deg);

  circle {
    fill: none;
    stroke: $color-accent;
    stroke-width: 1.68px;
  }
}

.toast_close .toast_closeButton {
  width: 24px;
  height: 24px;
  border-radius: 50%;

  svg {
    width: 12px;
    height: 12px;
  }
}
</style>
