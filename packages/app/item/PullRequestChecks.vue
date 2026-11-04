<!-- The checks of an opened pull request's head commit (F1–F4): how many of each under their title, over their list (`CheckList`), whose links all go to GitHub. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import type { ItemCheckState, PullRequestDetail } from '@/store/ItemDetailTypes.js';

import CheckList from './CheckList.vue';
import * as l from './PullRequestChecks.loc.js';

const props = defineProps<{
  detail: PullRequestDetail;
  /** Epoch ms a running check's time is counted to. */
  now: number;
  /**
   * The checks the base branch requires to pass, by id: a failing one is tagged. Only the merge options say it
   * (`PullRequestMergeOptions`); none until they are read.
   */
  requiredIds?: readonly string[] | null;
}>();

const t = useTranslate();

const summary = computed(() => {
  const counts: Record<ItemCheckState, number> = { failing: 0, pending: 0, passing: 0, skipped: 0 };
  for (const check of props.detail.checks) {
    counts[check.state]++;
  }

  const { failing, pending, passing, skipped } = counts;
  const parts: string[] = [];
  if (failing > 0) {
    parts.push(t(l.failingCount, { count: failing }));
  }

  if (pending > 0) {
    parts.push(t(l.runningCount, { count: pending }));
  }

  if (passing > 0) {
    parts.push(t(l.passedCount, { count: passing }));
  }

  if (skipped > 0) {
    parts.push(t(l.skippedCount, { count: skipped }));
  }

  return parts.join(' · ');
});
</script>

<template>
  <section
    v-if="detail.checks.length > 0"
    :class="css.pullRequestChecks"
  >
    <h2 :class="css.pullRequestChecks_header">
      <span :class="css.pullRequestChecks_title">{{ t(l.checks) }}</span>
      <span :class="css.pullRequestChecks_summary">{{ summary }}</span>
    </h2>
    <CheckList
      :checks="detail.checks"
      :check-count="detail.checkCount"
      :more-url="`${detail.item.url}/checks`"
      :now="now"
      :required-ids="requiredIds"
    />
  </section>
</template>

<style lang="scss" module="css">
.pullRequestChecks {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pullRequestChecks_header {
  display: flex;
  gap: $spacing-8;
  padding-bottom: $spacing-6;
  font-size: $font-size-xs;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.pullRequestChecks_title {
  font-weight: $font-weight-medium;
}
</style>
