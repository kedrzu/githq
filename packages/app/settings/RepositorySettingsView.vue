<!-- A tracked repository's settings (T16), under Settings' header: its head ("← Repositories › fitloop/webapp  private · tracked", Esc goes back) and its sections stacked below it, each a `SettingsBlock`: Tracking, Commit email (`CommitEmailBlock`, T24, T25: the default commit email for its owner and for it) and Workflow alerts (`WorkflowAlertsBlock`). On a phone (`phone`, mobile MB152) one column in the screen's scroll: its head (`PhoneTrackedHead`; back is the screen's top bar's), Tracking with Stop tracking, Commit email, then Workflow alerts. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { BookMarked, Lock } from 'lucide-vue-next';
import { computed } from 'vue';

import type { MergeSettings } from '@/merge/getMergeMethods.js';
import type { CommitEmailChoices } from '@/tracking/TrackingStore.js';
import type { TrackedStatus } from '@/tracking/TrackingTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';
import WorkflowAlertsBlock from '@/workflows/WorkflowAlertsBlock.vue';
import type { RepositoryWorkflows, WorkflowRefSettings } from '@/workflows/WorkflowTypes.js';

import CommitEmailBlock from './CommitEmailBlock.vue';
import PhoneTrackedHead from './PhoneTrackedHead.vue';
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
  /** The default commit email stored for it and for its owner. */
  commitEmail: CommitEmailChoices;
  /** The commit emails GitHub offers for it; `null` until its metadata is read. */
  commitEmailSettings: Pick<MergeSettings, 'viewerDefaultCommitEmail' | 'viewerPossibleCommitEmails'> | null;
  /** The page was opened on Workflow alerts' add field by its address. */
  openedOnAddField?: boolean;
  /** On a phone: one column in the screen's scroll, with no head of Settings. */
  phone?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  untrack: [];
  /** Workflow alerts as the user just changed them. */
  workflowSettings: [settings: WorkflowRefSettings];
  /** The owner's default commit email picked: an address, `null` for GitHub's default. */
  ownerCommitEmail: [owner: string, email: string | null];
  /** Its default commit email picked: an address, `null` for GitHub's default, `undefined` for the owner's. */
  repositoryCommitEmail: [email: string | null | undefined];
}>();

const t = useTranslate();
const owner = computed(() => parseRepositoryName(props.nameWithOwner).owner);

const meta = computed(() => {
  if (props.isPrivate === null) {
    return t(l.tracked);
  }

  return t(props.isPrivate ? l.privateTracked : l.publicTracked);
});
</script>

<template>
  <div
    v-if="phone"
    :class="css.repositorySettingsView_phone"
  >
    <PhoneTrackedHead
      :icon="isPrivate ? Lock : BookMarked"
      :title="nameWithOwner"
      :meta="meta"
      :status="status"
      :now="now"
    />
    <TrackingBlock
      kind="repository"
      :name="nameWithOwner"
      :status="status"
      :now="now"
      :open-count="openCount"
      phone
      @untrack="emit('untrack')"
    />
    <CommitEmailBlock
      :owner="owner"
      :choices="commitEmail"
      :settings="commitEmailSettings"
      phone
      @owner="emit('ownerCommitEmail', owner, $event)"
      @repository="emit('repositoryCommitEmail', $event)"
    />
    <WorkflowAlertsBlock
      :name-with-owner="nameWithOwner"
      :stored="workflows"
      :settings="workflowSettings"
      :now="now"
      :opened-on-add-field="openedOnAddField"
      phone
      @back="emit('back')"
      @change="emit('workflowSettings', $event)"
    />
  </div>
  <div
    v-else
    :class="css.repositorySettingsView"
    :data-route-scroll="`repository-settings:${nameWithOwner}`"
  >
    <div :class="css.repositorySettingsView_column">
      <SettingsPageHead
        :parent="t(sectionLabels.repositories)"
        :icon="isPrivate ? Lock : BookMarked"
        :title="nameWithOwner"
        :meta="meta"
        @back="emit('back')"
      />
      <TrackingBlock
        kind="repository"
        :name="nameWithOwner"
        :status="status"
        :now="now"
        :open-count="openCount"
        @untrack="emit('untrack')"
      />
      <CommitEmailBlock
        :owner="owner"
        :choices="commitEmail"
        :settings="commitEmailSettings"
        @owner="emit('ownerCommitEmail', owner, $event)"
        @repository="emit('repositoryCommitEmail', $event)"
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
  </div>
</template>

<style lang="scss" module="css">
.repositorySettingsView_phone {
  display: flex;
  flex-direction: column;
}

.repositorySettingsView {
  flex: 1;
  min-height: 0;
  padding: $spacing-24 32px;
  overflow-y: auto;
}

.repositorySettingsView_column {
  max-width: $settings-column-width;
}
</style>
