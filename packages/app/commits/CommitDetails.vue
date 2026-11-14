<!-- A commit's details, right of the graph, filling the column the graph's view gives it, or under it below about 1,200 px of window (git-client D13, D16, CH18, CH20, CH55): one scroll, the facts before the message. Its headline; an author line (avatar, name, login, when it was committed, the short sha with a button copying the whole); a card of four titled groups — its pull request (`⇧↵`), its checks (how many fail of how many, the failing ones by name, the passed folded into one row; the CI's rollup until they are read, and a link to them on GitHub when the read fails, D24), its parents (`P`, `⇧P`) and the branches and tags pointing at it; then its message (`CommitMessage`). A group not known yet holds an empty bar (CH58), one known to be empty says so in place (CH57). It draws at once from what the graph knows, the message arriving after; a commit not loaded (D12, CH16) says why the graph stayed and is quiet until it is read, one gone from the graph says so and stays readable (CH41), and a read that fails says so while the rest stays usable (CH40). Its keys are the graph's (`CommitGraphView`), each shown on the row it presses. -->
<script lang="ts">
/** The keys of the open details, in the app's notation; `J`/`K` are the graph's own, and `Esc` closes. */
export const COMMIT_DETAILS_KEYS = {
  firstParent: 'P',
  secondParent: 'Shift+P',
  pullRequest: 'Shift+Enter',
  openOnGitHub: 'O',
} as const;
</script>

<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowUpRight, Copy, GitCommitHorizontal, GitPullRequest, Github, Info, X } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import CheckList from '@/item/CheckList.vue';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { formatLocalDate } from '@/utils/formatLocalDate.js';
import { formatTime } from '@/utils/formatTime.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';

import * as l from './CommitDetails.loc.js';
import { CommitGraphStore } from './CommitGraphStore.js';
import CommitMessage from './CommitMessage.vue';
import CommitPullRequestIcon from './CommitPullRequestIcon.vue';
import CommitRefChip from './CommitRefChip.vue';
import type { CommitRowRef } from './CommitRow.vue';
import CommitStateMarks from './CommitStateMarks.vue';
import type { CommitParent, CommitPullRequest, CommitRef } from './CommitTypes.js';
import { getCiTone } from './getCiTone.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  oid: string;
  /** The branches and tags pointing at it: the default branch first, then branches, then tags. */
  refs: readonly CommitRowRef[];
  /** The ref it was opened from, when that is why the graph stayed (CH16). */
  chosenRef: CommitRef | null;
  /** The commit on GitHub. */
  url: string;
  /** Epoch ms its age is counted to. */
  now: number;
  /** Right of the graph, filling its column, or under it at a fixed share of the height when the window is narrow (D16). */
  docked: 'side' | 'bottom';
}>();

const emit = defineEmits<{
  close: [];
  /** `K` or `J`, by a click. */
  step: [by: 1 | -1];
  /** A parent's row. */
  openParent: [parent: CommitParent];
  /** The pull request's row. */
  openPullRequest: [];
}>();

const store = useService(CommitGraphStore);
const tracking = useService(TrackingStore);
const t = useTranslate();

const commit = computed(() => store.getCommit(props.nameWithOwner, props.oid));
const detail = computed(() => store.getDetail(props.nameWithOwner, props.oid));
const place = computed(() => store.getCommitPlace(props.nameWithOwner, props.oid));
const state = computed(() => store.getState(props.nameWithOwner, props.oid));
const checks = computed(() => store.getChecks(props.nameWithOwner, props.oid));
/** Only a tracked repository has runs' pages (actions D4): any other's run opens on GitHub. */
const runsInApp = computed(() => tracking.isTracked({ kind: 'repository', nameWithOwner: props.nameWithOwner }));
/** Whole once read: the commit's own headline is cut when it is long. */
const headline = computed(() => (detail.value?.kind === 'read' ? detail.value.headline : commit.value?.headline));
const body = computed(() => (detail.value?.kind === 'read' ? detail.value.body : ''));
const failed = computed(() => detail.value?.kind === 'failed');
const notice = computed(() => {
  switch (place.value) {
    case 'shown':
      return null;
    case 'gone':
      return t(l.gone);
    case 'notLoaded':
      return props.chosenRef
        ? t(l.notLoadedRef, {
            name: props.chosenRef.name,
            age: formatTimeAgo(Date.parse(props.chosenRef.committedDate), props.now),
          })
        : t(l.notLoaded);
    default:
      return assertNever(place.value);
  }
});
const authorName = computed(() => commit.value?.author.name ?? commit.value?.author.login ?? '');
const committed = computed(() => {
  const at = commit.value ? Date.parse(commit.value.committedDate) : null;
  return at === null
    ? ''
    : t(l.committedAt, { age: formatTimeAgo(at, props.now), date: formatLocalDate(at), time: formatTime(at) });
});
const parents = computed(() =>
  (commit.value?.parents ?? []).map((parent, index) => ({
    parent,
    key: getParentKey(index),
    headline: store.getCommit(props.nameWithOwner, parent.oid)?.headline ?? null,
  })),
);
/** The checks as read, when GitHub listed any; until then the rollup stands for them. */
const checkList = computed(() =>
  checks.value?.kind === 'read' && checks.value.checks.length > 0 ? checks.value : null,
);
/** Beside the title: how many fail of how many, or that some still run; nothing when all passed, as the folded row says it. */
const checksSummary = computed(() => {
  const list = checkList.value;
  if (!list) {
    return null;
  }

  const failing = list.checks.filter(check => check.state === 'failing').length;
  if (failing > 0) {
    return { kind: 'failing' as const, failing, of: list.checkCount };
  }

  return list.checks.some(check => check.state === 'pending') ? { kind: 'running' as const } : null;
});
const ci = computed(() => {
  const rollup = state.value?.ci;
  if (!rollup) {
    return null;
  }

  const tone = getCiTone(rollup);
  switch (tone) {
    case 'success':
      return { word: t(l.ciPassing), tone };
    case 'danger':
      return { word: t(l.ciFailing), tone };
    case 'warning':
      return { word: t(l.ciRunning), tone };
    default:
      return assertNever(tone);
  }
});

