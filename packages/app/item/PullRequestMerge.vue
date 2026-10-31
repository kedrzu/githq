<!-- Where an opened pull request stands (F1–F4): the verdict in one line — "Can't merge yet", "Ready to merge" — then which condition holds it back (checks, reviews, conflicts), its branches and size, and the way to GitHub, where merging happens (D10). Read from the row's status summary (`getPullRequestStanding`, the same as "my work"), so it shows before the detail arrives. Approvals are counted without "of N" (D14). -->
<script lang="ts" setup>
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  ArrowRight,
  CircleCheck,
  CircleDashed,
  CircleX,
  FileDiff,
  GitBranch,
  GitMerge,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Github,
  Hourglass,
} from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestDetail } from '@/store/ItemDetailTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import * as l from './PullRequestMerge.loc.js';

const props = defineProps<{
  pr: PullRequestItem;
  /** Read with the opened item; the branch's owner comes from it. */
  detail?: PullRequestDetail | null;
}>();

type Tone = 'danger' | 'done' | 'muted' | 'success' | 'warning';

interface Line {
  tone: Tone;
  icon: LucideIcon;
  text: string;
  /** Quieter text at the end ("1 approval · pnowak"). */
  aside?: string | null;
}

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const names = new Intl.ListFormat(APP_LANGUAGE);

const standing = computed(() => getPullRequestStanding(props.pr));
// Ready: approved as "my work" says, or with no review required, and GitHub would merge it now.
const mergeable = computed(() => {
  const { pr } = props;
  const clean = pr.mergeStateStatus === 'CLEAN' || pr.mergeStateStatus === 'HAS_HOOKS';
  return (
    standing.value.readyToMerge || (clean && !pr.isDraft && pr.reviewDecision === null && !standing.value.needsAuthor)
  );
});
const open = computed(() => props.pr.state === 'OPEN');

const verdict = computed((): Line => {
  const { pr } = props;
  const now = standing.value;
  if (pr.merged) {
    return { tone: 'done', icon: GitMerge, text: t(l.merged) };
  }

  if (pr.state !== 'OPEN') {
    return { tone: 'danger', icon: GitPullRequestClosed, text: t(l.closedUnmerged) };
  }

  if (pr.isDraft) {
    return { tone: 'muted', icon: GitPullRequestDraft, text: t(l.draft), aside: t(l.draftDetail) };
  }

  if (now.needsAuthor) {
    const parts: string[] = [];
    if (now.checksFailing) {
      parts.push(
        now.failingChecks > 0 ? t(l.checksFailing, { count: now.failingChecks }) : t(l.checksFailingUncounted),
      );
    }

    if (now.changesRequested) {
      parts.push(t(l.changesRequested));
    }

    if (now.conflicts) {
      parts.push(t(l.conflicts));
    }

    return { tone: 'danger', icon: CircleX, text: t(l.cannotMerge), aside: parts.join(' · ') };
  }

  if (mergeable.value) {
    return {
      tone: 'success',
      icon: CircleCheck,
      text: t(l.ready),
      aside: now.readyToMerge ? t(l.readyDetail) : t(l.readyNoReview),
    };
  }

  const parts: string[] = [];
  if (now.checksRunning) {
    parts.push(t(l.checksRunning));
  }

  if (now.waitingForReview) {
    parts.push(t(l.waitingForReview));
  }

  if (parts.length === 0) {
    if (pr.mergeStateStatus === 'BEHIND') {
      parts.push(t(l.behind, { base: pr.baseRefName }));
    } else if (pr.mergeStateStatus === 'BLOCKED') {
      parts.push(t(l.blocked));
    }
  }

  return { tone: 'warning', icon: Hourglass, text: t(l.notReady), aside: parts.join(' · ') };
});

const conditions = computed((): { label: string; line: Line }[] => [
  { label: t(l.checks), line: checksLine() },
  { label: t(l.reviews), line: reviewsLine() },
  { label: t(l.conflictsLabel), line: conflictsLine() },
]);

const head = computed(() => {
  const { pr, detail } = props;
  const owner = detail?.headRepository ? parseRepositoryName(detail.headRepository).owner : null;
  return owner && owner !== pr.repository.owner ? `${owner}:${pr.headRefName}` : pr.headRefName;
});

const filesUrl = computed(() => `${props.pr.url}/files`);

