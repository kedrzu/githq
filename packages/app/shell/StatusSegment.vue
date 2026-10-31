<!-- One segment of the status bar (`StatusBar`): what the surface above it shows and how fresh it is — dim when all is well, grey while downloading or sending the user's edits, purple when it is slower by design (a view GitHub answers), amber when something is off, red when an edit failed. Fills the width left unless given one, with dim words at its end if any. With `action` it is a button (an edit failed: click for why). -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    /** A lucide icon before the text ("✓" for up to date). */
    icon?: LucideIcon;
    /**
     * `dim`: all is well; `muted`: nothing wrong, but not done (downloading, sending); `warning`: older than it
     * should be; `danger`: the user's edit failed; `expected`: slower than the rest, but by design (a view GitHub
     * answers, K6).
     */
    tone?: 'danger' | 'dim' | 'expected' | 'muted' | 'warning';
    /** A button: clicking it is `click`. */
    action?: boolean;
  }>(),
  { icon: undefined, tone: 'dim' },
);

const emit = defineEmits<{
  click: [];
}>();

defineSlots<{
  default?(): unknown;
  /** Dim words at the segment's end ("edits still go through"). */
  detail?(): unknown;
}>();
</script>

<template>
  <component
    :is="action ? 'button' : 'div'"
    :type="action ? 'button' : undefined"
    :class="[css.statusSegment, css[`statusSegment_${tone}`], action && css.statusSegment_action]"
    @click="action && emit('click')"
  >
    <component
      :is="icon"
      v-if="icon"
      :class="css.statusSegment_icon"
      aria-hidden="true"
    />
    <span
      v-if="$slots.default"
      :class="css.statusSegment_text"
      ><slot
    /></span>
    <span
      v-if="$slots.detail"
      :class="css.statusSegment_detail"
      ><slot name="detail"
    /></span>
  </component>
</template>

<style lang="scss" module="css">
.statusSegment_action {
  @include focus-ring;

  font: inherit;
  text-align: left;
  cursor: pointer;
  border-top: none;
  border-right: none;
  border-bottom: none;
}

.statusSegment {
  display: flex;
  flex: 1;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
  padding: 0 $spacing-12;
  overflow: hidden;
  white-space: nowrap;
  border-left: 1px solid $color-border;

  // The sidebar's own (refresh paused, K3): nothing on its left to be told apart from.
  &:first-child {
    border-left: none;
  }
}

.statusSegment_icon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.statusSegment_text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.statusSegment_detail {
  flex: none;
  margin-left: auto;
  color: $color-fg-dim;
}

.statusSegment_dim {
  color: $color-fg-dim;
}

.statusSegment_muted {
  color: $color-fg-2;

  .statusSegment_icon {
    color: $color-fg-2;
  }
}

.statusSegment_danger {
  color: $color-red;
  background: rgba($color-red, 0.08);

  .statusSegment_icon {
    color: $color-red;
  }
}

.statusSegment_expected {
  color: $color-purple;

  .statusSegment_icon {
    color: $color-purple;
  }
}

.statusSegment_warning {
  color: $color-amber;
  background: rgba($color-amber, 0.08);

  .statusSegment_icon {
    color: $color-amber;
  }
}
</style>