function copySha() {
  return navigator.clipboard.writeText(props.oid);
}

function getParentKey(index: number) {
  switch (index) {
    case 0:
      return COMMIT_DETAILS_KEYS.firstParent;
    case 1:
      return COMMIT_DETAILS_KEYS.secondParent;
    default:
      return null;
  }
}

function getPullRequestWord(pullRequest: CommitPullRequest) {
  switch (pullRequest.state) {
    case 'OPEN':
      return pullRequest.isDraft ? t(l.pullRequestDraft) : t(l.pullRequestOpen);
    case 'MERGED':
      return t(l.pullRequestMerged);
    case 'CLOSED':
      return t(l.pullRequestClosed);
    default:
      return assertNever(pullRequest.state);
  }
}
</script>

<template>
  <section
    :class="[css.commitDetails, css[`commitDetails_${docked}`]]"
    :aria-label="t(l.title)"
  >
    <header :class="css.commitDetails_toolbar">
      <GitCommitHorizontal
        :class="css.commitDetails_commitIcon"
        aria-hidden="true"
      />
      <span :class="css.commitDetails_repository">{{ nameWithOwner }}</span>
      <span :class="css.commitDetails_sha">{{ oid.slice(0, 7) }}</span>
      <span :class="css.commitDetails_spacer" />
      <IconButton
        :label="t(l.previous)"
        kbd="K"
        keyshortcuts="K"
        @click="emit('step', -1)"
      >
        <Kbd keys="K" />
      </IconButton>
      <IconButton
        :label="t(l.next)"
        kbd="J"
        keyshortcuts="J"
        @click="emit('step', 1)"
      >
        <Kbd keys="J" />
      </IconButton>
      <IconButton
        :icon="Github"
        :label="t(l.openOnGitHub)"
        :kbd="COMMIT_DETAILS_KEYS.openOnGitHub"
        :link="url"
        target="_blank"
        rel="noopener noreferrer"
        :keyshortcuts="COMMIT_DETAILS_KEYS.openOnGitHub"
      />
      <IconButton
        :icon="X"
        :label="t(l.close)"
        kbd="Escape"
        keyshortcuts="Escape"
        @click="emit('close')"
      />
    </header>

    <div :class="css.commitDetails_scroll">
      <p
        v-if="notice"
        :class="css.commitDetails_notice"
      >
        <Info
          :class="css.commitDetails_noticeIcon"
          aria-hidden="true"
        />
        {{ notice }}
      </p>

      <template v-if="commit">
        <h2 :class="css.commitDetails_headline">{{ headline }}</h2>
        <div :class="css.commitDetails_author">
          <Avatar
            :name="commit.author.login ?? authorName"
            :src="commit.author.avatarUrl"
            size="xs"
            decorative
          />
          <span :class="css.commitDetails_authorName">{{ authorName }}</span>
          <span
            v-if="commit.author.login && commit.author.login !== authorName"
            :class="css.commitDetails_dim"
            >{{ commit.author.login }}</span
          >
          <span :class="css.commitDetails_dim">{{ committed }}</span>
          <span :class="css.commitDetails_spacer" />
          <span
            :class="css.commitDetails_sha"
            :title="oid"
            >{{ oid.slice(0, 7) }}</span
          >
          <IconButton
            :class="css.commitDetails_copy"
            :icon="Copy"
            :label="t(l.copySha)"
            @click="copySha"
          />
        </div>
      </template>
      <p
        v-else-if="failed"
        :class="css.commitDetails_quiet"
      >
        {{ t(l.readFailed) }}
      </p>
      <p
        v-else
        :class="css.commitDetails_quiet"
      >
        {{ t(l.reading) }}
      </p>

      <div :class="css.commitDetails_card">
        <section :class="css.commitDetails_group">
          <div :class="css.commitDetails_groupHead">
            <h3 :class="css.commitDetails_title">{{ t(l.pullRequest) }}</h3>
            <Kbd
              v-if="state?.pullRequest"
              :keys="COMMIT_DETAILS_KEYS.pullRequest"
            />
          </div>
          <span
            v-if="state === undefined"
            :class="[css.commitDetails_unknownBar, css.commitDetails_unknownBar_pullRequest]"
            role="img"
            :aria-label="t(l.pullRequestNotKnown)"
          />
          <button
            v-else-if="state.pullRequest"
            type="button"
            :class="css.commitDetails_row"
            :aria-keyshortcuts="COMMIT_DETAILS_KEYS.pullRequest"
            @click="emit('openPullRequest')"
          >
            <CommitPullRequestIcon :pull-request="state.pullRequest" />
            <span :class="css.commitDetails_number">#{{ state.pullRequest.number }}</span>
            <span :class="css.commitDetails_rowText">{{ state.pullRequest.title }}</span>
            <span :class="css.commitDetails_dim">{{ getPullRequestWord(state.pullRequest) }}</span>
          </button>
          <p
            v-else
            :class="[css.commitDetails_quiet, css.commitDetails_none]"
          >
            <GitPullRequest
              :class="css.commitDetails_commitIcon"
              aria-hidden="true"
            />
            {{ t(l.noPullRequest) }}
          </p>
        </section>

        <section :class="css.commitDetails_group">
          <div :class="css.commitDetails_groupHead">
            <h3 :class="css.commitDetails_title">{{ t(l.checks) }}</h3>
            <span
              v-if="checksSummary?.kind === 'failing'"
              :class="css.commitDetails_summary"
            >
              <span :class="css.commitDetails_ci_danger">{{
                t(l.failingCount, { count: checksSummary.failing })
              }}</span>
              <span :class="css.commitDetails_dim">{{ t(l.ofCount, { count: checksSummary.of }) }}</span>
            </span>
            <span
              v-else-if="checksSummary?.kind === 'running'"
              :class="[css.commitDetails_summary, css.commitDetails_ci_warning]"
              >{{ t(l.ciRunning) }}</span
            >
          </div>
          <!-- Keyed: the next commit's list starts folded, read before or not. -->
          <CheckList
            v-if="checkList"
            :key="oid"
            :checks="checkList.checks"
            :check-count="checkList.checkCount"
            :more-url="`${url}/checks`"
            :now="now"
            :runs-in-app="runsInApp"
          />
          <span
            v-else-if="state === undefined"
            :class="[css.commitDetails_unknownBar, css.commitDetails_unknownBar_checks]"
            role="img"
            :aria-label="t(l.checksNotKnown)"
          />
          <p
            v-else-if="ci"
            :class="css.commitDetails_ci"
          >
            <CommitStateMarks
              :state="state"
              :with-pull-request="false"
            />
            <span :class="css[`commitDetails_ci_${ci.tone}`]">{{ ci.word }}</span>
          </p>
          <p
            v-else
            :class="css.commitDetails_quiet"
          >
            {{ t(l.noChecks) }}
          </p>
          <Button
            v-if="checks?.kind === 'failed' && (state === undefined || ci)"
            :class="css.commitDetails_ciLink"
            variant="link"
            size="sm"
            :icon="ArrowUpRight"
            :link="`${url}/checks`"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t(l.checksOnGitHub) }}
          </Button>
        </section>

        <section
          v-if="parents.length > 0"
          :class="css.commitDetails_group"
        >
          <h3 :class="css.commitDetails_title">{{ t(parents.length === 1 ? l.parent : l.parents) }}</h3>
          <div :class="css.commitDetails_rows">
            <button
              v-for="{ parent, key, headline: parentHeadline } in parents"
              :key="parent.oid"
              type="button"
              :class="css.commitDetails_row"
              :aria-keyshortcuts="key ?? undefined"
              @click="emit('openParent', parent)"
            >
              <Kbd
                v-if="key"
                :keys="key"
              />
              <span :class="css.commitDetails_number">{{ parent.oid.slice(0, 7) }}</span>
              <span
                v-if="parentHeadline"
                :class="css.commitDetails_rowText"
                >{{ parentHeadline }}</span
              >
            </button>
          </div>
        </section>

        <section :class="[css.commitDetails_group, css.commitDetails_group_inline]">
          <h3 :class="css.commitDetails_title">{{ t(l.refs) }}</h3>
          <div
            v-if="refs.length > 0"
            :class="css.commitDetails_refs"
          >
            <CommitRefChip
              v-for="commitRef in refs"
              :key="`${commitRef.kind}:${commitRef.name}`"
              :kind="commitRef.kind"
              :label="commitRef.name"
            />
          </div>
          <p
            v-else
            :class="css.commitDetails_quiet"
          >
            {{ t(place === 'gone' ? l.noRefsAnyMore : l.noRefs) }}
          </p>
        </section>
      </div>

      <template v-if="commit">
        <CommitMessage
          v-if="body"
          :class="css.commitDetails_message"
          :body="body"
        />
        <p
          v-else-if="failed"
          :class="[css.commitDetails_quiet, css.commitDetails_message]"
        >
          {{ t(l.bodyFailed) }}
        </p>
      </template>
    </div>
  </section>
