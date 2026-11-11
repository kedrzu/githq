<!-- A break in an item's thread where its middle is not shown (`Activity / Fold`, F5): the rail turns dashed beside one band, the whole of it a button on nzyme's `useButton` — "Show 18 earlier events", what is folded by group ("10 commits · 3 comments · 5 other events", a group with none left out), a chevron — busy while they are read. A read that failed says so in place of the groups; the band reads again. Where the thread is narrow (a panel) the band takes two lines. -->
<script lang="ts" setup>
import { useButton } from '@nzyme/vue-forms/components/useButton.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ChevronDown,
  CircleAlert,
  CircleDot,
  GitCommitHorizontal,
  MessageSquare,
  UnfoldVertical,
} from 'lucide-vue-next';
import { computed } from 'vue';

import * as l from './ItemThreadFold.loc.js';

const props = defineProps({
  ...useButton.props,
  /** The commits of the pushes folded. */
  commits: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  /** The events but commits folded; a line of one person's events counts once. */
  otherEvents: { type: Number, default: 0 },
  /** Reading them failed: the band says so, and reads again. */
  failed: { type: Boolean, default: false },
});
defineEmits(useButton.emits);

const { Button, busy } = useButton();
const t = useTranslate();

const groups = computed(() =>
  [
    { key: 'commits', icon: GitCommitHorizontal, text: t(l.commits, { count: props.commits }), count: props.commits },
    { key: 'comments', icon: MessageSquare, text: t(l.comments, { count: props.comments }), count: props.comments },
    {
      key: 'otherEvents',
      icon: CircleDot,
      text: t(l.otherEvents, { count: props.otherEvents }),
      count: props.otherEvents,
    },
  ].filter(group => group.count > 0),
);
</script>

<template>
  <div :class="css.itemThreadFold">
    <span
      :class="css.itemThreadFold_break"
      aria-hidden="true"
    />
    <Button
      :class="css.itemThreadFold_band"
      :aria-busy="busy || undefined"
    >
      <span :class="css.itemThreadFold_show">
        <UnfoldVertical
          :class="css.itemThreadFold_showIcon"
          aria-hidden="true"
        />
        {{ t(l.showEarlier, { count: commits + comments + otherEvents }) }}
      </span>
      <span
        v-if="failed"
        :class="[css.itemThreadFold_summary, css.itemThreadFold_failed]"
      >
        <CircleAlert
          :class="css.itemThreadFold_failedIcon"
          aria-hidden="true"
        />
        {{ t(l.failed) }}
      </span>
      <span
        v-else
        :class="css.itemThreadFold_summary"
      >
        <span
          v-for="group in groups"
          :key="group.key"
          :class="css.itemThreadFold_count"
        >
          <component
            :is="group.icon"
            :class="css.itemThreadFold_countIcon"
            aria-hidden="true"
          />
          {{ group.text }}
        </span>
      </span>
      <ChevronDown
        :class="css.itemThreadFold_chevron"
        aria-hidden="true"
      />
    </Button>
  </div>
</template>

<style lang="scss" module="css">
// The band's line breaks under this width: the side panel's thread.
$narrow: 600px;
// From the break's left edge to its dashes, so the dashes run where the rail does.
$dash-offset: ($item-thread-rail-break-width - $item-thread-rail-width) * 0.5;

.itemThreadFold {
  display: flex;
  gap: $spacing-12;
  // The rail break centred on the rail (`ItemThread`).
  padding-left: $item-thread-rail-offset - $dash-offset;
  container-type: inline-size;
}

// As tall as the band and its 4px above and below; its fill hides the solid rail behind, its dashes stand in for it.
.itemThreadFold_break {
  position: relative;
  flex: none;
  width: $item-thread-rail-break-width;
  background: $color-bg-item;

  &::before {
    position: absolute;
    inset: 2px auto 2px $dash-offset;
    width: $item-thread-rail-width;
    content: '';
    background: repeating-linear-gradient($color-border 0 4px, transparent 4px 8px);
  }
}

.itemThreadFold_band {
  @include focus-ring;

  display: grid;
  flex: 1;
  grid-template-areas: 'show summary . chevron';
  grid-template-columns: auto auto 1fr auto;
  gap: $spacing-4 $spacing-14;
  align-items: center;
  min-width: 0;
  min-height: 40px;
  padding: 9px $spacing-14;
  margin: $spacing-4 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;

  &:hover {
    background: $color-bg-3;
  }

  &[aria-busy] {
    cursor: progress;
  }

  @container (width < #{$narrow}) {
    grid-template-areas:
      'show chevron'
      'summary summary';
    grid-template-columns: 1fr auto;
  }
}

.itemThreadFold_show {
  display: flex;
  grid-area: show;
  gap: $spacing-10;
  align-items: center;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-accent;
}

.itemThreadFold_showIcon {
  flex: none;
  width: 15px;
  height: 15px;
}

.itemThreadFold_summary {
  display: flex;
  flex-wrap: wrap;
  grid-area: summary;
  gap: $spacing-12;
  align-items: center;
}

.itemThreadFold_count {
  display: flex;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.itemThreadFold_countIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.itemThreadFold_failed {
  gap: $spacing-5;
  font-size: $font-size-xs;
  color: $color-fg;
}

.itemThreadFold_failedIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-red;
}

.itemThreadFold_chevron {
  grid-area: chevron;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}
</style>
