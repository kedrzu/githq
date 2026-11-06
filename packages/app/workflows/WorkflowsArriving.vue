<!-- What stands where workflows are still arriving (first run and loading D17, ES27, ES28, `Empty / Still arriving · workflows`): two groups of ghost workflow rows (`GhostWorkflowRow`), no words on screen, fading down the set; with `repository`, each row has the repository's column, as on Broken workflows. Screen readers get one quiet line, not announced. -->
<script lang="ts">
/** The design's set, top to bottom: a group's head, three rows, another head, five rows, fading in even steps. */
const SET: readonly { kind: 'head' | 'row'; opacity: number }[] = [
  { kind: 'head', opacity: 1 },
  { kind: 'row', opacity: 0.92 },
  { kind: 'row', opacity: 0.84 },
  { kind: 'row', opacity: 0.77 },
  { kind: 'head', opacity: 0.69 },
  { kind: 'row', opacity: 0.61 },
  { kind: 'row', opacity: 0.53 },
  { kind: 'row', opacity: 0.46 },
  { kind: 'row', opacity: 0.38 },
  { kind: 'row', opacity: 0.3 },
];
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import Skeleton from '@/components/Skeleton.vue';
import SkeletonBar from '@/components/SkeletonBar.vue';

import GhostWorkflowRow from './GhostWorkflowRow.vue';
import * as l from './WorkflowsArriving.loc.js';

withDefaults(
  defineProps<{
    /** Whether the rows have the repository's column, as on the cross-repository screen. */
    repository?: boolean;
  }>(),
  { repository: false },
);

const t = useTranslate();
</script>

<template>
  <div :class="css.workflowsArriving">
    <span :class="css.workflowsArriving_label">{{ t(l.stillArriving) }}</span>
    <template
      v-for="(ghost, index) in SET"
      :key="index"
    >
      <Skeleton
        v-if="ghost.kind === 'head'"
        :class="css.workflowsArriving_head"
        :row="index"
        :style="{ opacity: ghost.opacity }"
      >
        <SkeletonBar
          :width="64"
          :height="8"
          tone="weak"
        />
      </Skeleton>
      <GhostWorkflowRow
        v-else
        :row="index"
        :repository="repository"
        :style="{ opacity: ghost.opacity }"
      />
    </template>
  </div>
</template>

<style lang="scss" module="css">
.workflowsArriving {
  position: relative;
  display: flex;
  flex-direction: column;
}

// A group's head in a workflows list: its padding and its line.
.workflowsArriving_head {
  display: flex;
  align-items: center;
  height: calc(#{$font-size-xs} * #{$line-height-normal});
  padding: 0 $spacing-16;
  margin: $spacing-10 0 $spacing-6;
}

.workflowsArriving_label {
  @include visually-hidden;
}
</style>
