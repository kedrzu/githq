<!-- A submodule's pointer change in place of a diff (the file's header above names the submodule). First the pull requests in the submodule's repository carrying the new commit (open, else merged), each a raised card opening in githq (`ReviewSubmodulePullRequest`, `GitHubLinks`), or a quiet card saying none does. Under them one quiet line: the two commits' short ids, how the new one stands to the old (ahead, rolled back, diverged, added, removed), the total of the files' lines, and the comparison on GitHub at its end, the old pointer first. Then the commits between the pointers, each linking to GitHub, and the files they change with their sizes, in two bordered panels (`ReviewSubmodulePanel`) side by side when the block is 760px wide or more, stacked below; each shows 20 rows until Show more, which the block remembers (`ReviewSubmodules.expand`), and says when GitHub listed fewer than there are. Its history is read when it is drawn, never for a collapsed file; meanwhile quiet bars as tall as the row is estimated. A history that can't be read says so, a failure gives GitHub's words and Try again, and GitHub's allowance running out says when it carries on by itself (D35). -->
<script lang="ts">
import type { PatchStatus } from '@githq/github/generated.gen.js';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
/** How long a commit's id shows, as GitHub shortens it. */
const SHORT_OID_LENGTH = 7;
/** The rows a list shows until Show more. */
const LIST_CAP = 20;

/** A file's status in a REST comparison as a change of the pull request's files is told. */
function getChange(status: string): PatchStatus {
  switch (status) {
    case 'added':
      return 'ADDED';
    case 'removed':
      return 'DELETED';
    case 'renamed':
      return 'RENAMED';
    case 'copied':
      return 'COPIED';
    case 'changed':
      return 'CHANGED';
    default:
      return 'MODIFIED';
  }
}

function shorten(oid: string) {
  return oid.slice(0, SHORT_OID_LENGTH);
}
</script>

<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleAlert, FileDiff, FolderGit2, GitCommitHorizontal, GitPullRequest, Pause } from 'lucide-vue-next';
import { computed, watch } from 'vue';

import Button from '@/components/Button.vue';
import Skeleton from '@/components/Skeleton.vue';
import SkeletonBar from '@/components/SkeletonBar.vue';
import PullRequestSize from '@/lists/PullRequestSize.vue';
import GitHubLinks from '@/shell/GitHubLinks.vue';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';
import { formatTime } from '@/utils/formatTime.js';

import { SUBMODULE_SKELETON_HEIGHT } from '../buildReviewRows.js';
import ReviewChange from '../ReviewChange.vue';
import { getFailureText } from '../utils/getFailureText.js';
import * as l from './ReviewSubmoduleBlock.loc.js';
import ReviewSubmodulePanel from './ReviewSubmodulePanel.vue';
import ReviewSubmodulePullRequest from './ReviewSubmodulePullRequest.vue';
import { ReviewSubmodules } from './ReviewSubmodules.js';
import type { ReviewSubmoduleChange } from './ReviewSubmodules.js';

const props = defineProps<{
  change: ReviewSubmoduleChange;
}>();

const t = useTranslate();
const submodules = useService(ReviewSubmodules);

