<!-- A tracked project's settings (T17), under Settings' header: its head ("← Projects › Roadmap  acme · tracked", Esc goes back) and its sections stacked below it, each a `SettingsBlock` — Tracking alone until projects get settings of their own. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { SquareKanban } from 'lucide-vue-next';

import type { TrackedStatus } from '@/tracking/TrackingTypes.js';

import * as sectionLabels from './SettingsSectionLabel.loc.js';
import SettingsPageHead from './SettingsPageHead.vue';
import TrackingBlock from './TrackingBlock.vue';
import * as l from './TrackedSettings.loc.js';

defineProps<{
  title: string;
  /** The login of the user or organisation owning it. */
  owner: string;
  status: TrackedStatus;
  /** What "synced 14s ago" is counted from. */
  now: number;
  openCount: number;
}>();

const emit = defineEmits<{
  back: [];
  untrack: [];
}>();

const t = useTranslate();
</script>

<template>
  <div
    :class="css.projectSettingsView"
    :data-route-scroll="`project-settings:${owner}/${title}`"
  >
    <SettingsPageHead
      :parent="t(sectionLabels.projects)"
      :icon="SquareKanban"
      :title="title"
      :meta="t(l.ownerTracked, { owner })"
      @back="emit('back')"
    />
    <TrackingBlock
      kind="project"
      :status="status"
      :now="now"
      :open-count="openCount"
      @untrack="emit('untrack')"
    />
  </div>
</template>

<style lang="scss" module="css">
.projectSettingsView {
  flex: 1;
  min-height: 0;
  padding: $spacing-24 32px;
  overflow-y: auto;
}
</style>
