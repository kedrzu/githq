<!-- `/owner/name/settings` (T16): a tracked repository's settings, at GitHub's own address of them, inside Settings with Repositories chosen — another tab, or `1` to `4`, goes to that section. The arrow, "Repositories" and Esc go back where the user came from, else to Repositories. Untrack is the same as on its row in Repositories (`PendingUntracks`, the toast with Undo is the shell's), then back to Repositories; one not tracked, or on its way out, settles on Repositories too — decided only once the kept settings are read, nothing shown until then. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useNow } from '@/services/useNow.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { TrackedItems } from '@/tracking/TrackedItems.js';
import { getCandidateRepositories } from '@/tracking/trackingCandidates.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { getTrackedStatus } from '@/tracking/utils/getTrackedStatus.js';
import { goBack } from '@/utils/goBack.js';

import RepositorySettingsView from './RepositorySettingsView.vue';
import type { SettingsSection } from './settingsRoutes.js';
import { getSettingsPath } from './settingsRoutes.js';
import SettingsView from './SettingsView.vue';
import { SettingsSync } from './sync/SettingsSync.js';

/** How often "synced 14s ago" moves on. */
const TICK_MS = 15_000;

const tracking = useService(TrackingStore);
const pending = useService(PendingUntracks);
const trackedItems = useService(TrackedItems);
const sync = useService(SettingsSync);
const route = useRoute();
const router = useRouter();
const now = useNow(TICK_MS);

const nameWithOwner = computed(() => `${String(route.params.owner)}/${String(route.params.name)}`);
/** Tracked and not on its way out; `undefined` otherwise. */
const repository = computed(() =>
  pending.repositories.find(candidate => candidate.nameWithOwner === nameWithOwner.value),
);
const section = computed({
  get: (): SettingsSection => 'repositories',
  set: value => void router.push(getSettingsPath(value)),
});
const status = computed(() => {
  const target = { kind: 'repository', nameWithOwner: nameWithOwner.value } as const;
  return getTrackedStatus(tracking.getProgress(target), tracking.getSyncState(target));
});

// Untracked here or elsewhere, or never tracked: its section of Settings, in place of this page. On a cold load
// nothing is tracked until the kept settings are read. Leaving, the address already names another screen: not this
// page's to replace.
const ownRoute = route.name;
watch(
  () => route.name === ownRoute && tracking.loaded && !repository.value,
  leave => {
    if (leave) {
      void router.replace(getSettingsPath('repositories'));
    }
  },
  { immediate: true },
);

/** Back to Repositories: by the watch above, once it is pending. */
function untrack() {
  pending.untrack({ kind: 'repository', nameWithOwner: nameWithOwner.value }, nameWithOwner.value);
}

// As its row in Repositories tells it: the kept items, else GitHub's lists when read this session.
const isPrivate = computed(() => {
  const listed = tracking.candidates ? getCandidateRepositories(tracking.candidates) : [];
  return (
    trackedItems.isPrivate(nameWithOwner.value) ??
    listed.find(candidate => candidate.nameWithOwner === nameWithOwner.value)?.isPrivate ??
    null
  );
});
</script>

<template>
  <SettingsView
    v-model:section="section"
    :tracked-repositories="tracking.repositories.length"
    :tracked-projects="tracking.projects.length"
    :saving-stopped="sync.state.state === 'stopped'"
  >
    <RepositorySettingsView
      v-if="tracking.loaded && repository"
      :name-with-owner="repository.nameWithOwner"
      :is-private="isPrivate"
      :status="status"
      :now="now"
      :open-count="trackedItems.getOpenCount({ kind: 'repository', nameWithOwner: repository.nameWithOwner })"
      @back="goBack(router, getSettingsPath('repositories'))"
      @untrack="untrack"
    />
  </SettingsView>
</template>
