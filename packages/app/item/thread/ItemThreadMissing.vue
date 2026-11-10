<!-- What stands on an item's rail while none of its thread — the description, comments and events, which come together — is on this device (F16): no description card, the skeleton's comment card stands for it. Being read the first time (`Activity / Thread · loading`): a badge with a loader, "Loading 4 comments and the events from GitHub" — the count as the item's row knows it — and a skeleton in the thread's shape, an event, a comment's card, an event. Not given — GitHub not reached, or refusing (`Activity / Thread · failed`): a badge with a cloud gone, why, Try again — busy while it reads — and Open on GitHub. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, CloudOff, LoaderCircle, RotateCw } from 'lucide-vue-next';

import Button from '@/components/Button.vue';
import Skeleton from '@/components/Skeleton.vue';
import SkeletonBar from '@/components/SkeletonBar.vue';
import SkeletonCircle from '@/components/SkeletonCircle.vue';
import type { Item } from '@/store/ItemTypes.js';

import * as l from './ItemThreadMissing.loc.js';

defineProps<{
  item: Item;
  /** GitHub did not give it: not reached, or refused. */
  failed?: boolean;
  /** Reads it again; resolves once GitHub answered. */
  readAgain?: () => Promise<void>;
}>();

const t = useTranslate();
</script>

<template>
  <div
    v-if="failed"
    :class="css.itemThreadMissing_row"
  >
    <span
      :class="css.itemThreadMissing_badge"
      aria-hidden="true"
    >
      <CloudOff :class="[css.itemThreadMissing_icon, css.itemThreadMissing_icon_warning]" />
    </span>
    <div
      :class="css.itemThreadMissing_card"
      role="alert"
    >
      <p :class="css.itemThreadMissing_title">{{ t(l.failedTitle) }}</p>
      <p :class="css.itemThreadMissing_why">{{ t(l.failedWhy) }}</p>
      <div :class="css.itemThreadMissing_actions">
        <Button
          v-if="readAgain"
          size="compact"
          :icon="RotateCw"
          @click="readAgain"
        >
          {{ t(l.tryAgain) }}
        </Button>
        <Button
          size="compact"
          :icon="ArrowUpRight"
          :link="item.url"
          target="_blank"
        >
          {{ t(l.openOnGitHub) }}
        </Button>
      </div>
    </div>
  </div>
  <div
    v-else
    :class="css.itemThreadMissing"
  >
    <p
      :class="css.itemThreadMissing_row"
      role="status"
    >
      <span
        :class="css.itemThreadMissing_badge"
        aria-hidden="true"
      >
        <LoaderCircle :class="[css.itemThreadMissing_icon, css.itemThreadMissing_spin]" />
      </span>
      <span :class="css.itemThreadMissing_note">
        {{ item.commentCount > 0 ? t(l.loadingCounted, { count: item.commentCount }) : t(l.loading) }}
      </span>
    </p>
    <Skeleton :class="css.itemThreadMissing_skeleton">
      <div :class="css.itemThreadMissing_row">
        <SkeletonCircle
          :size="28"
          tone="weak"
        />
        <SkeletonBar
          :width="220"
          :height="8"
          tone="weak"
        />
      </div>
      <div :class="css.itemThreadMissing_comment">
        <span :class="css.itemThreadMissing_gutter">
          <SkeletonCircle
            :size="28"
            tone="weak"
          />
        </span>
        <div :class="css.itemThreadMissing_ghost">
          <div :class="css.itemThreadMissing_ghostHead">
            <SkeletonBar
              :width="120"
              :height="8"
            />
          </div>
          <div :class="css.itemThreadMissing_ghostBody">
            <SkeletonBar
              :width="440"
              :height="8"
              tone="weak"
            />
            <SkeletonBar
              :width="300"
              :height="8"
              tone="weak"
            />
          </div>
        </div>
      </div>
      <div :class="css.itemThreadMissing_row">
        <SkeletonCircle
          :size="28"
          tone="weak"
        />
        <SkeletonBar
          :width="160"
          :height="8"
          tone="weak"
        />
      </div>
    </Skeleton>
  </div>
</template>

<style lang="scss" module="css">
.itemThreadMissing {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.itemThreadMissing_skeleton {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.itemThreadMissing_row {
  @include item-thread-badge-row;

  align-items: center;
  margin: 0;
}

.itemThreadMissing_badge {
  @include item-thread-badge;

  align-self: flex-start;
}

.itemThreadMissing_icon {
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.itemThreadMissing_icon_warning {
  color: $color-amber;
}

@media (prefers-reduced-motion: no-preference) {
  .itemThreadMissing_spin {
    animation: item-thread-missing-spin 1s linear infinite;
  }
}

@keyframes item-thread-missing-spin {
  to {
    transform: rotate(360deg);
  }
}

.itemThreadMissing_note {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

// A comment's card on its way: the avatar in the thread's gutter, a head and two lines.
.itemThreadMissing_comment {
  @include item-thread-row;

  padding: $spacing-6 0;
}

.itemThreadMissing_gutter {
  @include item-thread-gutter(36px);
}

.itemThreadMissing_ghost {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.itemThreadMissing_ghostHead {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-14;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;
}

.itemThreadMissing_ghostBody {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-16 $spacing-16 18px;
}

.itemThreadMissing_card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: $spacing-10 $spacing-14 $spacing-12;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.itemThreadMissing_title {
  margin: 0;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  line-height: 1.45;
  color: $color-fg;
}

.itemThreadMissing_why {
  margin: 0;
  font-size: $font-size-xs;
  line-height: 1.45;
  color: $color-fg-dim;
}

.itemThreadMissing_actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  margin-top: $spacing-8;
}
</style>
