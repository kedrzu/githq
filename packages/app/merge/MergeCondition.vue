<!-- A condition of the merge in the merge panel, in one line (PM13, PM19–PM22): its icon in its tone, what it is ("Reviews", "Branch"), how it stands, a quieter aside, and what it offers at the end (the checks' chevron). -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

import type { PullRequestVerdictTone } from '@/item/usePullRequestVerdict.js';

defineProps<{
  icon: LucideIcon;
  tone: PullRequestVerdictTone;
  label: string;
  text: string;
  aside?: string | null;
}>();
</script>

<template>
  <div :class="css.mergeCondition">
    <component
      :is="icon"
      :class="[css.mergeCondition_icon, css[`mergeCondition_icon_${tone}`]]"
      aria-hidden="true"
    />
    <span :class="css.mergeCondition_label">{{ label }}</span>
    <span :class="css.mergeCondition_text">{{ text }}</span>
    <span
      v-if="aside"
      :class="css.mergeCondition_aside"
      >{{ aside }}</span
    >
    <slot />
  </div>
</template>

<style lang="scss" module="css">
.mergeCondition {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 22px;
  padding: 6px 10px 6px 14px;
  font-size: $font-size-sm;
  white-space: nowrap;
}

.mergeCondition_label {
  flex: none;
  min-width: 72px;
  color: $color-fg-dim;
}

.mergeCondition_text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg;
}

.mergeCondition_aside {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.mergeCondition_icon {
  flex: none;
  width: 13px;
  height: 13px;
}

.mergeCondition_icon_accent {
  color: $color-accent;
}

.mergeCondition_icon_danger {
  color: $color-red;
}

.mergeCondition_icon_warning {
  color: $color-amber;
}

.mergeCondition_icon_success {
  color: $color-green;
}

.mergeCondition_icon_done {
  color: $color-purple;
}

.mergeCondition_icon_muted {
  color: $color-fg-3;
}
</style>
