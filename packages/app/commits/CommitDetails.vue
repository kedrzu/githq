<!-- A commit's details, right of the graph (git-client D13, D16, CH18, CH20): its headline and full message as plain text, its author, when it was committed and its sha, its parents, the branches and tags pointing at it, its pull request and its CI, an empty bar under their titles until those are known. It draws at once from what the graph knows, the message arriving after; a commit not loaded (D12, CH16) says why the graph stayed and is quiet until it is read, one gone from the graph says so and stays readable (CH41), and a read that fails says so while the rest stays usable (CH40). Its keys are the graph's (`CommitGraphView`), listed at its foot. -->
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
import { GitCommitHorizontal, Github, Info, X } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import PropertyRow from '@/components/PropertyRow.vue';
import { formatLocalDate } from '@/utils/formatLocalDate.js';
import { formatTime } from '@/utils/formatTime.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';

import * as l from './CommitDetails.loc.js';
import { CommitGraphStore } from './CommitGraphStore.js';
import CommitPullRequestIcon from './CommitPullRequestIcon.vue';
import CommitRefChip from './CommitRefChip.vue';
import type { CommitRowRef } from './CommitRow.vue';
import CommitStateMarks from './CommitStateMarks.vue';
import type { CommitParent, CommitRef } from './CommitTypes.js';
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
const t = useTranslate();

const commit = computed(() => store.getCommit(props.nameWithOwner, props.oid));
const detail = computed(() => store.getDetail(props.nameWithOwner, props.oid));
const place = computed(() => store.getCommitPlace(props.nameWithOwner, props.oid));
const state = computed(() => store.getState(props.nameWithOwner, props.oid));
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
</script>

<template>
  <section
    :class="css.commitDetails"
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
        aria-keyshortcuts="K"
        @click="emit('step', -1)"
      >
        <Kbd keys="K" />
      </IconButton>
      <IconButton
        :label="t(l.next)"
        kbd="J"
        aria-keyshortcuts="J"
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
        :aria-keyshortcuts="COMMIT_DETAILS_KEYS.openOnGitHub"
      />
      <IconButton
        :icon="X"
        :label="t(l.close)"
        kbd="Escape"
        aria-keyshortcuts="Escape"
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
        <p
          v-if="body"
          :class="css.commitDetails_body"
        >
          {{ body }}
        </p>
        <p
          v-else-if="failed"
          :class="css.commitDetails_quiet"
        >
          {{ t(l.bodyFailed) }}
        </p>

        <dl :class="css.commitDetails_meta">
          <PropertyRow :label="t(l.author)">
            <Avatar
              :name="commit.author.login ?? authorName"
              :src="commit.author.avatarUrl"
              size="xs"
              decorative
            />
            {{ authorName }}
            <span
              v-if="commit.author.login && commit.author.login !== authorName"
              :class="css.commitDetails_login"
              >{{ commit.author.login }}</span
            >
          </PropertyRow>
          <PropertyRow :label="t(l.committed)">{{ committed }}</PropertyRow>
          <PropertyRow :label="t(l.commit)">
            <span :class="css.commitDetails_fullSha">{{ oid }}</span>
          </PropertyRow>
        </dl>

        <section
          v-if="parents.length > 0"
          :class="css.commitDetails_section"
        >
          <h3 :class="css.commitDetails_title">{{ t(parents.length === 1 ? l.parent : l.parents) }}</h3>
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
            <GitCommitHorizontal
              :class="css.commitDetails_commitIcon"
              aria-hidden="true"
            />
            <span :class="css.commitDetails_sha">{{ parent.oid.slice(0, 7) }}</span>
            <span
              v-if="parentHeadline"
              :class="css.commitDetails_rowText"
              >{{ parentHeadline }}</span
            >
          </button>
        </section>
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

      <section :class="css.commitDetails_section">
        <h3 :class="css.commitDetails_title">{{ t(l.refsHere) }}</h3>
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

      <section
        v-if="state === undefined || state.pullRequest"
        :class="css.commitDetails_section"
      >
        <h3 :class="css.commitDetails_title">{{ t(l.pullRequest) }}</h3>
        <CommitStateMarks
          v-if="state === undefined"
          :state="state"
        />
        <button
          v-else-if="state.pullRequest"
          type="button"
          :class="[css.commitDetails_row, css.commitDetails_pullRequest]"
          :aria-keyshortcuts="COMMIT_DETAILS_KEYS.pullRequest"
          @click="emit('openPullRequest')"
        >
          <CommitPullRequestIcon :pull-request="state.pullRequest" />
          <span :class="css.commitDetails_rowText">{{ state.pullRequest.title }}</span>
          <span :class="css.commitDetails_sha">#{{ state.pullRequest.number }}</span>
        </button>
      </section>

      <section
        v-if="state === undefined || ci"
        :class="css.commitDetails_section"
      >
        <h3 :class="css.commitDetails_title">{{ t(l.ci) }}</h3>
        <CommitStateMarks
          v-if="state === undefined"
          :state="state"
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
          <span
            v-if="ci.tone === 'danger'"
            :class="css.commitDetails_ciNote"
            >{{ t(l.checksOnGitHub) }}</span
          >
        </p>
      </section>
    </div>

    <footer :class="css.commitDetails_keys">
      <span :class="css.commitDetails_key"><Kbd keys="J" /><Kbd keys="K" />{{ t(l.keyCommit) }}</span>
      <span :class="css.commitDetails_key"><Kbd :keys="COMMIT_DETAILS_KEYS.firstParent" />{{ t(l.keyParent) }}</span>
      <span :class="css.commitDetails_key"
        ><Kbd :keys="COMMIT_DETAILS_KEYS.pullRequest" />{{ t(l.keyPullRequest) }}</span
      >
      <span :class="css.commitDetails_key"><Kbd :keys="COMMIT_DETAILS_KEYS.openOnGitHub" />{{ t(l.keyGitHub) }}</span>
    </footer>
  </section>
</template>

<style lang="scss" module="css">
// D16: right of the graph, giving up width when the graph would have too little.
.commitDetails {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  width: 440px;
  min-width: 0;
  min-height: 0;
  border-left: 1px solid $color-border;
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

.commitDetails_scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-20;
  min-height: 0;
  padding: $spacing-20;
  overflow-y: auto;
}

.commitDetails_notice {
  display: flex;
  gap: $spacing-8;
  padding: $spacing-12;
  margin: 0;
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

// A commit's message is what its author typed, line breaks and all, and only ever text.
.commitDetails_body {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-2;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.commitDetails_quiet {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.commitDetails_meta {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  margin: 0;
}

.commitDetails_login {
  color: $color-fg-dim;
}

.commitDetails_fullSha {
  min-width: 0;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  overflow-wrap: anywhere;
}

.commitDetails_section {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
}

.commitDetails_title {
  margin: 0;
  font-size: $font-size-xs;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.commitDetails_row {
  @include focus-ring;

  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  padding: $spacing-5 $spacing-8;
  font-size: $font-size-sm;
  color: $color-fg;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &:hover {
    background: $color-bg-2;
  }
}

.commitDetails_pullRequest {
  background: $color-bg-2;
  border-color: transparent;
}

.commitDetails_rowText {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commitDetails_refs {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4;
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

.commitDetails_ciNote {
  color: $color-fg-dim;
}

.commitDetails_keys {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: $spacing-4 $spacing-12;
  padding: $spacing-8 $spacing-20;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  border-top: 1px solid $color-border;
}

.commitDetails_key {
  display: inline-flex;
  gap: $spacing-4;
  align-items: center;
}
</style>
