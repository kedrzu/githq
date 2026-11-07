<!-- What stands in a repository's Commits section while its first read runs (first run and loading D17, ES21, `Empty / Still arriving · commits`): the graph's shape, no words on screen, fading down the set. `refs` is the list of branches and tags in its column — the filter's box, a group of branches and one of tags; `graph` the graph's rows, as many as fit. Each place stands where the real one lands, laid out to its metrics. -->
<script lang="ts">
/** The design's rows, so a set looks the same on every render: widths varied, strength fading in even steps. */
const BRANCH_ROWS: readonly { nameWidth: number; opacity: number }[] = [
  { nameWidth: 150, opacity: 1 },
  { nameWidth: 110, opacity: 0.91 },
  { nameWidth: 170, opacity: 0.82 },
  { nameWidth: 130, opacity: 0.72 },
  { nameWidth: 90, opacity: 0.63 },
  { nameWidth: 140, opacity: 0.54 },
  { nameWidth: 120, opacity: 0.45 },
];

const TAG_ROWS: readonly { nameWidth: number; opacity: number }[] = [
  { nameWidth: 70, opacity: 0.6 },
  { nameWidth: 60, opacity: 0.5 },
  { nameWidth: 70, opacity: 0.41 },
  { nameWidth: 60, opacity: 0.31 },
  { nameWidth: 70, opacity: 0.22 },
  { nameWidth: 60, opacity: 0.12 },
];

const COMMIT_ROWS: readonly { messageWidth: number; authorWidth: number; opacity: number }[] = [
  { messageWidth: 360, authorWidth: 80, opacity: 1 },
  { messageWidth: 300, authorWidth: 96, opacity: 0.96 },
  { messageWidth: 420, authorWidth: 70, opacity: 0.93 },
  { messageWidth: 280, authorWidth: 88, opacity: 0.89 },
  { messageWidth: 390, authorWidth: 80, opacity: 0.86 },
  { messageWidth: 330, authorWidth: 96, opacity: 0.82 },
  { messageWidth: 450, authorWidth: 70, opacity: 0.79 },
  { messageWidth: 310, authorWidth: 88, opacity: 0.75 },
  { messageWidth: 370, authorWidth: 80, opacity: 0.72 },
  { messageWidth: 260, authorWidth: 96, opacity: 0.68 },
  { messageWidth: 410, authorWidth: 70, opacity: 0.65 },
  { messageWidth: 340, authorWidth: 88, opacity: 0.61 },
  { messageWidth: 300, authorWidth: 80, opacity: 0.57 },
  { messageWidth: 380, authorWidth: 96, opacity: 0.54 },
  { messageWidth: 290, authorWidth: 70, opacity: 0.5 },
  { messageWidth: 430, authorWidth: 88, opacity: 0.47 },
  { messageWidth: 320, authorWidth: 80, opacity: 0.43 },
  { messageWidth: 350, authorWidth: 96, opacity: 0.4 },
  { messageWidth: 270, authorWidth: 70, opacity: 0.36 },
  { messageWidth: 400, authorWidth: 88, opacity: 0.33 },
  { messageWidth: 330, authorWidth: 80, opacity: 0.29 },
  { messageWidth: 360, authorWidth: 96, opacity: 0.26 },
  { messageWidth: 300, authorWidth: 70, opacity: 0.22 },
  { messageWidth: 380, authorWidth: 88, opacity: 0.19 },
  { messageWidth: 350, authorWidth: 80, opacity: 0.15 },
];
</script>

<script lang="ts" setup>
import Skeleton from '@/components/Skeleton.vue';
import SkeletonBar from '@/components/SkeletonBar.vue';

import GhostCommitRow from './GhostCommitRow.vue';
import GhostRefRow from './GhostRefRow.vue';

defineProps<{
  /** `refs`: the list of branches and tags; `graph`: the graph's rows. */
  place: 'graph' | 'refs';
}>();
</script>

<template>
  <div
    v-if="place === 'refs'"
    :class="css.commitsArriving_refs"
    aria-hidden="true"
  >
    <div :class="css.commitsArriving_filter">
      <span :class="css.commitsArriving_field" />
    </div>
    <Skeleton :class="css.commitsArriving_head">
      <SkeletonBar
        :width="56"
        :height="8"
        tone="weak"
      />
    </Skeleton>
    <GhostRefRow
      v-for="(ghost, index) in BRANCH_ROWS"
      :key="`branch${index}`"
      :row="index"
      :name-width="ghost.nameWidth"
      :style="{ opacity: ghost.opacity }"
    />
    <Skeleton
      :class="css.commitsArriving_head"
      :row="BRANCH_ROWS.length"
    >
      <SkeletonBar
        :width="56"
        :height="8"
        tone="weak"
      />
    </Skeleton>
    <GhostRefRow
      v-for="(ghost, index) in TAG_ROWS"
      :key="`tag${index}`"
      :row="BRANCH_ROWS.length + 1 + index"
      :name-width="ghost.nameWidth"
      :style="{ opacity: ghost.opacity }"
    />
  </div>
  <div
    v-else
    :class="css.commitsArriving_graph"
    aria-hidden="true"
  >
    <GhostCommitRow
      v-for="(ghost, index) in COMMIT_ROWS"
      :key="index"
      :row="index"
      :message-width="ghost.messageWidth"
      :author-width="ghost.authorWidth"
      :style="{ opacity: ghost.opacity }"
    />
  </div>
</template>

<style lang="scss" module="css">
.commitsArriving_refs {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

// `CommitRefList`'s filter: its padding, and the box of its `SearchField` (`sm`), empty.
.commitsArriving_filter {
  flex: none;
  padding: $spacing-10 $spacing-10 $spacing-6;
}

.commitsArriving_field {
  display: block;
  height: 28px;
  background: $color-bg-2;
  border: 1px solid $color-control-border;
  border-radius: $radius-md;
}

// A group's head in `CommitRefList`: its padding and its line.
.commitsArriving_head {
  display: flex;
  flex: none;
  align-items: center;
  height: calc(#{$font-size-2xs} * #{$line-height-normal});
  padding: 0 $spacing-10;
  margin: $spacing-12 0 $spacing-4;
}

// As many rows as fit: the pane doesn't scroll over ghosts.
.commitsArriving_graph {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
</style>
