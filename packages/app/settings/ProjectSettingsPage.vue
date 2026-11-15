<!-- `/orgs/<login>/projects/<n>/settings`, `/users/<login>/projects/<n>/settings` (T17): a tracked project's settings, at GitHub's own addresses of them, inside Settings with Projects chosen — another section of the column, or its key, goes to that section. The arrow, "Projects" and Esc go back where the user came from, else to Projects. Untrack is the same as on its row in Projects (`PendingUntracks`, the toast with Undo is the shell's), then back to Projects; one not tracked, or on its way out, settles on Projects too — decided only once the kept settings are read, nothing shown until then. On a phone (`PhoneLayout.active`, mobile D35, MB155) a screen of its own with no column of the sections: back "‹ Projects" goes back where the user came from, else to Projects at its own address (`?tab=projects`), where Stop tracking and one not tracked settle too. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useNow } from '@/services/useNow.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { TrackedItems } from '@/tracking/TrackedItems.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { getTrackedStatus } from '@/tracking/utils/getTrackedStatus.js';
import { goBack } from '@/utils/goBack.js';

import PhoneSettingsScreen from './PhoneSettingsScreen.vue';
import ProjectSettingsView from './ProjectSettingsView.vue';
import * as sectionLabels from './SettingsSectionLabel.loc.js';
import type { SettingsSection } from './settingsRoutes.js';
import { getPhoneSettingsPath, getSettingsPath } from './settingsRoutes.js';
import SettingsView from './SettingsView.vue';
import { SettingsSync } from './sync/SettingsSync.js';

/** How often "synced 14s ago" moves on. */
const TICK_MS = 15_000;

const tracking = useService(TrackingStore);
const pending = useService(PendingUntracks);
const trackedItems = useService(TrackedItems);
const sync = useService(SettingsSync);
const phone = useService(PhoneLayout);
const route = useRoute();
const router = useRouter();
const now = useNow(TICK_MS);
const t = useTranslate();

/** Tracked and not on its way out; `undefined` otherwise. */
const project = computed(() => {
  const ownerKind = route.path.startsWith('/orgs/') ? 'org' : 'user';
  const number = Number(route.params.number);
  return pending.projects.find(
    candidate =>
      candidate.owner === route.params.owner && candidate.ownerKind === ownerKind && candidate.number === number,
  );
});
const section = computed({
  get: (): SettingsSection => 'projects',
  set: value => void router.push(getSettingsPath(value)),
});
/** Projects, at its own address on a phone, where `/settings` alone is the list of the sections. */
const projectsPath = computed(() => (phone.active ? getPhoneSettingsPath('projects') : getSettingsPath('projects')));
const status = computed(() => {
  if (!project.value) {
    return null;
  }

  const target = { kind: 'project', id: project.value.id } as const;
  return getTrackedStatus(tracking.getProgress(target), tracking.getSyncState(target));
});

// Untracked here or elsewhere, or never tracked: its section of Settings, in place of this page. On a cold load
// nothing is tracked until the kept settings are read. Leaving, the address already names another screen: not this
// page's to replace.
const ownRoute = route.name;
watch(
  () => route.name === ownRoute && tracking.loaded && !project.value,
  leave => {
    if (leave) {
      void router.replace(projectsPath.value);
    }
  },
  { immediate: true },
);

/** Back to Projects: by the watch above, once it is pending. */
function untrack() {
  if (project.value) {
    pending.untrack({ kind: 'project', id: project.value.id }, project.value.title);
  }
}
</script>

<template>
  <PhoneSettingsScreen
    v-if="phone.active"
    :title="project?.title ?? ''"
    back
    :back-place="t(sectionLabels.projects)"
    :scroll-key="`project-settings:${route.path}`"
    @back="goBack(router, projectsPath)"
  >
    <ProjectSettingsView
      v-if="tracking.loaded && project && status"
      :title="project.title"
      :owner="project.owner"
      :status="status"
      :now="now"
      :open-count="trackedItems.getOpenCount({ kind: 'project', id: project.id })"
      phone
      @back="goBack(router, projectsPath)"
      @untrack="untrack"
    />
  </PhoneSettingsScreen>
  <SettingsView
    v-else
    v-model:section="section"
    :tracked-repositories="tracking.repositories.length"
    :tracked-projects="tracking.projects.length"
    :saving-stopped="sync.state.state === 'stopped'"
  >
    <ProjectSettingsView
      v-if="tracking.loaded && project && status"
      :title="project.title"
      :owner="project.owner"
      :status="status"
      :now="now"
      :open-count="trackedItems.getOpenCount({ kind: 'project', id: project.id })"
      @back="goBack(router, projectsPath)"
      @untrack="untrack"
    />
  </SettingsView>
</template>
