<!-- A text button on nzyme's `useButton`: a `click` listener that returns a promise keeps it busy — spinner, `aria-busy`, further clicks ignored — until the promise settles; `type="submit"` submits the surrounding `Form` and is busy while it does. With `link` it is an anchor. An optional leading icon and a trailing keyboard hint (`Kbd`). -->
<script lang="ts">
import { useButton } from '@nzyme/vue-forms/components/useButton.js';
import { defineProp } from '@nzyme/vue-utils/defineProp.js';
import type { LucideIcon } from 'lucide-vue-next';

/**
 * - `primary`: accent fill, the screen's one main action ("Track these", "Create issue").
 * - `light`: light fill, the main action of a page with nothing else on it ("Sign in with GitHub").
 * - `secondary`: raised neutral fill with an outline, next to a primary ("Only my repositories").
 * - `outline`: outline only, quieter tools of a toolbar ("Group: Reason").
 * - `ghost`: no fill until hovered, toolbars and menus' triggers ("Filter").
 * - `link`: text only, inline in a sentence ("Why?") or a row's meta line ("Open on GitHub").
 * - `field`: looks like a text field, for a button that opens one ("Search… ⌘K" in the sidebar).
 * - `danger`: red outline, an action that deletes something ("Sign out and clear").
 */
export type ButtonVariant = 'danger' | 'field' | 'ghost' | 'light' | 'link' | 'outline' | 'primary' | 'secondary';

/** `sm` toolbars, `md` forms and footers, `lg` a page's single call to action. */
export type ButtonSize = 'lg' | 'md' | 'sm';

/** nzyme's button props (`type`, `busy`, `disabled`, `link`, `noWait`) and the look. */
export const ButtonProps = {
  ...useButton.props,
  /** `secondary` when not given. */
  variant: defineProp<ButtonVariant>(),
  /** `md` when not given. */
  size: defineProp<ButtonSize>(),
  /** Leading icon, a lucide component. */
  icon: defineProp<LucideIcon>(),
  /** Keyboard hint after the label ("⌘↵"). Only drawn: give the shortcut to `aria-keyshortcuts` too. */
  kbd: defineProp<string>(),
  /** Fills its container's width, the content at the start and the hint at the end — a sidebar entry, a field. */
  block: defineProp<boolean>({ type: Boolean, default: false }),
};
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { LoaderCircle } from 'lucide-vue-next';
import { computed } from 'vue';

import * as l from './Button.loc.js';
import Kbd from './Kbd.vue';

const props = defineProps(ButtonProps);
defineEmits(useButton.emits);
defineSlots<{ default?(): unknown }>();

const { Button, busy, disabled } = useButton();
const t = useTranslate();

const variant = computed(() => props.variant ?? 'secondary');
const kbdTone = computed(() => (variant.value === 'primary' || variant.value === 'light' ? 'onFill' : 'default'));
</script>

<template>
  <Button
    :class="[
      css.button,
      css[`button_${variant}`],
      css[`button_${size ?? 'md'}`],
      block && css.button_block,
      busy && css.button_busy,
      disabled && css.button_disabled,
    ]"
    :aria-busy="busy || undefined"
    :aria-disabled="(link && disabled) || undefined"
  >
    <!-- Hidden, not removed, while busy: the button keeps its width under the spinner. -->
    <span :class="css.button_content">
      <component
        :is="icon"
        v-if="icon"
        :class="css.button_icon"
        aria-hidden="true"
      />
      <slot />
      <Kbd
        v-if="kbd"
        :class="css.button_kbd"
        :tone="kbdTone"
        :size="size === 'sm' ? 'sm' : 'md'"
        :keys="kbd"
      />
    </span>
    <span
      v-if="busy"
      :class="css.button_spinner"
    >
      <LoaderCircle
        :class="[css.button_icon, css.button_spin]"
        aria-hidden="true"
      />
      <span :class="css.button_busyText">{{ t(l.busy) }}</span>
    </span>
  </Button>
</template>

<style lang="scss" module="css">
.button {
  @include focus-ring;

  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-family: $font-family-sans;
  font-weight: $font-weight-medium;
  line-height: 18px;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  background: none;
  border: 1px solid transparent;
  border-radius: 7px;
}

.button_content {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  min-width: 0;

  .button_busy & {
    opacity: 0;
  }
}

.button_icon {
  flex: none;
  width: 14px;
  height: 14px;
}

.button_block {
  display: flex;
  width: 100%;
  justify-content: flex-start;
  text-align: left;

  .button_content {
    flex: 1;
  }

  .button_kbd {
    margin-left: auto;
  }
}

.button_sm {
  padding: 3px 7px;
  font-size: $font-size-xs;
  font-weight: $font-weight-normal;
  line-height: 16px;
  border-radius: $radius-md;

  .button_content {
    gap: $spacing-6;
  }
}

.button_md {
  padding: 6px 11px;
  font-size: $font-size-md;
}

.button_lg {
  padding: 9px 15px;
  font-size: $font-size-lg;
}

.button_primary {
  color: $color-on-light;
  background: $color-accent;

  &:hover {
    background: color-mix(in srgb, #{$color-accent} 88%, white);
  }
}

.button_light {
  color: $color-on-light;
  background: $color-button-light;

  &:hover {
    background: $color-button-light-hover;
  }
}

.button_secondary {
  color: $color-fg;
  background: $color-bg-3;
  border-color: $color-border-2;

  &:hover {
    background: $color-border;
  }
}

.button_outline {
  color: $color-fg-2;
  border-color: $color-border;

  &:hover {
    color: $color-fg;
    background: $color-bg-2;
  }
}

.button_danger {
  color: $color-red;
  background: rgba($color-red, 0.06);
  border-color: rgba($color-red, 0.45);

  &:hover {
    background: rgba($color-red, 0.14);
  }
}

.button_ghost {
  color: $color-fg-2;

  // Hovered, or its menu open.
  &:hover,
  &[aria-expanded='true'] {
    color: $color-fg;
    background: $color-bg-3;
  }

  &.button_md {
    padding-inline: 7px;
  }
}

.button_link {
  padding: 0;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  color: $color-fg-2;
  border: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}

.button_field {
  padding: $spacing-6 $spacing-8;
  font-size: $font-size-sm;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
  cursor: text;
  background: $color-bg;
  border-color: $color-border;
  border-radius: $radius-md;

  .button_icon {
    color: $color-fg-3;
  }
}

.button_busy {
  cursor: progress;
}

// Disabled, or shown but not built yet (`aria-disabled`, still focusable): no hover, dim.
.button_disabled,
.button[aria-disabled='true'] {
  cursor: default;

  &.button_primary,
  &.button_light,
  &.button_secondary {
    opacity: 0.5;
  }

  &.button_outline,
  &.button_ghost,
  &.button_link {
    color: $color-fg-dim;
    background: none;
  }

  &.button_primary:hover {
    background: $color-accent;
  }

  &.button_light:hover {
    background: $color-button-light;
  }

  &.button_secondary:hover {
    background: $color-bg-3;
  }
}

// Over the hidden content, centred in the button.
.button_spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.button_spin {
  animation: button-spin 0.8s linear infinite;
}

.button_busyText {
  @include visually-hidden;
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
