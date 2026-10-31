<!-- An item's state as a filled pill — "Open", "Closed", "Merged", "Draft" — in the colour GitHub gives it: green open, purple done, red closed unmerged or not planned, grey draft. -->
<script lang="ts">
/** `open` green, `done` purple (completed, merged), `closed` red (not planned, closed unmerged), `draft` grey. */
export type StatePillTone = 'closed' | 'done' | 'draft' | 'open';
</script>

<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    icon: LucideIcon;
    /** `open` when not given. */
    tone?: StatePillTone;
  }>(),
  { tone: 'open' },
);

defineSlots<{
  /** The state's name. */
  default(): unknown;
}>();
</script>

<template>
  <span :class="[css.statePill, css[`statePill_${tone}`]]">
    <component
      :is="icon"
      :class="css.statePill_icon"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>

<style lang="scss" module="css">
.statePill {
  display: inline-flex;
  flex: none;
  gap: 5px;
  align-items: center;
  padding: 3px $spacing-8;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  line-height: 15px;
  white-space: nowrap;
  border-radius: 12px;
}

.statePill_icon {
  width: 12px;
  height: 12px;
}

.statePill_open {
  color: $color-green;
  background: rgba($color-green, 0.12);
}

.statePill_done {
  color: $color-purple;
  background: rgba($color-purple, 0.14);
}

.statePill_closed {
  color: $color-red;
  background: rgba($color-red, 0.12);
}

.statePill_draft {
  color: $color-fg-2;
  background: $color-bg-3;
}
</style>
