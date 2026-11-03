<!-- A branch or tag pointing at a commit, before its headline (git-client D18, CH12): a small bordered chip in mono with a branch or tag icon — the default branch's border and text stronger — or "+N" for the refs past the ones shown. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { GitBranch, Tag } from 'lucide-vue-next';
import { computed } from 'vue';

const props = defineProps<{
  /** `more`: the chip counting the refs not shown, `label` its "+N". */
  kind: 'branch' | 'default' | 'more' | 'tag';
  label: string;
}>();

const icon = computed(() => {
  switch (props.kind) {
    case 'tag':
      return Tag;
    case 'branch':
    case 'default':
      return GitBranch;
    case 'more':
      return null;
    default:
      return assertNever(props.kind);
  }
});
</script>

<template>
  <span :class="[css.commitRefChip, css[`commitRefChip_${kind}`]]">
    <component
      :is="icon"
      v-if="icon"
      :class="css.commitRefChip_icon"
      aria-hidden="true"
    />
    {{ label }}
  </span>
</template>

<style lang="scss" module="css">
.commitRefChip {
  display: inline-flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  height: 18px;
  padding: 0 $spacing-5;
  font-family: $font-family-mono;
  font-size: $font-size-3xs;
  color: $color-fg-2;
  white-space: nowrap;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.commitRefChip_default {
  color: $color-fg;
  border-color: $color-fg-3;
}

.commitRefChip_icon {
  flex: none;
  width: 11px;
  height: 11px;
}
</style>
