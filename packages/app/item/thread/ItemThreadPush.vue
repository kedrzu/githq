<!-- A push on an item's thread (`Activity / Push`, item-activity F13): a commit badge on the rail, who — their avatar and login, or the name git records when the author has no GitHub account, then without an avatar — "pushed 3 commits" and the time of the newest, then up to three commits, newest first (`Activity / Commit`: the message wrapping under itself, the CI mark and the hash, a link to the commit on GitHub, right after the message, marked ↗ on a phone, mobile D11) and "Show N more commits", which shows the older ones in place and gives the focus to the first of them. Each commit shown is a row stop of the reading cursor (`commit:<hash>`): the cursor on one tints it, a little past its edges, as code review's cursor line (`Activity / Commit · current`), and makes it `aria-current`. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { GitCommitHorizontal } from 'lucide-vue-next';
import { computed, nextTick, ref, useTemplateRef } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import ExternalMark from '@/components/ExternalMark.vue';
import CommitStateMarks from '@/commits/CommitStateMarks.vue';
import { useReadingStops } from '@/reading/ReadingCursor.js';
import type { ThreadCommit } from '@/store/ItemDetailTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import type { ThreadPush } from './buildThread.js';
import * as l from './ItemThreadPush.loc.js';

/** The commits shown before "Show N more commits". */
const SHOWN = 3;

const props = defineProps<{
  push: ThreadPush;
  /** Epoch ms the age is counted to. */
  now: number;
}>();

const t = useTranslate();
const commitsRef = useTemplateRef<HTMLElement>('commits');
const isCurrent = useReadingStops();
const expanded = ref(false);

const who = computed(() => props.push.actor?.login ?? props.push.authorName ?? '');
/** Newest first, as the design lists them: the head, whose checks the thread speaks of, at the top. */
const shown = computed(() => props.push.commits.toReversed().slice(0, expanded.value ? undefined : SHOWN));
const more = computed(() => props.push.commits.length - shown.value.length);
const when = computed(() => formatAge(Date.parse(props.push.updatedAt), props.now));

function getStopKey(commit: ThreadCommit) {
  return `commit:${commit.abbreviatedOid}`;
}

async function showMore() {
  expanded.value = true;
  await nextTick();
  commitsRef.value?.querySelectorAll('a')[SHOWN]?.focus();
}
</script>

<template>
  <div :class="css.itemThreadPush">
    <span
      :class="css.itemThreadPush_badge"
      aria-hidden="true"
    >
      <GitCommitHorizontal :class="css.itemThreadPush_badgeIcon" />
    </span>
    <div :class="css.itemThreadPush_content">
      <p :class="css.itemThreadPush_line">
        <Avatar
          v-if="push.actor"
          :name="push.actor.login"
          :src="push.actor.avatarUrl"
          decorative
        />
        <span :class="css.itemThreadPush_who">{{ who }}</span>
        <span :class="css.itemThreadPush_what">{{ t(l.pushed, { count: push.commits.length }) }}</span>
        <time
          :class="css.itemThreadPush_when"
          :datetime="push.updatedAt"
          >{{ when }}</time
        >
      </p>
      <ul
        ref="commits"
        :class="css.itemThreadPush_commits"
      >
        <li
          v-for="commit in shown"
          :key="commit.id"
          :class="[css.itemThreadPush_commit, isCurrent(getStopKey(commit)) && css.itemThreadPush_commit_current]"
          :data-reading-stop="getStopKey(commit)"
          data-reading-stop-kind="row"
          :aria-current="isCurrent(getStopKey(commit)) || undefined"
        >
          <GitCommitHorizontal
            :class="css.itemThreadPush_commitIcon"
            aria-hidden="true"
          />
          <span :class="css.itemThreadPush_message">{{ commit.messageHeadline }}</span>
          <CommitStateMarks
            :class="css.itemThreadPush_ci"
            :state="{ pullRequest: null, ci: commit.ci }"
            :with-pull-request="false"
          />
          <a
            :class="css.itemThreadPush_hash"
            :href="commit.url"
            target="_blank"
            rel="noopener noreferrer"
            >{{ commit.abbreviatedOid }}<ExternalMark
          /></a>
        </li>
      </ul>
      <Button
        v-if="more > 0"
        variant="link"
        tone="accent"
        :class="css.itemThreadPush_more"
        @click="showMore"
      >
        {{ t(l.showMore, { count: more }) }}
      </Button>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.itemThreadPush {
  @include item-thread-badge-row;
}

.itemThreadPush_badge {
  @include item-thread-badge;
}

.itemThreadPush_badgeIcon {
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.itemThreadPush_content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-4;
  align-items: flex-start;
  min-width: 0;
}

.itemThreadPush_line {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  align-self: stretch;
  min-height: 28px;
  margin: 0;
  font-size: $font-size-sm;
}

.itemThreadPush_who {
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.itemThreadPush_what {
  min-width: 0;
  color: $color-fg-2;
}

.itemThreadPush_when {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.itemThreadPush_commits {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  padding: 0;
  margin: 0;
  list-style: none;
}

.itemThreadPush_commit {
  display: flex;
  gap: $spacing-8;
  align-items: flex-start;
  padding: 3px 0;
}

// Under the reading cursor, as code review's cursor line: the tint 6px past its edges, a fill and a shadow, so nothing
// moves.
.itemThreadPush_commit_current {
  background: $color-cursor-tint;
  box-shadow: 0 0 0 $spacing-6 $color-cursor-tint;
}

.itemThreadPush_commitIcon {
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 2px;
  color: $color-fg-3;
}

.itemThreadPush_message {
  min-width: 0;
  font-size: $font-size-sm;
  line-height: 1.45;
  color: $color-fg-2;
  overflow-wrap: anywhere;
}

.itemThreadPush_ci {
  flex: none;
  margin-top: 2.5px;
}

.itemThreadPush_hash {
  @include focus-ring;

  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  line-height: 18px;
  color: $color-fg-dim;
  text-decoration: none;

  &:hover {
    color: $color-fg;
  }
}

.itemThreadPush_more {
  font-size: $font-size-xs;
}
</style>
