<!-- The state of a commit's pull request as an icon named for screen readers: open, draft, merged or closed (git-client D18), in a row's marks and in the commit's details. -->
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
}>();

interface PullRequestLook {
  readonly icon: LucideIcon;
  readonly tone: 'danger' | 'done' | 'muted' | 'success';
  readonly label: string;
}

const t = useTranslate();

const look = computed((): PullRequestLook => {
  const { state, isDraft } = props.pullRequest;
  switch (state) {
    case 'OPEN':
      return isDraft
        ? { icon: GitPullRequestDraft, tone: 'muted', label: t(l.draft) }
        : { icon: GitPullRequest, tone: 'success', label: t(l.open) };
    case 'MERGED':
      return { icon: GitMerge, tone: 'done', label: t(l.merged) };
    case 'CLOSED':
      return { icon: GitPullRequestClosed, tone: 'danger', label: t(l.closed) };
    default:
      return assertNever(state);
  }
});
</script>

<template>
  <component
    :is="look.icon"
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
