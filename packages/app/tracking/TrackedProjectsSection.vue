<!-- Settings' Projects (T17, D25): like Repositories (G8) — what is tracked, less what is being untracked with Undo on offer (`PendingUntracks`), by owner (`TrackedListView`) — each row saying where its items come from and how many of those repositories are tracked, how many items it holds and how it stands, all from what this browser keeps, so the rows show before GitHub's lists arrive — read once as the section opens, for the groups' standing, totals and "Track more". A row opens its settings; Untrack and ⌫ untrack at once, with Undo (T20); "Track projects" (A) and a group's "Track more" open the picker (T22), the latter on that owner. `?tab=projects&q=` (from an untracked project's screen) opens the picker at once with that search. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { useNow } from '@/services/useNow.js';

import { PendingUntracks } from './PendingUntracks.js';
import TrackedListView from './TrackedListView.vue';
import { TrackedItems } from './TrackedItems.js';
import type { ProjectContents } from './TrackedItems.js';
import TrackedProjectRow from './TrackedProjectRow.vue';
import { getProjectSettingsPath } from './trackingRoutes.js';
import { TrackingStore } from './TrackingStore.js';
import type { TrackedProject } from './TrackingTypes.js';
import TrackProjectsDialog from './TrackProjectsDialog.vue';
import { getTrackedStatus } from './utils/getTrackedStatus.js';
import { groupTrackedByOwner } from './utils/groupTrackedByOwner.js';

/** How often "synced 14s ago" moves on. */
const TICK_MS = 15_000;

/** A tracked project as its row shows it. */
interface ProjectRow extends ProjectContents {
  readonly project: TrackedProject;
  /** How many of {@link ProjectContents.repositories} the app lists as tracked. */
  readonly trackedRepositories: number;
}

const props = defineProps<{
  /** What the picker's filter holds when it opens at once (`?q=`, from an untracked project's screen). */
  initialSearch?: string;
}>();

const tracking = useService(TrackingStore);
const pending = useService(PendingUntracks);
const trackedItems = useService(TrackedItems);
const accounts = useService(AccountSession);
const router = useRouter();
const now = useNow(TICK_MS);

const pickerOpen = ref(Boolean(props.initialSearch));
const pickerOwner = ref<string>();
const pickerSearch = ref(props.initialSearch);

/**
 * Each project with its items and where they come from, and how many of those repositories the app lists as tracked.
 */
const rows = computed(() => {
  const trackedNames = new Set(pending.repositories.map(repository => repository.nameWithOwner));
  return pending.projects.map((project): ProjectRow => {
    const held = trackedItems.getProjectContents(project.id);
    return {
      project,
      ...held,
      trackedRepositories: held.repositories.filter(name => trackedNames.has(name)).length,
    };
  });
});
const groups = computed(() => {
  const listed = tracking.candidates;
  return groupTrackedByOwner({
    entries: rows.value,
    getOwner: row => row.project.owner,
    getName: row => row.project.title,
    getOwnerKind: row => row.project.ownerKind,
    login: accounts.current?.login ?? null,
    listed: listed
      ? new Map([
          [listed.login, listed.projects.length],
          ...listed.organizations.map((organization): [string, number] => [
            organization.login,
            organization.projects.length,
          ]),
        ])
      : null,
  });
});

void tracking.loadCandidates();

function getKey(row: ProjectRow) {
  return row.project.id;
}

function getStatus(id: string) {
  const target = { kind: 'project', id } as const;
  return getTrackedStatus(tracking.getProgress(target), tracking.getSyncState(target));
}

function openSettings(row: ProjectRow) {
  void router.push(getProjectSettingsPath(row.project));
}

function untrack(row: ProjectRow) {
  pending.untrack({ kind: 'project', id: row.project.id }, row.project.title);
}

function openPicker(owner?: string) {
  pickerOwner.value = owner;
  pickerSearch.value = undefined;
  pickerOpen.value = true;
}
</script>

<template>
  <TrackedListView
    kind="projects"
    :groups="groups"
    :get-key="getKey"
    @open="openSettings"
    @untrack="untrack"
    @add="openPicker"
  >
    <template #row="{ row, selected }">
      <TrackedProjectRow
        :title="row.project.title"
        :number="row.project.number"
        :item-count="row.itemCount"
        :repositories="row.repositories"
        :tracked-repositories="row.trackedRepositories"
        :status="getStatus(row.project.id)"
        :now="now"
        :selected="selected"
        @untrack="untrack(row)"
      />
    </template>
  </TrackedListView>
  <TrackProjectsDialog
    v-model:open="pickerOpen"
    :owner="pickerOwner"
    :search="pickerSearch"
  />
</template>
