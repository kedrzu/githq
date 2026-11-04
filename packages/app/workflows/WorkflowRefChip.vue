<!-- A branch or a tag as a chip (`Workflow alerts / Ref`): its kind's icon and its name in mono, on a filled ground — never outlined, so it never looks like a pattern the user typed. -->
<script lang="ts" setup>
import WorkflowRefLabel from './WorkflowRefLabel.vue';
import type { RefKind } from './WorkflowTypes.js';

defineProps<{
  name: string;
  kind: RefKind;
  /** `name` is words standing in for a name not known yet ("default branch"): not in mono. */
  text?: boolean;
}>();
</script>

<template>
  <span :class="css.workflowRefChip">
    <WorkflowRefLabel
      :name="name"
      :kind="kind"
      :text="text"
      compact
    />
  </span>
</template>

<style lang="scss" module="css">
.workflowRefChip {
  display: inline-flex;
  flex: none;
  max-width: 100%;
  padding: $spacing-2 $spacing-6;
  background: $color-bg-3;
  border-radius: $radius-sm;
}
</style>
