<!-- A commit's row in the graph (git-client D18, CH12, CH64–CH66): its slice of the graph, its dot on the first line, then two lines. The first is what you scan: its headline — dimmed for a merge — and right after it the pull request it came from (state and number, a link to it) and its CI mark. The second, smaller and quieter: the branches and tags pointing at it (up to three, then "+N"; nothing when none), the author (avatar and name, at the name's width), the age and the short sha, each after a "·" that goes with it — nothing pinned to the right edge, and a missing part leaves no stray "·". A failure is a red centre in its dot (`CommitGraphCell`) and a red ✕, never red text; running is amber in both. While the pull request and CI are not known yet an empty bar stands in for them, never a blank; a commit with neither shows nothing there. Where the row is narrow the short sha goes first; the headline is cut only when its line lacks room, the author's name last on its line, with an ellipsis. -->
<script lang="ts">
/** A row's height: the graph's lines span it, and the list places and sizes rows by it. */
export const COMMIT_ROW_HEIGHT = 52;
/** How far down a row the graph's dot sits: the middle of its first line. */
export const COMMIT_ROW_DOT_Y = 16;

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
const shortOid = computed(() => props.commit.oid.slice(0, 7));
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
      :dot-y="COMMIT_ROW_DOT_Y"
      :tone="dotTone"
    />
    <div :class="css.commitRow_lines">
      <div :class="css.commitRow_line">
        <span :class="[css.commitRow_headline, graphRow.isMerge && css.commitRow_headline_merge]">{{
          commit.headline
        }}</span>
        <CommitStateMarks
          :state="state"
          linked
          @open-pull-request="emit('openPullRequest', $event)"
        />
      </div>
      <div :class="[css.commitRow_line, css.commitRow_line_meta]">
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
        <span
          v-if="authorName"
          :class="css.commitRow_author"
        >
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
        <span :class="css.commitRow_sha">{{ shortOid }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.commitRow {
  @include commit-row;

  height: 100%;
}

.commitRow_lines {
  @include commit-row-lines;
}

.commitRow_line {
  @include commit-row-line;
}

// The second line is quieter: smaller, the name in the second tone, the rest dimmer.
.commitRow_line_meta {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commitRow_headline {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-lg;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commitRow_headline_merge {
  color: $color-fg-2;
}

// Cut last on its line: the chips, the age and the sha keep their width.
.commitRow_author {
  display: inline-flex;
  flex: 0 1 auto;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
}

.commitRow_authorName {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commitRow_age,
.commitRow_sha {
  flex: none;
  white-space: nowrap;
}

.commitRow_sha {
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
}

// The "·" before the age, after an author only, and before the sha; screen readers don't read it.
.commitRow_author + .commitRow_age::before,
.commitRow_sha::before {
  margin-right: $spacing-6;
  font-family: $font-family-sans;
  font-size: $font-size-xs;
  content: '·' / '';
}

// Narrow rows (details open): the short sha and its "·" give way.
@container (max-width: #{$commit-row-narrow-width}) {
  .commitRow_sha {
    display: none;
  }
}
</style>