const state = computed(() => submodules.peek(props.change));
const busy = computed(() => state.value.kind === 'waiting' || state.value.kind === 'loading');
const ready = computed(() => (state.value.kind === 'ready' ? state.value : null));
/** Where the submodule's repository is, once known. */
const repository = computed(() =>
  state.value.kind === 'ready' || state.value.kind === 'unreadable' ? state.value.repository : null,
);
const relationText = computed(() => {
  const relation = ready.value?.relation;
  switch (relation?.kind) {
    case 'ahead':
      return t(l.ahead, { count: relation.count, formatted: numbers.format(relation.count) });
    case 'behind':
      return t(l.behind, { count: relation.count, formatted: numbers.format(relation.count) });
    case 'diverged':
      return t(l.diverged, { ahead: numbers.format(relation.ahead), behind: numbers.format(relation.behind) });
    // The pointers say it already.
    case 'added':
    case 'removed':
    case undefined:
      return null;
    default:
      return assertNever(relation);
  }
});
/** The lines of all the files read, as the change moves them; `null` with no files. */
const total = computed(() => {
  const files = ready.value?.files ?? [];
  if (files.length === 0) {
    return null;
  }

  let additions = 0;
  let deletions = 0;
  for (const file of files) {
    additions += file.additions;
    deletions += file.deletions;
  }

  return { additions, deletions };
});
/** GitHub's comparison of the two pointers, the old one first, which for a rollback is the newer. */
const comparisonUrl = computed(() => {
  const { before, after } = props.change;
  if (repository.value === null || before === null || after === null) {
    return null;
  }

  const [base, head] = ready.value?.relation.kind === 'behind' ? [after, before] : [before, after];
  return getGitHubUrl(`${repository.value}/compare/${base}...${head}`);
});
const commitsExpanded = computed(() => submodules.isExpanded(props.change, 'commits'));
const filesExpanded = computed(() => submodules.isExpanded(props.change, 'files'));
const commits = computed(() => {
  const all = ready.value?.commits ?? [];
  return commitsExpanded.value ? all : all.slice(0, LIST_CAP);
});
const files = computed(() => {
  const all = ready.value?.files ?? [];
  return filesExpanded.value ? all : all.slice(0, LIST_CAP);
});
const commitsCount = computed(() => {
  const history = ready.value;
  if (history === null) {
    return '';
  }

  const { relation } = history;
  switch (relation.kind) {
    case 'ahead':
      return t(l.commitsAhead, { formatted: numbers.format(relation.count) });
    case 'behind':
      return t(l.commitsBehind, { formatted: numbers.format(relation.count) });
    case 'diverged':
      return t(l.diverged, { ahead: numbers.format(relation.ahead), behind: numbers.format(relation.behind) });
    // Nothing is compared: no commits are listed.
    case 'added':
    case 'removed':
      return numbers.format(history.commits.length + history.moreCommits);
    default:
      return assertNever(relation);
  }
});
const filesCount = computed(() => {
  const history = ready.value;
  if (history === null) {
    return '';
  }

  const formatted = numbers.format(history.files.length);
  return history.moreFiles ? t(l.filesChangedMore, { formatted }) : t(l.filesChanged, { formatted });
});
const showMoreCommits = computed(() => {
  const hidden = (ready.value?.commits.length ?? 0) - commits.value.length;
  return hidden > 0 ? t(l.showMoreCommits, { count: hidden, formatted: numbers.format(hidden) }) : null;
});
const showMoreFiles = computed(() => {
  const hidden = (ready.value?.files.length ?? 0) - files.value.length;
  return hidden > 0 ? t(l.showMoreFiles, { count: hidden, formatted: numbers.format(hidden) }) : null;
});
const moreCommitsNote = computed(() => {
  const more = ready.value?.moreCommits ?? 0;
  return more > 0 ? t(l.moreCommits, { count: more, formatted: numbers.format(more) }) : null;
});
const moreFilesNote = computed(() => (ready.value?.moreFiles ? t(l.moreFiles) : null));
/** Said on the total when GitHub listed fewer files than there are. */
const totalTitle = computed(() => {
  const history = ready.value;
  return history?.moreFiles
    ? t(l.totalPartial, { count: history.files.length, formatted: numbers.format(history.files.length) })
    : undefined;
});

// The same history for the same pointers: asked again only for others, as a new head brings.
watch(
  () => props.change,
  change => submodules.load(change),
  { immediate: true },
);

function getCommitUrl(oid: string) {
  return repository.value === null ? null : getGitHubUrl(`${repository.value}/commit/${oid}`);
}
</script>

