<!-- A submodule's pointer change in place of a diff: a line with its path, the two commits' short ids and how the new one stands to the old (ahead, rolled back, diverged, added, removed), then the pull requests in the submodule's repository carrying the new commit (open, else merged), which open in githq (`GitHubLinks`), the commits between the two pointers, each linking to GitHub, and the files they change with their sizes, saying when there are more of either, and the comparison on GitHub. Its history is read when it is drawn, never for a collapsed file; meanwhile quiet bars as tall as the row is estimated. A history that can't be read says so, a failure gives GitHub's words and Try again, and GitHub's allowance running out says when it carries on by itself (D35). -->
<script lang="ts">
import type { PatchStatus } from '@githq/github/generated.gen.js';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
/** How long a commit's id shows, as GitHub shortens it. */
const SHORT_OID_LENGTH = 7;

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
import type { CommitPullRequest } from '@githq/github/readCommitPullRequests.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleAlert, FolderGit2, Pause } from 'lucide-vue-next';
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

import CommitPullRequestIcon from '@/commits/CommitPullRequestIcon.vue';
import Button from '@/components/Button.vue';
import Skeleton from '@/components/Skeleton.vue';
import SkeletonBar from '@/components/SkeletonBar.vue';
import PullRequestSize from '@/lists/PullRequestSize.vue';
import { getGitHubLinkTarget, GITHQ_LINK_ATTRIBUTE } from '@/shell/gitHubLinks.js';
import GitHubLinks from '@/shell/GitHubLinks.vue';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';
import { formatTime } from '@/utils/formatTime.js';

import { SUBMODULE_SKELETON_HEIGHT } from '../buildReviewRows.js';
import ReviewChange from '../ReviewChange.vue';
import { getFailureText } from '../utils/getFailureText.js';
import * as l from './ReviewSubmoduleBlock.loc.js';
import { ReviewSubmodules } from './ReviewSubmodules.js';
import type { ReviewSubmoduleChange } from './ReviewSubmodules.js';

const props = defineProps<{
  change: ReviewSubmoduleChange;
}>();

const t = useTranslate();
const router = useRouter();
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
/** GitHub's comparison of the two pointers, the old one first, which for a rollback is the newer. */
const comparisonUrl = computed(() => {
  const { before, after } = props.change;
  if (repository.value === null || before === null || after === null) {
    return null;
  }

  const [base, head] = ready.value?.relation.kind === 'behind' ? [after, before] : [before, after];
  return getGitHubUrl(`${repository.value}/compare/${base}...${head}`);
});

// The same history for the same pointers: asked again only for others, as a new head brings.
watch(
  () => props.change,
  change => submodules.load(change),
  { immediate: true },
);

/** A pull request's link: githq's path, marked with GitHub's address, or GitHub's address in a new tab. */
function getPullRequestLink({ url }: CommitPullRequest) {
  // A pull request is never a workflow, the one address that depends on what is tracked.
  const target = getGitHubLinkTarget(url, { router, isTracked: () => true });
  return target
    ? { href: target.path, [GITHQ_LINK_ATTRIBUTE]: url }
    : { href: url, target: '_blank', rel: 'noopener noreferrer' };
}

function getCommitUrl(oid: string) {
  return repository.value === null ? null : getGitHubUrl(`${repository.value}/commit/${oid}`);
}
</script>

