<!-- What stands where rows or cards are still arriving (first run and loading D8, `Empty / Still arriving · screen | group | column`): ghosts alone, no words on screen, fading down the set; screen readers get one quiet line, not announced. -->
<script lang="ts">
interface GhostRowShape {
  titleWidth: number;
  metaWidth: number;
  opacity: number;
}

/** The design's rows, so a set looks the same on every render: widths varied, strength fading in even steps. */
const SCREEN_ROWS: readonly GhostRowShape[] = [
  { titleWidth: 420, metaWidth: 240, opacity: 1 },
  { titleWidth: 360, metaWidth: 280, opacity: 0.95 },
  { titleWidth: 480, metaWidth: 210, opacity: 0.9 },
  { titleWidth: 330, metaWidth: 260, opacity: 0.84 },
  { titleWidth: 450, metaWidth: 300, opacity: 0.78 },
  { titleWidth: 390, metaWidth: 220, opacity: 0.72 },
  { titleWidth: 510, metaWidth: 250, opacity: 0.65 },
  { titleWidth: 350, metaWidth: 290, opacity: 0.58 },
  { titleWidth: 430, metaWidth: 230, opacity: 0.5 },
  { titleWidth: 380, metaWidth: 270, opacity: 0.42 },
  { titleWidth: 470, metaWidth: 210, opacity: 0.34 },
  { titleWidth: 340, metaWidth: 250, opacity: 0.26 },
];

const GROUP_ROWS: readonly GhostRowShape[] = [
  { titleWidth: 340, metaWidth: 220, opacity: 1 },
  { titleWidth: 290, metaWidth: 250, opacity: 0.8 },
  { titleWidth: 360, metaWidth: 200, opacity: 0.6 },
];

const COLUMN_OPACITIES = [1, 0.8, 0.6];
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import GhostCard from './GhostCard.vue';
import GhostRow from './GhostRow.vue';
import * as l from './StillArriving.loc.js';

defineProps<{
  /** `screen`: a dozen rows filling a list; `group`: three rows under a list's group; `column`: three cards in a board's column. */
  place: 'screen' | 'group' | 'column';
}>();

const t = useTranslate();
</script>

<template>
  <div :class="[css.stillArriving, css[`stillArriving_${place}`]]">
    <span :class="css.stillArriving_label">{{ t(l.stillArriving) }}</span>
    <template v-if="place === 'column'">
      <GhostCard
        v-for="(opacity, index) in COLUMN_OPACITIES"
        :key="index"
        :row="index"
        :style="{ opacity }"
      />
    </template>
    <template v-else>
      <GhostRow
        v-for="(ghost, index) in place === 'screen' ? SCREEN_ROWS : GROUP_ROWS"
        :key="index"
        :row="index"
        :title-width="ghost.titleWidth"
        :meta-width="ghost.metaWidth"
        :style="{ opacity: ghost.opacity }"
      />
    </template>
  </div>
</template>

<style lang="scss" module="css">
.stillArriving {
  position: relative;
  display: flex;
  flex-direction: column;
}

.stillArriving_screen {
  padding-top: $spacing-8;
}

// The gap between a board's cards (`ListView`).
.stillArriving_column {
  gap: $spacing-8;
}

.stillArriving_label {
  @include visually-hidden;
}
</style>
