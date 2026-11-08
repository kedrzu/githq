<!-- Settings' Repositories (G8, D25): what is tracked, less what is being untracked with Undo on offer (`PendingUntracks`), by owner (`TrackedListView`); each row says whether it is private (its kept items, else GitHub's lists), its open items and how it stands, all from what this browser keeps, so the rows show before GitHub's lists arrive — read once as the section opens, for the groups' standing, totals and "Track more". A row opens its settings (T16); Untrack and ⌫ untrack at once, with Undo (T20); "Track repositories" (A) and a group's "Track more" open the picker (T18), the latter on that owner. `?q=` (from an untracked repository's screen) opens the picker at once with that search. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { useNow } from '@/services/useNow.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { PendingUntracks } from './PendingUntracks.js';
import TrackedListView from './TrackedListView.vue';
import { TrackedItems } from './TrackedItems.js';
import TrackedRepositoryRow from './TrackedRepositoryRow.vue';
import { getCandidateRepositories } from './trackingCandidates.js';
import { getRepositorySettingsPath } from './trackingRoutes.js';
import { TrackingStore } from './TrackingStore.js';
import type { TrackedRepository } from './TrackingTypes.js';
import TrackRepositoriesDialog from './TrackRepositoriesDialog.vue';
import { getTrackedStatus } from './utils/getTrackedStatus.js';
import { groupTrackedByOwner } from './utils/groupTrackedByOwner.js';

/** How often "synced 14s ago" moves on. */
const TICK_MS = 15_000;

const props = defineProps<{
  /** What the picker's filter holds when it opens at once (`?q=`, from an untracked repository's screen). */
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

/** What GitHub's lists say of each repository read so far, by `owner/name`. */
const candidates = computed(
  () =>
    new Map(
      (tracking.candidates ? getCandidateRepositories(tracking.candidates) : []).map(repository => [
        repository.nameWithOwner,
        repository,
      ]),
    ),
);
const groups = computed(() => {
  const listed = tracking.candidates;
  return groupTrackedByOwner({
    entries: pending.repositories,
    getOwner: repository => parseRepositoryName(repository.nameWithOwner).owner,
    getName: repository => parseRepositoryName(repository.nameWithOwner).name,
    login: accounts.current?.login ?? null,
    listed: listed
      ? new Map([
          [listed.login, listed.repositories.totalCount],
          ...listed.organizations.map((organization): [string, number | null] => [
            organization.login,
            organization.repositories?.totalCount ?? null,
          ]),
        ])
      : null,
  });
});

void tracking.loadCandidates();

function getKey(repository: TrackedRepository) {
  return repository.nameWithOwner;
}

function isPrivate(nameWithOwner: string) {
  return trackedItems.isPrivate(nameWithOwner) ?? candidates.value.get(nameWithOwner)?.isPrivate ?? null;
}

function getStatus(nameWithOwner: string) {
  const target = { kind: 'repository', nameWithOwner } as const;
  return getTrackedStatus(tracking.getProgress(target), tracking.getSyncState(target));
}

function openSettings(repository: TrackedRepository) {
  void router.push(getRepositorySettingsPath(repository.nameWithOwner));
}

function untrack(repository: TrackedRepository) {
  pending.untrack({ kind: 'repository', nameWithOwner: repository.nameWithOwner }, repository.nameWithOwner);
}

function openPicker(owner?: string) {
  pickerOwner.value = owner;
  pickerSearch.value = undefined;
  pickerOpen.value = true;
}
</script>

<template>
  <TrackedListView
    kind="repositories"
    :groups="groups"
    :get-key="getKey"
    :loaded="tracking.loaded"
    @open="openSettings"
    @untrack="untrack"
    @add="openPicker"
  >
    <template #row="{ row, selected }">
      <TrackedRepositoryRow
        :name-with-owner="row.nameWithOwner"
        :is-private="isPrivate(row.nameWithOwner)"
        :open-count="trackedItems.getOpenCount({ kind: 'repository', nameWithOwner: row.nameWithOwner })"
        :status="getStatus(row.nameWithOwner)"
        :now="now"
        :selected="selected"
        @untrack="untrack(row)"
      />
    </template>
  </TrackedListView>
  <TrackRepositoriesDialog
    v-model:open="pickerOpen"
    :owner="pickerOwner"
    :search="pickerSearch"
  />
</template>