<template>
  <div
    :class="css.reviewSubmoduleBlock"
    :style="busy ? { height: `${SUBMODULE_SKELETON_HEIGHT}px` } : undefined"
    :aria-busy="busy || undefined"
  >
    <p :class="css.reviewSubmoduleBlock_line">
      <FolderGit2
        :class="css.reviewSubmoduleBlock_icon"
        aria-hidden="true"
      />
      <span :class="css.reviewSubmoduleBlock_path">{{ change.path }}</span>
      <span
        v-if="change.before !== null && change.after !== null"
        :class="css.reviewSubmoduleBlock_oids"
        >{{ t(l.pointers, { before: shorten(change.before), after: shorten(change.after) }) }}</span
      >
      <span
        v-else-if="change.after !== null"
        :class="css.reviewSubmoduleBlock_relation"
        >{{ t(l.added, { oid: shorten(change.after) }) }}</span
      >
      <span
        v-else-if="change.before !== null"
        :class="css.reviewSubmoduleBlock_relation"
        >{{ t(l.removed, { oid: shorten(change.before) }) }}</span
      >
      <span
        v-if="relationText !== null"
        :class="css.reviewSubmoduleBlock_relation"
        >{{ relationText }}</span
      >
    </p>
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
    <template v-else-if="ready">
      <GitHubLinks v-if="ready.pullRequests.length > 0">
        <ul
          :class="css.reviewSubmoduleBlock_list"
          :aria-label="t(l.pullRequests)"
        >
          <li
            v-for="pullRequest in ready.pullRequests"
            :key="pullRequest.url"
            :class="css.reviewSubmoduleBlock_entry"
          >
            <CommitPullRequestIcon :pull-request="pullRequest" />
            <a
              :class="css.reviewSubmoduleBlock_link"
              v-bind="getPullRequestLink(pullRequest)"
              >{{ pullRequest.title }}</a
            >
            <span :class="css.reviewSubmoduleBlock_meta">#{{ pullRequest.number }}</span>
          </li>
        </ul>
      </GitHubLinks>
      <ul
        v-if="ready.commits.length > 0"
        :class="css.reviewSubmoduleBlock_list"
        :aria-label="t(l.commits)"
      >
        <li
          v-for="commit in ready.commits"
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
      </ul>
      <p
        v-if="ready.moreCommits > 0"
        :class="css.reviewSubmoduleBlock_more"
      >
        {{ t(l.moreCommits, { count: ready.moreCommits, formatted: numbers.format(ready.moreCommits) }) }}
      </p>
      <ul
        v-if="ready.files.length > 0"
        :class="css.reviewSubmoduleBlock_list"
        :aria-label="t(l.files)"
      >
        <li
          v-for="file in ready.files"
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
      </ul>
      <p
        v-if="ready.moreFiles"
        :class="css.reviewSubmoduleBlock_more"
      >
        {{ t(l.moreFiles) }}
      </p>
    </template>
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
    <div
      v-if="comparisonUrl !== null"
      :class="css.reviewSubmoduleBlock_actions"
    >
      <Button
        size="sm"
        variant="outline"
        :link="comparisonUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t(l.openComparison) }}
      </Button>
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
}

.reviewSubmoduleBlock_line {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4 $spacing-10;
  align-items: center;
  margin: 0;
}

.reviewSubmoduleBlock_icon {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-fg-2;
}

.reviewSubmoduleBlock_path {
  overflow-wrap: anywhere;
}

.reviewSubmoduleBlock_oids,
.reviewSubmoduleBlock_oid {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.reviewSubmoduleBlock_relation {
  color: $color-fg-2;
}

.reviewSubmoduleBlock_hidden {
  @include visually-hidden;
}

.reviewSubmoduleBlock_skeleton {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding-left: $spacing-24 + $spacing-2;
}

.reviewSubmoduleBlock_list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: 0 0 0 ($spacing-24 + $spacing-2);
  margin: 0;
  list-style: none;
}

.reviewSubmoduleBlock_entry {
  display: flex;
  gap: $spacing-8;
  align-items: baseline;
  min-width: 0;
  line-height: 20px;
}

.reviewSubmoduleBlock_link {
  @include focus-ring;

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
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.reviewSubmoduleBlock_file {
  flex: 0 1 auto;
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

.reviewSubmoduleBlock_more {
  padding-left: $spacing-24 + $spacing-2;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-fg-2;
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

.reviewSubmoduleBlock_actions {
  display: flex;
}
</style>
