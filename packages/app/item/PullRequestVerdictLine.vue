<!-- A pull request's verdict as one line on its tone's tint — "Ready to merge · Approved · checks passed · no conflicts": the opened item's merge standing and the merge panel draw it the same (PM38). As a heading where it heads a section (`tag="h2"`); `inset` is the line's side padding, to match what it sits in. -->
<script lang="ts" setup>
import type { PullRequestVerdict } from './usePullRequestVerdict.js';

withDefaults(
  defineProps<{
    verdict: PullRequestVerdict;
    /** `p` when not given. */
    tag?: 'h2' | 'p';
    /** The side padding: `md` (12px) beside the standing's other lines, `lg` (14px) in the merge panel. */
    inset?: 'lg' | 'md';
  }>(),
  { tag: 'p', inset: 'md' },
);
</script>

<template>
  <component
    :is="tag"
    :class="[
      css.pullRequestVerdictLine,
      css[`pullRequestVerdictLine_${verdict.tone}`],
      css[`pullRequestVerdictLine_${inset}`],
    ]"
  >
    <component
      :is="verdict.icon"
      :class="css.pullRequestVerdictLine_icon"
      aria-hidden="true"
    />
    <strong :class="css.pullRequestVerdictLine_title">{{ verdict.text }}</strong>
    <span
      v-if="verdict.aside"
      :class="css.pullRequestVerdictLine_aside"
      >{{ verdict.aside }}</span
    >
  </component>
</template>

<style lang="scss" module="css">
.pullRequestVerdictLine {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding-block: $spacing-10;
  margin: 0;
  font-size: $font-size-sm;
  font-weight: $font-weight-normal;
  white-space: nowrap;
}

.pullRequestVerdictLine_md {
  padding-inline: $spacing-12;
}

.pullRequestVerdictLine_lg {
  padding-inline: 14px;
}

.pullRequestVerdictLine_accent {
  --pullRequestVerdictLine-color: #{$color-accent};

  background: rgba($color-accent, 0.08);
}

.pullRequestVerdictLine_success {
  --pullRequestVerdictLine-color: #{$color-green};

  background: rgba($color-green, 0.08);
}

.pullRequestVerdictLine_danger {
  --pullRequestVerdictLine-color: #{$color-red};

  background: rgba($color-red, 0.08);
}

.pullRequestVerdictLine_warning {
  --pullRequestVerdictLine-color: #{$color-amber};

  background: rgba($color-amber, 0.08);
}

.pullRequestVerdictLine_done {
  --pullRequestVerdictLine-color: #{$color-purple};

  background: rgba($color-purple, 0.08);
}

.pullRequestVerdictLine_muted {
  --pullRequestVerdictLine-color: #{$color-fg-3};
}

.pullRequestVerdictLine_icon {
  flex: none;
  width: 15px;
  height: 15px;
  color: var(--pullRequestVerdictLine-color);
}

.pullRequestVerdictLine_title {
  flex: none;
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.pullRequestVerdictLine_aside {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-2;
}
</style>
