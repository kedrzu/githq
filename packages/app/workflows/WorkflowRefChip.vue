<!-- A branch or a tag as a chip (`Workflow alerts / Ref`): its kind's icon and its name in mono, on a filled ground — never outlined, so it never looks like a pattern the user typed. -->
<script lang="ts" setup>
import { GitBranch, Tag } from 'lucide-vue-next';

import type { RefKind } from './WorkflowTypes.js';

defineProps<{
  name: string;
  kind: RefKind;
}>();
</script>

<template>
  <span :class="css.workflowRefChip">
    <component
      :is="kind === 'tag' ? Tag : GitBranch"
      :class="css.workflowRefChip_icon"
      aria-hidden="true"
    />
    <span :class="css.workflowRefChip_name">{{ name }}</span>
  </span>
</template>

<style lang="scss" module="css">
.workflowRefChip {
  display: inline-flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  max-width: 100%;
  padding: 2px $spacing-6;
  background: $color-bg-3;
  border-radius: $radius-sm;
}

.workflowRefChip_icon {
  flex: none;
  width: 11px;
  height: 11px;
  color: $color-fg-3;
}

.workflowRefChip_name {
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
