<!-- A switch of the review shown as a glyph (`Review / Toggle`): hide viewed, regular expression. An outline, lit while on; `quiet` has no outline until then, inside a field; `panel` is one of the toolbar's two column toggles (`Panels`), a filled square while on. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

import IconButton from '@/components/IconButton.vue';

defineProps<{
  icon: LucideIcon;
  /** What it switches: its accessible name and tooltip. */
  label: string;
  pressed: boolean;
  /** Its key, shown in the tooltip. */
  kbd?: string;
  quiet?: boolean;
  panel?: boolean;
}>();
</script>

<template>
  <IconButton
    :class="panel ? css.reviewToggle_panel : [css.reviewToggle, quiet && css.reviewToggle_quiet]"
    :icon="icon"
    :label="label"
    :kbd="kbd"
    :aria-pressed="pressed"
    :aria-keyshortcuts="kbd"
  />
</template>

<style lang="scss" module="css">
.reviewToggle {
  border: 1px solid $color-border;

  &[aria-pressed='true'] {
    color: $color-accent;
    background: color-mix(in srgb, #{$color-accent} 15%, transparent);
    border-color: $color-accent;
  }
}

.reviewToggle_quiet {
  width: 20px;
  height: 20px;
  border-color: transparent;
}
.reviewToggle_panel {
  width: 24px;
  height: 20px;
  color: $color-fg-3;
  border-radius: 4px;

  &[aria-pressed='true'] {
    color: $color-fg;
    background: $color-bg-3;
  }
}
</style>