function checksLine(): Line {
  const { checks } = props.pr;
  if (!checks || checks.passing + checks.failing + checks.pending === 0) {
    return { tone: 'muted', icon: CircleDashed, text: t(l.noChecks) };
  }

  if (checks.failing === 0 && checks.pending === 0) {
    return { tone: 'success', icon: CircleCheck, text: t(l.allPassed, { count: checks.passing }) };
  }

  const parts: string[] = [];
  if (checks.failing > 0) {
    parts.push(t(l.failingCount, { count: numbers.format(checks.failing) }));
  }

  if (checks.pending > 0) {
    parts.push(t(l.runningCount, { count: numbers.format(checks.pending) }));
  }

  if (checks.passing > 0) {
    parts.push(t(l.passedCount, { count: numbers.format(checks.passing) }));
  }

  return {
    tone: checks.failing > 0 ? 'danger' : 'warning',
    icon: checks.failing > 0 ? CircleX : Hourglass,
    text: parts.join(', '),
  };
}

function reviewsLine(): Line {
  const { pr } = props;
  const approvers = authorsOf('APPROVED');
  const approvals = approvers.length > 0 ? t(l.approvals, { count: approvers.length }) : null;
  if (standing.value.changesRequested) {
    return {
      tone: 'danger',
      icon: FileDiff,
      text: t(l.changesRequestedBy, { names: names.format(authorsOf('CHANGES_REQUESTED')) }),
      aside: approvals && `${approvals} · ${names.format(approvers)}`,
    };
  }

  if (standing.value.approved) {
    return {
      tone: 'success',
      icon: CircleCheck,
      text: t(l.approvedBy, { names: names.format(approvers) }),
      aside: approvals,
    };
  }

  const requested = pr.reviewRequests.map(request => (request.kind === 'user' ? request.login : request.name));
  if (requested.length > 0) {
    return {
      tone: 'warning',
      icon: Hourglass,
      text: t(l.waitingFor, { names: names.format(requested) }),
      aside: approvals,
    };
  }

  if (pr.reviewDecision === 'REVIEW_REQUIRED') {
    return { tone: 'warning', icon: Hourglass, text: t(l.reviewRequired), aside: approvals };
  }

  return { tone: 'muted', icon: CircleDashed, text: t(l.noReviewRequired), aside: approvals };
}

function conflictsLine(): Line {
  const { pr } = props;
  if (standing.value.conflicts) {
    return { tone: 'danger', icon: CircleX, text: t(l.conflictsWith, { base: pr.baseRefName }) };
  }

  if (pr.mergeable === 'UNKNOWN') {
    return { tone: 'muted', icon: CircleDashed, text: t(l.mergeabilityUnknown) };
  }

  return { tone: 'success', icon: CircleCheck, text: t(l.noConflicts, { base: pr.baseRefName }) };
}

function authorsOf(state: 'APPROVED' | 'CHANGES_REQUESTED') {
  return mapNotNull(props.pr.latestReviews, review => (review.state === state ? review.author : null));
}
</script>

