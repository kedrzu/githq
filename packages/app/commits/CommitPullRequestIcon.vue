<!-- The state of a commit's pull request as an icon named for screen readers: open, draft, merged or closed (git-client D18), in a row's marks and in the commit's details; with `pill`, the icon and the state's word in a tinted pill, as a submodule's pull request card shows it. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';

import * as l from './CommitPullRequestIcon.loc.js';
import type { CommitPullRequest } from './CommitTypes.js';

const props = defineProps<{
  pullRequest: CommitPullRequest;
  /** The icon and the state's word, in a pill tinted in the state's tone. */
  pill?: boolean;
}>();

interface PullRequestLook {
  readonly icon: LucideIcon;
  readonly tone: 'danger' | 'done' | 'muted' | 'success';
  readonly label: string;
  /** The state alone, for the pill. */
  readonly word: string;
}

const t = useTranslate();

const look = computed((): PullRequestLook => {
  const { state, isDraft } = props.pullRequest;
  switch (state) {
    case 'OPEN':
      return isDraft
        ? { icon: GitPullRequestDraft, tone: 'muted', label: t(l.draft), word: t(l.draftWord) }
        : { icon: GitPullRequest, tone: 'success', label: t(l.open), word: t(l.openWord) };
    case 'MERGED':
      return { icon: GitMerge, tone: 'done', label: t(l.merged), word: t(l.mergedWord) };
    case 'CLOSED':
      return { icon: GitPullRequestClosed, tone: 'danger', label: t(l.closed), word: t(l.closedWord) };
    default:
      return assertNever(state);
  }
});
</script>

<template>
  <span
    v-if="pill"
    :class="[css.commitPullRequestIcon_pill, css[`commitPullRequestIcon_${look.tone}`]]"
  >
    <component
      :is="look.icon"
      :class="css.commitPullRequestIcon"
      aria-hidden="true"
    />
    {{ look.word }}
  </span>
  <component
    :is="look.icon"
    v-else
    :class="[css.commitPullRequestIcon, css[`commitPullRequestIcon_${look.tone}`]]"
    role="img"
    :aria-label="look.label"
  />
</template>

<style lang="scss" module="css">
.commitPullRequestIcon {
  flex: none;
  width: 13px;
  height: 13px;
}

.commitPullRequestIcon_pill {
  display: inline-flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  padding: 1px $spacing-8;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  line-height: 18px;
  background: color-mix(in srgb, currentcolor 10%, transparent);
  border: 1px solid color-mix(in srgb, currentcolor 35%, transparent);
  border-radius: 999px;
}

.commitPullRequestIcon_success {
  color: $color-green;
}

.commitPullRequestIcon_done {
  color: $color-purple;
}

.commitPullRequestIcon_danger {
  color: $color-red;
}

.commitPullRequestIcon_muted {
  color: $color-fg-dim;
}
</style>