</template>

<style lang="scss" module="css">
// D16: right of the graph, in its column, or under it.
.commitDetails {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.commitDetails_side {
  flex: 1;
}

// Under the graph: the full width, a fixed 45% of the height.
.commitDetails_bottom {
  flex: none;
  height: 45%;
  border-top: 1px solid $color-border;
}

.commitDetails_toolbar {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  padding: $spacing-8 $spacing-12 $spacing-8 $spacing-20;
  border-bottom: 1px solid $color-border;
}

.commitDetails_commitIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-dim;
}

.commitDetails_repository {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commitDetails_sha {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commitDetails_spacer {
  flex: 1;
}

// CH55: one scroll, the facts first and the message after them.
.commitDetails_scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: $spacing-20;
  overflow-y: auto;
}

.commitDetails_notice {
  display: flex;
  gap: $spacing-8;
  padding: $spacing-12;
  margin: 0 0 $spacing-16;
  font-size: $font-size-sm;
  color: $color-fg-2;
  background: $color-bg-2;
  border-radius: $radius-md;
}

.commitDetails_noticeIcon {
  flex: none;
  width: 13px;
  height: 13px;
  margin-top: $spacing-2;
}

.commitDetails_headline {
  margin: 0;
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
  overflow-wrap: anywhere;
}

.commitDetails_author {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4 $spacing-6;
  align-items: center;
  min-width: 0;
  margin-top: $spacing-8;
  font-size: $font-size-sm;
}

.commitDetails_authorName {
  color: $color-fg-2;
}

.commitDetails_copy {
  --icon-button-glyph-size: 13px;
  --icon-button-color: #{$color-fg-dim};
}

.commitDetails_dim {
  flex: none;
  color: $color-fg-dim;
}

.commitDetails_quiet {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.commitDetails_card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-top: $spacing-12;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.commitDetails_group {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
  padding: $spacing-10 $spacing-12;

  & + & {
    border-top: 1px solid $color-border;
  }
}

// Refs: the title and the chips on one line.
.commitDetails_group_inline {
  flex-direction: row;
  gap: $spacing-8;
  align-items: center;
}

.commitDetails_groupHead {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.commitDetails_title {
  flex: none;
  margin: 0;
  font-size: $font-size-xs;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.commitDetails_summary {
  display: inline-flex;
  gap: $spacing-4;
  font-size: $font-size-xs;
}

// Not known yet (CH58): an empty bar where the answer goes, so it never reads as "has none".
.commitDetails_unknownBar {
  display: block;
  height: 6px;
  background: $color-skeleton-weak;
  border-radius: $radius-skeleton;
}

.commitDetails_unknownBar_pullRequest {
  width: 128px;
}

.commitDetails_unknownBar_checks {
  width: 76px;
}

.commitDetails_rows {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
}

.commitDetails_row {
  @include focus-ring;

  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  padding: $spacing-2 $spacing-4;
  margin: 0 (-$spacing-4);
  font-size: $font-size-sm;
  color: $color-fg;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-sm;

  &:hover {
    background: $color-bg-2;
  }
}

.commitDetails_number {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.commitDetails_rowText {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commitDetails_none {
  display: flex;
  gap: $spacing-6;
  align-items: center;
}

.commitDetails_refs {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4;
  min-width: 0;
}

.commitDetails_ci {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  margin: 0;
  font-size: $font-size-sm;
}

.commitDetails_ci_success {
  color: $color-green;
}

.commitDetails_ci_danger {
  color: $color-red;
}

.commitDetails_ci_warning {
  color: $color-amber;
}

.commitDetails_ciLink {
  align-self: flex-start;
}

.commitDetails_message {
  margin-top: $spacing-16;
}
</style>
