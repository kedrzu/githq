<!-- A commit's row in the graph (git-client D18, CH12): its slice of the graph, the branches and tags pointing at it (up to three, then "+N"), its headline — dimmed for a merge — and right after it the pull request it came from (state and number) and its CI mark; the author (avatar and name) and the age at the right edge. A failure is the red dot and a red ✕, never red text; running is amber in both. While the pull request and CI are not known yet an empty bar stands in for them, never a blank; a commit with neither shows nothing there. Where the row is narrow the headline is cut first and the author's name gives way to the avatar. -->
<script lang="ts">
/** A row's height: the graph's lines span it, and the list places and sizes rows by it. */
export const COMMIT_ROW_HEIGHT = 32;

/** A branch or tag pointing at the commit, as its chip shows it. */
export interface CommitRowRef {
  readonly name: string;
  /** `default`: the repository's default branch. */
  readonly kind: 'branch' | 'default' | 'tag';
}
</script>

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

import Avatar from '@/components/Avatar.vue';
import { classifyStatus } from '@/store/classifyChecks.js';
import { formatAge } from '@/utils/formatAge.js';

import CommitGraphCell from './CommitGraphCell.vue';
import CommitRefChip from './CommitRefChip.vue';
import * as l from './CommitRow.loc.js';
import type { CommitPullRequest, CommitState, KeptCommit } from './CommitTypes.js';
import type { CommitGraphRow } from './layoutCommitGraph.js';

const props = defineProps<{
  commit: KeptCommit;
  /** Its slice of the graph. */
  graphRow: CommitGraphRow;
  /** How many lanes the graph shows (`CommitGraphCell`). */
  lanes: number;
  /** The branches and tags pointing at it: the default branch first, then branches, then tags. */
  refs: readonly CommitRowRef[];
  /** Its pull request and CI state; `undefined` while not known yet. */
  state: CommitState | undefined;
  /** Epoch ms its age is counted to. */
  now: number;
}>();

interface MarkLook {
  readonly icon: LucideIcon;
  readonly tone: 'danger' | 'done' | 'muted' | 'success' | 'warning';
  readonly label: string;
}

/** How many refs a row names before "+N". */
const SHOWN_REFS = 3;

const t = useTranslate();

const shownRefs = computed(() => props.refs.slice(0, SHOWN_REFS));
const moreRefs = computed(() => props.refs.length - shownRefs.value.length);
const ci = computed(() => (props.state?.ci ? getCiLook(props.state.ci) : null));
const pullRequest = computed(() => {
  const value = props.state?.pullRequest;
  return value ? { number: value.number, look: getCommitPullRequestLook(value) } : null;
});
const dotTone = computed(() => {
  switch (ci.value?.tone) {
    case 'danger':
      return 'failing';
    case 'warning':
      return 'running';
    default:
      return 'plain';
  }
});
const authorName = computed(() => props.commit.author.name ?? props.commit.author.login ?? '');
const age = computed(() => formatAge(Date.parse(props.commit.committedDate), props.now));

function getCommitPullRequestLook(value: CommitPullRequest): MarkLook {
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
  <div :class="css.commitRow">
    <CommitGraphCell
      :row="graphRow"
      :lanes="lanes"
      :height="COMMIT_ROW_HEIGHT"
      :tone="dotTone"
    />
    <div :class="css.commitRow_message">
      <CommitRefChip
        v-for="ref in shownRefs"
        :key="`${ref.kind}:${ref.name}`"
        :kind="ref.kind"
        :label="ref.name"
      />
      <CommitRefChip
        v-if="moreRefs > 0"
        kind="more"
        :label="t(l.moreRefs, { count: moreRefs })"
      />
      <span :class="[css.commitRow_headline, graphRow.isMerge && css.commitRow_headline_merge]">{{
        commit.headline
      }}</span>
      <span
        v-if="state === undefined"
        :class="css.commitRow_unknown"
        role="img"
        :aria-label="t(l.notKnownYet)"
      >
        <span :class="css.commitRow_unknownBar" />
        <span :class="[css.commitRow_unknownBar, css.commitRow_unknownBar_short]" />
      </span>
      <template v-else>
        <span
          v-if="pullRequest"
          :class="css.commitRow_pullRequest"
        >
          <component
            :is="pullRequest.look.icon"
            :class="[css.commitRow_mark, css[`commitRow_mark_${pullRequest.look.tone}`]]"
            role="img"
            :aria-label="pullRequest.look.label"
          />
          #{{ pullRequest.number }}
        </span>
        <component
          :is="ci.icon"
          v-if="ci"
          :class="[css.commitRow_mark, css.commitRow_ci, css[`commitRow_mark_${ci.tone}`]]"
          role="img"
          :aria-label="ci.label"
        />
      </template>
    </div>
    <span :class="css.commitRow_spacer" />
    <span :class="css.commitRow_author">
      <Avatar
        :name="commit.author.login ?? authorName"
        :src="commit.author.avatarUrl"
        size="xs"
        decorative
      />
      <span :class="css.commitRow_authorName">{{ authorName }}</span>
    </span>
    <time
      :class="css.commitRow_age"
      :datetime="commit.committedDate"
      >{{ age }}</time
    >
  </div>
</template>

<style lang="scss" module="css">
.commitRow {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  height: 100%;
  padding-right: $spacing-20;
  container-type: inline-size;
}

.commitRow_message {
  display: flex;
  flex: 0 1 auto;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
}

.commitRow_headline {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-md;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commitRow_headline_merge {
  color: $color-fg-2;
}

.commitRow_pullRequest {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  padding-left: $spacing-4;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  white-space: nowrap;
}

.commitRow_mark {
  flex: none;
  width: 13px;
  height: 13px;
}

.commitRow_mark_success {
  color: $color-green;
}

// A passing check is the common case: quieter than the marks that need the eye.
.commitRow_ci.commitRow_mark_success {
  opacity: 0.7;
}

.commitRow_mark_done {
  color: $color-purple;
}

.commitRow_mark_danger {
  color: $color-red;
}

.commitRow_mark_warning {
  color: $color-amber;
}

.commitRow_mark_muted {
  color: $color-fg-dim;
}

// Not known yet (CH34): an empty bar where the pull request and CI go, so it never reads as "has none".
.commitRow_unknown {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  padding-left: $spacing-4;
}

.commitRow_unknownBar {
  width: 30px;
  height: 6px;
  background: $color-bg-3;
  border-radius: 3px;
}

.commitRow_unknownBar_short {
  width: 12px;
}

.commitRow_spacer {
  flex: 1 0 0;
}

.commitRow_author {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  width: 110px;
}

.commitRow_authorName {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commitRow_age {
  flex: none;
  width: 30px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-align: right;
  white-space: nowrap;
}

// Narrow rows (details open, the column layout): the author's name gives way to the avatar.
@container (max-width: 640px) {
  .commitRow_author {
    width: auto;
  }

  .commitRow_authorName {
    display: none;
  }
}
</style>
