<!-- What a workflows screen says when it has no rows to show (actions): nothing broken, not read yet, no workflows, Actions unavailable. A thin icon — its tone the only colour: green for good news, red, amber, or neutral grey —, a title, a line of text, an optional technical detail in a mono chip, and the ways on. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    icon: LucideIcon;
    /** The icon's colour; everything else stays grey. */
    tone?: 'amber' | 'green' | 'neutral' | 'red';
    title: string;
    text: string;
    /** A technical detail in a mono chip: `GET /repos/fitloop/webapp/actions/runs → 403`. */
    detail?: string | null;
  }>(),
  { tone: 'neutral', detail: null },
);

defineSlots<{
  /** The ways on: `Button`s. */
  actions?(): unknown;
}>();
</script>

<template>
  <div :class="css.workflowEmptyState">
    <component
      :is="icon"
      :class="[css.workflowEmptyState_icon, css[`workflowEmptyState_icon_${tone}`]]"
      :stroke-width="1"
      aria-hidden="true"
    />
    <div :class="css.workflowEmptyState_copy">
      <h2 :class="css.workflowEmptyState_title">{{ title }}</h2>
      <p :class="css.workflowEmptyState_text">{{ text }}</p>
    </div>
    <code
      v-if="detail"
      :class="css.workflowEmptyState_detail"
      >{{ detail }}</code
    >
    <div
      v-if="$slots.actions"
      :class="css.workflowEmptyState_actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.workflowEmptyState {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
  align-items: center;
  width: 460px;
  max-width: 100%;
}

.workflowEmptyState_icon {
  width: 40px;
  height: 40px;
  color: $color-fg-2;
}

.workflowEmptyState_icon_green {
  color: $color-green;
}

.workflowEmptyState_icon_red {
  color: $color-red;
}

.workflowEmptyState_icon_amber {
  color: $color-amber;
}

.workflowEmptyState_copy {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  align-items: center;
  width: 100%;
}

.workflowEmptyState_title {
  font-size: $font-size-xl;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.workflowEmptyState_text {
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-2;
  text-align: center;
}

// `fg-dim`, not the design's `fg-3`: text in `fg-3` misses AA contrast (`tokens.scss`).
.workflowEmptyState_detail {
  padding: $spacing-4 $spacing-8;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.workflowEmptyState_actions {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}
</style>
