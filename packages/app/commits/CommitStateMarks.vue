<!-- A commit's pull request (state and number) and CI mark, in its row in the graph and on a branch in the list beside it (git-client D18, CH3, CH12). While they are not known yet an empty bar stands in for them, never a blank; a commit with neither shows nothing. -->
<script lang="ts" setup>
import type { StatusState } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  CircleCheck,
  CircleX,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  LoaderCircle,
} from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';

import { classifyStatus } from '@/store/classifyChecks.js';

import * as l from './CommitStateMarks.loc.js';
import type { CommitPullRequest, CommitState } from './CommitTypes.js';

const props = withDefaults(
  defineProps<{
    /** `undefined` while not known yet. */
    state: CommitState | undefined;
    /** `false`: the CI alone, as the default branch's row in the list (CH3). */
    withPullRequest?: boolean;
  }>(),
  { withPullRequest: true },
);

interface MarkLook {
  readonly icon: LucideIcon;
  readonly tone: 'danger' | 'done' | 'muted' | 'success' | 'warning';
  readonly label: string;
}

const t = useTranslate();

const ci = computed(() => (props.state?.ci ? getCiLook(props.state.ci) : null));
const pullRequest = computed(() => {
  const value = props.withPullRequest ? props.state?.pullRequest : null;
  return value ? { number: value.number, look: getPullRequestLook(value) } : null;
});

function getPullRequestLook(value: CommitPullRequest): MarkLook {
  switch (value.state) {
    case 'OPEN':
      return value.isDraft
        ? { icon: GitPullRequestDraft, tone: 'muted', label: t(l.pullRequestDraft) }
        : { icon: GitPullRequest, tone: 'success', label: t(l.pullRequestOpen) };
    case 'MERGED':
      return { icon: GitMerge, tone: 'done', label: t(l.pullRequestMerged) };
    case 'CLOSED':
      return { icon: GitPullRequestClosed, tone: 'danger', label: t(l.pullRequestClosed) };
    default:
      return assertNever(value.state);
  }
}

function getCiLook(state: StatusState): MarkLook {
  const classified = classifyStatus(state);
  switch (classified) {
    // A commit status is never skipped; a skipped check holds nothing back, as passing.
    case 'passing':
    case 'skipped':
      return { icon: CircleCheck, tone: 'success', label: t(l.checksPassing) };
    case 'failing':
      return { icon: CircleX, tone: 'danger', label: t(l.checksFailing) };
    case 'pending':
      return { icon: LoaderCircle, tone: 'warning', label: t(l.checksRunning) };
    default:
      return assertNever(classified);
  }
}
</script>

<template>
  <span
    v-if="state === undefined"
    :class="css.commitStateMarks"
    role="img"
    :aria-label="t(l.notKnownYet)"
  >
    <span :class="css.commitStateMarks_unknownBar" />
    <span :class="[css.commitStateMarks_unknownBar, css.commitStateMarks_unknownBar_short]" />
  </span>
  <span
    v-else-if="pullRequest || ci"
    :class="css.commitStateMarks"
  >
    <span
      v-if="pullRequest"
      :class="css.commitStateMarks_pullRequest"
    >
      <component
        :is="pullRequest.look.icon"
        :class="[css.commitStateMarks_mark, css[`commitStateMarks_mark_${pullRequest.look.tone}`]]"
        role="img"
        :aria-label="pullRequest.look.label"
      />
      #{{ pullRequest.number }}
    </span>
    <component
      :is="ci.icon"
      v-if="ci"
      :class="[css.commitStateMarks_mark, css.commitStateMarks_ci, css[`commitStateMarks_mark_${ci.tone}`]]"
      role="img"
      :aria-label="ci.label"
    />
  </span>
</template>

<style lang="scss" module="css">
.commitStateMarks {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
}

.commitStateMarks_pullRequest {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  white-space: nowrap;
}

.commitStateMarks_mark {
  flex: none;
  width: 13px;
  height: 13px;
}

.commitStateMarks_mark_success {
  color: $color-green;
}

// A passing check is the common case: quieter than the marks that need the eye.
.commitStateMarks_ci.commitStateMarks_mark_success {
  opacity: 0.7;
}

.commitStateMarks_mark_done {
  color: $color-purple;
}

.commitStateMarks_mark_danger {
  color: $color-red;
}

.commitStateMarks_mark_warning {
  color: $color-amber;
}

.commitStateMarks_mark_muted {
  color: $color-fg-dim;
}

// Not known yet (CH34): an empty bar where the pull request and CI go, so it never reads as "has none".
.commitStateMarks_unknownBar {
  width: 30px;
  height: 6px;
  background: $color-bg-3;
  border-radius: 3px;
}

.commitStateMarks_unknownBar_short {
  width: 12px;
}
</style>
