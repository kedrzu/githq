<!-- A pattern as a chip (`Workflow alerts / Pattern`): typed by the user, so in mono and outlined — never like the default branch (`WorkflowRefChip`). -->
<script lang="ts" setup>
defineProps<{
  pattern: string;
}>();
</script>

<template>
  <code :class="css.workflowPatternChip">{{ pattern }}</code>
</template>

<style lang="scss" module="css">
.workflowPatternChip {
  padding: 1px $spacing-6;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}
</style>