<template>
  <div
    :class="[css.reviewSubmoduleBlock, ready && css.reviewSubmoduleBlock_ready]"
    :style="busy ? { height: `${SUBMODULE_SKELETON_HEIGHT}px` } : undefined"
    :aria-busy="busy || undefined"
  >
    <GitHubLinks v-if="ready && repository !== null && change.after !== null">
      <section
        :class="css.reviewSubmoduleBlock_pullRequests"
        :aria-label="t(l.pullRequests)"
      >
        <ReviewSubmodulePullRequest
          v-for="pullRequest in ready.pullRequests"
          :key="pullRequest.url"
          :pull-request="pullRequest"
          :repository="repository"
        />
        <p
          v-if="ready.pullRequests.length === 0"
          :class="css.reviewSubmoduleBlock_noPullRequest"
        >
          <GitPullRequest
            :class="css.reviewSubmoduleBlock_icon"
            aria-hidden="true"
          />
          {{ t(l.noPullRequest, { oid: shorten(change.after) }) }}
        </p>
      </section>
    </GitHubLinks>
    <div :class="css.reviewSubmoduleBlock_line">
      <p :class="css.reviewSubmoduleBlock_facts">
        <span
          v-if="change.before !== null && change.after !== null"
          :class="[css.reviewSubmoduleBlock_fact, css.reviewSubmoduleBlock_oids]"
          >{{ t(l.pointers, { before: shorten(change.before), after: shorten(change.after) }) }}</span
        >
        <span
          v-else-if="change.after !== null"
          :class="css.reviewSubmoduleBlock_fact"
          >{{ t(l.added, { oid: shorten(change.after) }) }}</span
        >
        <span
          v-else-if="change.before !== null"
          :class="css.reviewSubmoduleBlock_fact"
          >{{ t(l.removed, { oid: shorten(change.before) }) }}</span
        >
        <span
          v-if="relationText !== null"
          :class="css.reviewSubmoduleBlock_fact"
          >{{ relationText }}</span
        >
        <PullRequestSize
          v-if="total !== null"
          :class="[css.reviewSubmoduleBlock_fact, css.reviewSubmoduleBlock_total]"
          :additions="total.additions"
          :deletions="total.deletions"
          :title="totalTitle"
        />
      </p>
      <Button
        v-if="comparisonUrl !== null"
        :class="css.reviewSubmoduleBlock_comparison"
        size="sm"
        variant="outline"
        :link="comparisonUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t(l.openComparison) }}
      </Button>
    </div>
    <template v-if="busy">
      <p :class="css.reviewSubmoduleBlock_hidden">{{ t(l.loading) }}</p>
      <Skeleton :class="css.reviewSubmoduleBlock_skeleton">
        <SkeletonBar
          width="45%"
          tone="weak"
        />
        <SkeletonBar
          width="60%"
          tone="weak"
        />
        <SkeletonBar
          width="35%"
          tone="weak"
        />
      </Skeleton>
    </template>
    <div
      v-else-if="ready"
      :class="css.reviewSubmoduleBlock_panels"
    >
      <ReviewSubmodulePanel
        v-if="ready.commits.length > 0"
        :icon="GitCommitHorizontal"
        :title="t(l.commits)"
        :count="commitsCount"
        :show-more="showMoreCommits"
        :note="moreCommitsNote"
        @expand="submodules.expand(change, 'commits')"
      >
        <li
          v-for="commit in commits"
          :key="commit.oid"
          :class="css.reviewSubmoduleBlock_entry"
        >
          <span :class="css.reviewSubmoduleBlock_oid">{{ shorten(commit.oid) }}</span>
          <a
            :class="css.reviewSubmoduleBlock_link"
            :href="getCommitUrl(commit.oid) ?? undefined"
            target="_blank"
            rel="noopener noreferrer"
            >{{ commit.subject }}</a
          >
          <span
            v-if="commit.author !== null"
            :class="css.reviewSubmoduleBlock_meta"
            >{{ commit.author }}</span
          >
        </li>
      </ReviewSubmodulePanel>
      <ReviewSubmodulePanel
        v-if="ready.files.length > 0"
        :icon="FileDiff"
        :title="t(l.files)"
        :count="filesCount"
        :show-more="showMoreFiles"
        :note="moreFilesNote"
        @expand="submodules.expand(change, 'files')"
      >
        <li
          v-for="file in files"
          :key="file.path"
          :class="css.reviewSubmoduleBlock_entry"
        >
          <ReviewChange :change="getChange(file.status)" />
          <span :class="css.reviewSubmoduleBlock_file">{{ file.path }}</span>
          <PullRequestSize
            :class="css.reviewSubmoduleBlock_size"
            :additions="file.additions"
            :deletions="file.deletions"
          />
        </li>
      </ReviewSubmodulePanel>
    </div>
    <div
      v-else
      :class="css.reviewSubmoduleBlock_notice"
    >
      <template v-if="state.kind === 'failed'">
        <CircleAlert
          :class="[css.reviewSubmoduleBlock_noticeIcon, css.reviewSubmoduleBlock_noticeIcon_failed]"
          aria-hidden="true"
        />
        <div :class="css.reviewSubmoduleBlock_noticeText">
          <p :class="[css.reviewSubmoduleBlock_noticeTitle, css.reviewSubmoduleBlock_noticeTitle_failed]">
            {{ t(l.failed) }}
          </p>
          <p :class="css.reviewSubmoduleBlock_noticeDetail">{{ getFailureText(state.error) }}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          @click="submodules.retry(change)"
        >
          {{ t(l.tryAgain) }}
        </Button>
      </template>
      <template v-else-if="state.kind === 'paused'">
        <Pause
          :class="[css.reviewSubmoduleBlock_noticeIcon, css.reviewSubmoduleBlock_noticeIcon_paused]"
          aria-hidden="true"
        />
        <div :class="css.reviewSubmoduleBlock_noticeText">
          <p :class="[css.reviewSubmoduleBlock_noticeTitle, css.reviewSubmoduleBlock_noticeTitle_paused]">
            {{ t(l.paused) }}
          </p>
          <p :class="css.reviewSubmoduleBlock_noticeDetail">
            {{ t(l.pausedDetail, { time: formatTime(state.until) }) }}
          </p>
        </div>
      </template>
      <template v-else>
        <FolderGit2
          :class="css.reviewSubmoduleBlock_noticeIcon"
          aria-hidden="true"
        />
        <p :class="[css.reviewSubmoduleBlock_noticeText, css.reviewSubmoduleBlock_noticeTitle]">
          {{ t(l.unreadable) }}
        </p>
      </template>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewSubmoduleBlock {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-10 $spacing-12;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg;
  background: $color-bg-2;
  container: review-submodule-block / inline-size;
}

