<!-- A square button showing only a glyph — a lucide icon, or the default slot (an avatar) — on nzyme's `useButton`, so an async action keeps it busy and ignores clicks meanwhile. Its `label` is its accessible name and its tooltip, with its key when it has one. -->
<script lang="ts">
import { useButton } from '@nzyme/vue-forms/components/useButton.js';
import { defineProp } from '@nzyme/vue-utils/defineProp.js';
import type { LucideIcon } from 'lucide-vue-next';

/** `sm` (22px) in a header next to text, `md` (38×34) on the sidebar's rail. */
export type IconButtonSize = 'md' | 'sm';

/** nzyme's button props (`type`, `busy`, `disabled`, `link`, `noWait`), the glyph, its label and the size. */
export const IconButtonProps = {
  ...useButton.props,
  /** The glyph; the default slot replaces it. */
  icon: defineProp<LucideIcon>(),
  /** What the button does ("Collapse sidebar"): its accessible name and tooltip. */
  label: defineProp<string>({ type: String, required: true }),
  /** The button's key, shown in the tooltip ("["). Give it to `aria-keyshortcuts` too. */
  kbd: defineProp<string>(),
  /** `sm` when not given. */
  size: defineProp<IconButtonSize>(),
};
</script>

<script lang="ts" setup>
import { LoaderCircle } from 'lucide-vue-next';

import Tooltip from './Tooltip.vue';

// The root is the tooltip; attributes (`aria-keyshortcuts`, `aria-disabled`, a menu trigger's handlers) belong
// on the button.
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
    <Button
      v-bind="$attrs"
      :class="[css.iconButton, css[`iconButton_${size ?? 'sm'}`], busy && css.iconButton_busy]"
      :aria-label="label"
      :aria-busy="busy || undefined"
      :aria-disabled="(link && disabled) || undefined"
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

  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: $color-fg-2;
  cursor: pointer;
  background: none;
  border: none;

  &:hover,
  &[aria-expanded='true'] {
    color: $color-fg;
    background: $color-bg-3;
  }

  &:disabled,
  &[aria-disabled='true'] {
    cursor: default;

    &:hover {
      color: $color-fg-2;
      background: none;
    }
  }
}

.iconButton_sm {
  width: 22px;
  height: 22px;
  border-radius: 5px;

  .iconButton_glyph {
    width: 15px;
    height: 15px;
  }
}

.iconButton_md {
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