<template>
  <section :class="[css.pullRequestMerge, css[`pullRequestMerge_${verdict.tone}`]]">
    <h2 :class="css.pullRequestMerge_verdict">
      <component
        :is="verdict.icon"
        :class="css.pullRequestMerge_verdictIcon"
        aria-hidden="true"
      />
      <span :class="css.pullRequestMerge_verdictTitle">{{ verdict.text }}</span>
      <span
        v-if="verdict.aside"
        :class="css.pullRequestMerge_verdictDetail"
        >{{ verdict.aside }}</span
      >
    </h2>
    <dl
      v-if="open && !pr.isDraft"
      :class="css.pullRequestMerge_conditions"
    >
      <div
        v-for="condition in conditions"
        :key="condition.label"
        :class="[css.pullRequestMerge_condition, css[`pullRequestMerge_condition_${condition.line.tone}`]]"
      >
        <dt :class="css.pullRequestMerge_conditionLabel">
          <component
            :is="condition.line.icon"
            :class="css.pullRequestMerge_conditionIcon"
            aria-hidden="true"
          />
          {{ condition.label }}
        </dt>
        <dd :class="css.pullRequestMerge_conditionValue">
          <span :class="css.pullRequestMerge_conditionText">{{ condition.line.text }}</span>
          <span
            v-if="condition.line.aside"
            :class="css.pullRequestMerge_conditionAside"
            >{{ condition.line.aside }}</span
          >
        </dd>
      </div>
    </dl>
    <p :class="css.pullRequestMerge_branches">
      <GitBranch
        :class="css.pullRequestMerge_branchIcon"
        aria-hidden="true"
      />
      <span :class="css.pullRequestMerge_hidden">{{ t(l.branchInto, { head, base: pr.baseRefName }) }}</span>
      <span
        :class="css.pullRequestMerge_branch"
        aria-hidden="true"
        >{{ head }}</span
      >
      <ArrowRight
        :class="css.pullRequestMerge_branchIcon"
        aria-hidden="true"
      />
      <span
        :class="css.pullRequestMerge_branch"
        aria-hidden="true"
        >{{ pr.baseRefName }}</span
      >
      <span :class="css.pullRequestMerge_spacer" />
      <span :class="css.pullRequestMerge_added">+{{ numbers.format(pr.additions) }}</span>
      <span :class="css.pullRequestMerge_removed">−{{ numbers.format(pr.deletions) }}</span>
      <span :class="css.pullRequestMerge_files">{{ t(l.files, { count: pr.changedFiles }) }}</span>
    </p>
    <div :class="css.pullRequestMerge_actions">
      <Button
        :variant="mergeable && open ? 'primary' : 'secondary'"
        size="sm"
        :icon="Github"
        :link="pr.url"
        kbd="O"
        target="_blank"
        rel="noopener noreferrer"
        aria-keyshortcuts="O"
      >
        {{ t(l.openOnGitHub) }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :icon="FileDiff"
        :link="filesUrl"
        kbd="⇧O"
        target="_blank"
        rel="noopener noreferrer"
        aria-keyshortcuts="Shift+O"
      >
        {{ t(l.reviewFiles) }}
      </Button>
      <span :class="css.pullRequestMerge_spacer" />
      <span :class="css.pullRequestMerge_note">{{ t(l.noMerge) }}</span>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.pullRequestMerge {
  overflow: hidden;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.pullRequestMerge_verdict {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-10 $spacing-12;
  font-size: $font-size-sm;
  font-weight: $font-weight-normal;

  .pullRequestMerge_danger & {
    background: rgba($color-red, 0.08);
  }

  .pullRequestMerge_success & {
    background: rgba($color-green, 0.08);
  }

  .pullRequestMerge_warning & {
    background: rgba($color-amber, 0.08);
  }

  .pullRequestMerge_done & {
    background: rgba($color-purple, 0.08);
  }
}

.pullRequestMerge_verdictIcon {
  flex: none;
  width: 15px;
  height: 15px;

  .pullRequestMerge_danger & {
    color: $color-red;
  }

  .pullRequestMerge_success & {
    color: $color-green;
  }

  .pullRequestMerge_warning & {
    color: $color-amber;
  }

  .pullRequestMerge_done & {
    color: $color-purple;
  }

  .pullRequestMerge_muted & {
    color: $color-fg-3;
  }
}

.pullRequestMerge_verdictTitle {
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.pullRequestMerge_verdictDetail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-2;
  white-space: nowrap;
}

.pullRequestMerge_conditions {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: $spacing-10 $spacing-12;
  margin: 0;
}

.pullRequestMerge_condition {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-sm;
  line-height: 15px;
}

.pullRequestMerge_conditionLabel {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  width: 92px;
  color: $color-fg-dim;
}

.pullRequestMerge_conditionIcon {
  width: 13px;
  height: 13px;

  .pullRequestMerge_condition_danger & {
    color: $color-red;
  }

  .pullRequestMerge_condition_success & {
    color: $color-green;
  }

  .pullRequestMerge_condition_warning & {
    color: $color-amber;
  }

  .pullRequestMerge_condition_muted & {
    color: $color-fg-3;
  }
}

.pullRequestMerge_conditionValue {
  display: flex;
  flex: 1;
  gap: $spacing-8;
  min-width: 0;
  margin: 0;
}

.pullRequestMerge_conditionText {
  flex: 1;
  min-width: 0;
  color: $color-fg;
}

.pullRequestMerge_conditionAside {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.pullRequestMerge_branches {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 9px $spacing-12;
  margin: 0;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  white-space: nowrap;
  border-top: 1px solid $color-border;
}

.pullRequestMerge_branchIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.pullRequestMerge_branch {
  overflow: hidden;
  text-overflow: ellipsis;
}

.pullRequestMerge_hidden {
  @include visually-hidden;
}

.pullRequestMerge_spacer {
  flex: 1;
}

.pullRequestMerge_added {
  color: $color-green;
}

.pullRequestMerge_removed {
  color: $color-red;
}

.pullRequestMerge_files {
  font-family: $font-family-sans;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.pullRequestMerge_actions {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-10 $spacing-12;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.pullRequestMerge_note {
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
