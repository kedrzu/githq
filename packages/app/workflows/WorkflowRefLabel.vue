<!-- A ref named on a workflow's row or a run's line: its kind's icon and its name in mono, cut short when it does not fit. Its width is the caller's. A `WorkflowRefChip` sets it on a ground, `compact`. -->
<script lang="ts" setup>
import { GitBranch, GitPullRequest, Tag } from 'lucide-vue-next';

import type { RefKind } from './WorkflowTypes.js';

defineProps<{
  name: string;
  /** `pullRequests`: not a ref, what a workflow only pull requests ran is read on. */
  kind: RefKind | 'pullRequests';
  /** `name` is words rather than a ref's name: in the surrounding font, not in mono. */
  text?: boolean;
  /** The size of a chip. */
  compact?: boolean;
}>();

const ICONS = {
  branch: GitBranch,
  tag: Tag,
  pullRequests: GitPullRequest,
} as const;
</script>

<template>
  <span :class="[css.workflowRefLabel, compact && css.workflowRefLabel_compact]">
    <component
      :is="ICONS[kind]"
      :class="css.workflowRefLabel_icon"
      aria-hidden="true"
    />
    <span :class="[css.workflowRefLabel_name, text && css.workflowRefLabel_name_text]">{{ name }}</span>
  </span>
</template>

<style lang="scss" module="css">
.workflowRefLabel {
  display: flex;
  gap: $spacing-5;
  align-items: center;
  min-width: 0;
}

.workflowRefLabel_compact {
  gap: $spacing-4;
}

.workflowRefLabel_icon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;

  .workflowRefLabel_compact & {
    width: 11px;
    height: 11px;
  }
}

.workflowRefLabel_name {
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRefLabel_name_text {
  font-family: inherit;
}
</style>