// A read history: the pull request's card is the one raised surface, on the diff's own background.
.reviewSubmoduleBlock_ready {
  gap: $spacing-12;
  padding: $spacing-16;
  background: $color-bg;
}

.reviewSubmoduleBlock_pullRequests {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.reviewSubmoduleBlock_noPullRequest {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-12 $spacing-16;
  margin: 0;
  font-size: $font-size-md;
  color: $color-fg-2;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}

.reviewSubmoduleBlock_icon {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-fg-2;
}

.reviewSubmoduleBlock_line {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8 $spacing-16;
  align-items: center;
  padding: 0 $spacing-2;
}

.reviewSubmoduleBlock_facts {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: $spacing-4 $spacing-8;
  align-items: center;
  min-width: 0;
  margin: 0;
  color: $color-fg-2;
}

// The facts are set apart by a quiet dot, which screen readers don't read.
.reviewSubmoduleBlock_fact + .reviewSubmoduleBlock_fact::before {
  margin-right: $spacing-8;
  font-family: $font-family-sans;
  color: $color-fg-3;
  content: '·' / '';
}

.reviewSubmoduleBlock_oids,
.reviewSubmoduleBlock_oid {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.reviewSubmoduleBlock_total {
  font-size: $font-size-xs;
}

// Its own gap already sets the dot apart.
.reviewSubmoduleBlock_fact + .reviewSubmoduleBlock_total::before {
  margin-right: $spacing-2;
}

.reviewSubmoduleBlock_comparison {
  margin-left: auto;
}

.reviewSubmoduleBlock_hidden {
  @include visually-hidden;
}

.reviewSubmoduleBlock_skeleton {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
}

.reviewSubmoduleBlock_panels {
  display: grid;
  gap: $spacing-16;
  align-items: start;
}

@container review-submodule-block (min-width: 760px) {
  .reviewSubmoduleBlock_panels {
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
  }
}

.reviewSubmoduleBlock_entry {
  display: flex;
  gap: $spacing-10;
  align-items: baseline;
  min-width: 0;
  line-height: 24px;
}

.reviewSubmoduleBlock_link {
  @include focus-ring;

  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: $color-fg;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 3px;

  &:hover {
    text-decoration: underline;
  }
}

.reviewSubmoduleBlock_meta {
  flex: none;
  max-width: 40%;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewSubmoduleBlock_file {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewSubmoduleBlock_size {
  font-size: $font-size-4xs;
}

.reviewSubmoduleBlock_notice {
  display: flex;
  gap: $spacing-10;
  align-items: center;
}

.reviewSubmoduleBlock_noticeIcon {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-fg-2;
}

.reviewSubmoduleBlock_noticeIcon_failed {
  color: $color-red;
}

.reviewSubmoduleBlock_noticeIcon_paused {
  color: $color-amber;
}

.reviewSubmoduleBlock_noticeText {
  flex: 1;
  min-width: 0;
  margin: 0;
}

.reviewSubmoduleBlock_noticeTitle,
.reviewSubmoduleBlock_noticeDetail {
  margin: 0;
  overflow-wrap: anywhere;
}

.reviewSubmoduleBlock_noticeTitle_failed {
  color: $color-red;
}

.reviewSubmoduleBlock_noticeTitle_paused {
  color: $color-amber;
}

.reviewSubmoduleBlock_noticeDetail {
  font-size: $font-size-xs;
  color: $color-fg-2;
}
</style>
