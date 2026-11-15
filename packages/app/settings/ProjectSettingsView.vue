<!-- A tracked project's settings (T17), under Settings' header: its head ("← Projects › Roadmap  acme · tracked", Esc goes back) and its sections stacked below it, each a `SettingsBlock` — Tracking alone until projects get settings of their own. On a phone (`phone`, mobile MB155) one column in the screen's scroll: its head (`PhoneTrackedHead`; back is the screen's top bar's), then Tracking with Stop tracking. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { SquareKanban } from 'lucide-vue-next';

import type { TrackedStatus } from '@/tracking/TrackingTypes.js';

import PhoneTrackedHead from './PhoneTrackedHead.vue';
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
  /** On a phone: one column in the screen's scroll, with no head of Settings. */
  phone?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  untrack: [];
}>();

const t = useTranslate();
</script>

<template>
  <div
    v-if="phone"
    :class="css.projectSettingsView_phone"
  >
    <PhoneTrackedHead
      :icon="SquareKanban"
      :title="title"
      :meta="t(l.ownerTracked, { owner })"
      :status="status"
      :now="now"
    />
    <TrackingBlock
      kind="project"
      :name="title"
      :status="status"
      :now="now"
      :open-count="openCount"
      phone
      @untrack="emit('untrack')"
    />
  </div>
  <div
    v-else
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
      :name="title"
      :status="status"
      :now="now"
      :open-count="openCount"
      @untrack="emit('untrack')"
    />
  </div>
</template>

<style lang="scss" module="css">
.projectSettingsView_phone {
  display: flex;
  flex-direction: column;
}

.projectSettingsView {
  flex: 1;
  min-height: 0;
  padding: $spacing-24 32px;
  overflow-y: auto;
}
</style>
