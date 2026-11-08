<!-- A commit's row in the graph (git-client D18, CH12): its slice of the graph, the branches and tags pointing at it (up to three, then "+N"), its headline — dimmed for a merge — and right after it the pull request it came from (state and number, a link to it) and its CI mark; the author (avatar and name) and the age at the right edge. A failure is the red dot and a red ✕, never red text; running is amber in both. While the pull request and CI are not known yet an empty bar stands in for them, never a blank; a commit with neither shows nothing there. Where the row is narrow the headline is cut first and the author's name gives way to the avatar. -->
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
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import type { ItemReference } from '@/item/itemRoutes.js';
import { classifyStatus } from '@/store/classifyChecks.js';
import { formatAge } from '@/utils/formatAge.js';

import CommitGraphCell from './CommitGraphCell.vue';
import CommitRefChip from './CommitRefChip.vue';
import * as l from './CommitRow.loc.js';
import CommitStateMarks from './CommitStateMarks.vue';
import type { CommitState, KeptCommit } from './CommitTypes.js';
import type { CommitGraphRow } from './layoutCommitGraph.js';

const props = defineProps<{
  commit: KeptCommit;
  /** Its slice of the graph. */
  graphRow: CommitGraphRow;
  /** How many lanes the graph shows (`CommitGraphCell`). */
  lanes: number;
  /** Whether any lanes are folded onto the last one. */
  folded: boolean;
  /** The first lane is the default branch's. */
  mainLane: boolean;
  /** The branches and tags pointing at it: the default branch first, then branches, then tags. */
  refs: readonly CommitRowRef[];
  /** Its pull request and CI state; `undefined` while not known yet. */
  state: CommitState | undefined;
  /** Epoch ms its age is counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** A click on its pull request's number. */
  openPullRequest: [reference: ItemReference];
}>();

/** How many refs a row names before "+N". */
const SHOWN_REFS = 3;

const t = useTranslate();

const shownRefs = computed(() => props.refs.slice(0, SHOWN_REFS));
const moreRefs = computed(() => props.refs.length - shownRefs.value.length);
const dotTone = computed(() => {
  const ci = props.state?.ci;
  switch (ci ? classifyStatus(ci) : null) {
    case 'failing':
      return 'failing';
    case 'pending':
      return 'running';
    default:
      return 'plain';
  }
});
const authorName = computed(() => props.commit.author.name ?? props.commit.author.login ?? '');
const age = computed(() => formatAge(Date.parse(props.commit.committedDate), props.now));
</script>

<template>
  <div :class="css.commitRow">
    <CommitGraphCell
      :row="graphRow"
      :lanes="lanes"
      :folded="folded"
      :main-lane="mainLane"
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
      <CommitStateMarks
        :class="css.commitRow_marks"
        :state="state"
        linked
        @open-pull-request="emit('openPullRequest', $event)"
      />
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
  @include commit-row;

  height: 100%;
}

.commitRow_marks {
  padding-left: $spacing-4;
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

.commitRow_spacer {
  flex: 1 0 0;
}

.commitRow_author {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  width: $commit-row-author-width;
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
  width: $commit-row-age-width;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-align: right;
  white-space: nowrap;
}

// Narrow rows (details open, the column layout): the author's name gives way to the avatar.
@container (max-width: #{$commit-row-narrow-width}) {
  .commitRow_author {
    width: auto;
  }

  .commitRow_authorName {
    display: none;
  }
}
</style>
