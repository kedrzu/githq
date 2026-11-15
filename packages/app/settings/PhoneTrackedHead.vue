<!-- The head of a tracked repository's or project's settings on a phone (mobile MB152, MB155): its icon, its name large, and under it what it is with how it stands ("private · tracked · synced 14s ago", `TrackedRowNote`). The screen's top bar has back. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

import TrackedRowNote from '@/tracking/TrackedRowNote.vue';
import type { TrackedStatus } from '@/tracking/TrackingTypes.js';

defineProps<{
  icon: LucideIcon;
  /** `owner/name`, a project's title. */
  title: string;
  /** What is said of it before how it stands ("private · tracked"). */
  meta: string;
  status: TrackedStatus;
  /** What "synced 14s ago" is counted from. */
  now: number;
}>();
</script>

<template>
  <header :class="css.phoneTrackedHead">
    <component
      :is="icon"
      :class="css.phoneTrackedHead_icon"
      aria-hidden="true"
    />
    <div :class="css.phoneTrackedHead_text">
      <h2 :class="css.phoneTrackedHead_title">{{ title }}</h2>
      <p :class="css.phoneTrackedHead_meta">
        {{ meta }} ·
        <TrackedRowNote
          :status="status"
          :now="now"
        />
      </p>
    </div>
  </header>
</template>

<style lang="scss" module="css">
.phoneTrackedHead {
  display: flex;
  gap: $spacing-12;
  align-items: flex-start;
  padding: $spacing-16 $spacing-16 $spacing-8;
}

.phoneTrackedHead_icon {
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  color: $color-fg-2;
}

.phoneTrackedHead_text {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
}

.phoneTrackedHead_title {
  overflow-wrap: anywhere;
  font-size: $font-size-phone-title;
  font-weight: $font-weight-semibold;
}

.phoneTrackedHead_meta {
  font-size: $font-size-md;
  color: $color-fg-dim;
}
</style>
