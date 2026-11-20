<!-- A square button showing only a glyph — a lucide icon, or the default slot (an avatar) — on nzyme's `useButton`, so an async action keeps it busy and ignores clicks meanwhile. Its `label` is its accessible name and its tooltip, with its key when it has one. Which size where: `docs/design/githq/buttons.md`. -->
<script lang="ts">
import { useButton } from '@nzyme/vue-forms/components/useButton.js';
import { defineProp } from '@nzyme/vue-utils/defineProp.js';
import type { LucideIcon } from 'lucide-vue-next';

/**
 * On the buttons' scale: `sm` (24 × 24) beside `sm` buttons and in headers, `md` (32 × 32) beside `md` ones; `rail`
 * (38 × 34) on the sidebar's rail.
 */
export type IconButtonSize = 'md' | 'rail' | 'sm';

/** nzyme's button props (`type`, `busy`, `disabled`, `link`, `noWait`), the glyph, its label and the size. */
export const IconButtonProps = {
  ...useButton.props,
  /** The glyph; the default slot replaces it. */
  icon: defineProp<LucideIcon>(),
  /** What the button does ("Collapse sidebar"): its accessible name and tooltip. */
  label: defineProp<string>({ type: String, required: true }),
  /** The button's key, shown in the tooltip (`Mod+B`). Give it to `keyshortcuts` too. */
  kbd: defineProp<string>(),
  /** The keys that press it, as `aria-keyshortcuts` writes them (`formatAriaKeyShortcuts`). */
  keyshortcuts: defineProp<string>(),
  /** Shown but not possible yet: dimmed and announced as unavailable (`aria-disabled`), still focusable. */
  unavailable: defineProp<boolean>({ type: Boolean, default: false }),
  /** `sm` when not given. */
  size: defineProp<IconButtonSize>(),
};
</script>

<script lang="ts" setup>
import { LoaderCircle } from 'lucide-vue-next';

import Tooltip from './Tooltip.vue';

// The root is the tooltip; attributes (a menu trigger's handlers and state) belong on the button.
defineOptions({ inheritAttrs: false });

defineProps(IconButtonProps);
defineEmits(useButton.emits);
defineSlots<{
  /** A glyph other than an icon (the account's avatar on the rail). */
  default?(): unknown;
}>();

const { Button, busy, disabled } = useButton();
</script>

<template>
  <Tooltip
    :text="label"
    :kbd="kbd ?? undefined"
    side="right"
  >
    <!-- Before the attributes: a caller's `data-button-size` (a split button's chevron) wins. -->
    <Button
      :data-button-size="size ?? 'sm'"
      v-bind="$attrs"
      :class="[css.iconButton, css[`iconButton_${size ?? 'sm'}`], busy && css.iconButton_busy]"
      :aria-label="label"
      :aria-busy="busy || undefined"
      :aria-disabled="(link && disabled) || unavailable || undefined"
      :aria-keyshortcuts="keyshortcuts ?? undefined"
    >
      <LoaderCircle
        v-if="busy"
        :class="[css.iconButton_glyph, css.iconButton_spin]"
        aria-hidden="true"
      />
      <slot v-else>
        <component
          :is="icon"
          :class="css.iconButton_glyph"
          aria-hidden="true"
        />
      </slot>
    </Button>
  </Tooltip>
</template>

<style lang="scss" module="css">
.iconButton {
  @include focus-ring;

  // A caller restyles one as a segment of a joined control with `--icon-button-padding`, `--icon-button-color`,
  // `--icon-button-background`, `--icon-button-border` (`--icon-button-border-start` for its start alone),
  // `--icon-button-radius` and the hover colours `--icon-button-hover-color` and `--icon-button-hover-background` (a
  // split button's chevron).
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: var(--icon-button-padding, 0);
  color: var(--icon-button-color, #{$color-fg-2});
  cursor: pointer;
  background: var(--icon-button-background, none);
  border: var(--icon-button-border, none);
  border-inline-start: var(--icon-button-border-start, var(--icon-button-border, none));

  &:hover,
  &[aria-expanded='true'] {
    color: var(--icon-button-hover-color, #{$color-fg});
    background: var(--icon-button-hover-background, #{$color-bg-3});
  }

  &:disabled,
  &[aria-disabled='true'] {
    cursor: default;

    &:hover {
      color: var(--icon-button-color, #{$color-fg-2});
      background: var(--icon-button-background, none);
    }
  }
}

// A caller sizes an `sm` or `md` one with `--icon-button-width` and `--icon-button-height` (`auto`: as tall as what it is
// joined to), its corners with `--icon-button-radius` and its glyph with `--icon-button-glyph-size` (a split button's
// chevron). The rail's keeps its own.
.iconButton_glyph {
  width: var(--icon-button-glyph-size, var(--icon-button-size-glyph));
  height: var(--icon-button-glyph-size, var(--icon-button-size-glyph));
}

.iconButton_sm {
  --icon-button-size-glyph: 14px;

  width: var(--icon-button-width, 24px);
  height: var(--icon-button-height, 24px);
  border-radius: var(--icon-button-radius, #{$radius-md});
}

.iconButton_md {
  --icon-button-size-glyph: 16px;

  width: var(--icon-button-width, 32px);
  height: var(--icon-button-height, 32px);
  border-radius: var(--icon-button-radius, 7px);
}

.iconButton_rail {
  width: 38px;
  height: 34px;
  border-radius: 7px;

  .iconButton_glyph {
    width: 16px;
    height: 16px;
  }
}

.iconButton_busy {
  cursor: progress;
}

.iconButton_spin {
  animation: icon-button-spin 0.8s linear infinite;
}

@keyframes icon-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
