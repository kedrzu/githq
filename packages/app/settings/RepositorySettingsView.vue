<!-- A tracked repository's settings (T16), under Settings' header: its head ("← Repositories › fitloop/webapp  private · tracked", Esc goes back) and its sections stacked below it, each a `SettingsBlock`: Tracking, and Workflow alerts (`WorkflowAlertsBlock`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { BookMarked, Lock } from 'lucide-vue-next';
import { computed } from 'vue';

import type { TrackedStatus } from '@/tracking/TrackingTypes.js';
import WorkflowAlertsBlock from '@/workflows/WorkflowAlertsBlock.vue';
import type { RepositoryWorkflows, WorkflowRefSettings } from '@/workflows/WorkflowTypes.js';

import * as sectionLabels from './SettingsSectionLabel.loc.js';
import SettingsPageHead from './SettingsPageHead.vue';
import TrackingBlock from './TrackingBlock.vue';
import * as l from './TrackedSettings.loc.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  /** `null` while nothing tells (no item of it arrived yet): the head says neither. */
  isPrivate: boolean | null;
  status: TrackedStatus;
  /** What "synced 14s ago" is counted from. */
  now: number;
  openCount: number;
  /** What is stored of its workflows; `undefined` before the first read. */
  workflows?: RepositoryWorkflows;
  /** Which refs raise its workflow alerts. */
  workflowSettings: WorkflowRefSettings;
  /** The page was opened on Workflow alerts' add field by its address. */
  openedOnAddField?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  untrack: [];
  /** Workflow alerts as the user just changed them. */
  workflowSettings: [settings: WorkflowRefSettings];
}>();

const t = useTranslate();

const meta = computed(() => {
  if (props.isPrivate === null) {
    return t(l.tracked);
  }

  return t(props.isPrivate ? l.privateTracked : l.publicTracked);
});
</script>

<template>
  <div
    :class="css.repositorySettingsView"
    :data-route-scroll="`repository-settings:${nameWithOwner}`"
  >
    <SettingsPageHead
      :parent="t(sectionLabels.repositories)"
      :icon="isPrivate ? Lock : BookMarked"
      :title="nameWithOwner"
      :meta="meta"
      @back="emit('back')"
    />
    <TrackingBlock
      kind="repository"
      :status="status"
      :now="now"
      :open-count="openCount"
      @untrack="emit('untrack')"
    />
    <WorkflowAlertsBlock
      :name-with-owner="nameWithOwner"
      :stored="workflows"
      :settings="workflowSettings"
      :now="now"
      :opened-on-add-field="openedOnAddField"
      @back="emit('back')"
      @change="emit('workflowSettings', $event)"
    />
  </div>
</template>

<style lang="scss" module="css">
.repositorySettingsView {
  flex: 1;
  min-height: 0;
  padding: $spacing-24 32px;
  overflow-y: auto;
}
</style>
