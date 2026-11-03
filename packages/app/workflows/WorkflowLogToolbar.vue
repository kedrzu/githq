<!-- The log pane's head (actions W4a): the job and how far its log is, then whatever the log viewer puts at its end. -->
<script lang="ts" setup>
defineProps<{
  /** The job's name; `null` while none is known. */
  job: string | null;
  /** "2,086 lines · 176 KB", or what stands in for it. */
  size: string;
}>();

defineSlots<{
  /** At the end of the head. */
  default?(): unknown;
}>();
</script>

<template>
  <div :class="css.workflowLogToolbar">
    <span
      v-if="job !== null"
      :class="css.workflowLogToolbar_job"
      >{{ job }}</span
    >
    <span
      :class="css.workflowLogToolbar_size"
      tid="workflow-log-size"
      >{{ size }}</span
    >
    <span :class="css.workflowLogToolbar_spacer" />
    <slot />
  </div>
</template>

<style lang="scss" module="css">
.workflowLogToolbar {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-12 0 $spacing-14;
  font-size: $font-size-xs;
  border-bottom: 1px solid $color-border;
}

.workflowLogToolbar_job {
  overflow: hidden;
  font-family: $font-family-mono;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowLogToolbar_size {
  flex: none;
  color: $color-fg-dim;
}

.workflowLogToolbar_spacer {
  flex: 1;
}
</style>
