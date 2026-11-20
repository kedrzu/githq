<!-- Settings' Repositories (G8, D25, D44): what is tracked, less what is being untracked with Undo on offer (`PendingUntracks`), one flat list in the user's order (`TrackedListView`); each row names its owner and says whether it is private (its kept items, else GitHub's lists, read once as the section opens), its open items and how it stands, all from what this browser keeps, so the rows show before GitHub's lists arrive. A row opens its settings (T16); dragged, or moved with ⌥↑ / ⌥↓, it takes another place in the order (`TrackingStore.move`), the sidebar's too; Untrack and ⌫ untrack at once, with Undo (T20); "Track repositories" (A) opens the picker (T18). `?q=` (from an untracked repository's screen) opens the picker at once with that search. On a phone (`phone`, mobile D35) the rows only drill in; the screen's "+" adds (`add`), the picker a screen of its own. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { prefersReducedMotion } from '@/landing/prefersReducedMotion.js';
import { useNow } from '@/services/useNow.js';

import { PendingUntracks } from './PendingUntracks.js';
import TrackedListView from './TrackedListView.vue';
import { TrackedItems } from './TrackedItems.js';
import TrackedRepositoryRow from './TrackedRepositoryRow.vue';
import { getCandidateRepositories } from './trackingCandidates.js';
import { getRepositorySettingsPath } from './trackingRoutes.js';
import { TrackingStore } from './TrackingStore.js';
import type { TrackedRepository } from './TrackingTypes.js';
import TrackRepositoriesDialog from './TrackRepositoriesDialog.vue';
import type { SortablePlace } from './useSortableRows.js';
import { getTrackedStatus } from './utils/getTrackedStatus.js';

/** How often "synced 14s ago" moves on. */
const TICK_MS = 15_000;

const props = defineProps<{
  /** What the picker's filter holds when it opens at once (`?q=`, from an untracked repository's screen). */
  initialSearch?: string;
  /** In a phone's Settings (mobile D35): rows that drill in, adding from the screen's "+" (`add`). */
  phone?: boolean;
}>();

const tracking = useService(TrackingStore);
const pending = useService(PendingUntracks);
const trackedItems = useService(TrackedItems);
const router = useRouter();
const now = useNow(TICK_MS);

const pickerOpen = ref(Boolean(props.initialSearch));
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
const animate = computed(() => tracking.animations && !prefersReducedMotion());

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

function move(repository: TrackedRepository, place: SortablePlace<TrackedRepository>) {
  tracking.move(
    { kind: 'repository', nameWithOwner: repository.nameWithOwner },
    { anchor: { kind: 'repository', nameWithOwner: place.anchor.nameWithOwner }, side: place.side },
  );
}

function untrack(repository: TrackedRepository) {
  pending.untrack({ kind: 'repository', nameWithOwner: repository.nameWithOwner }, repository.nameWithOwner);
}

// A phone's "+" in the screen's top bar opens the picker.
defineExpose({ add: openPicker });

function openPicker() {
  pickerSearch.value = undefined;
  pickerOpen.value = true;
}
</script>

<template>
  <TrackedListView
    kind="repositories"
    :rows="pending.repositories"
    :get-key="getKey"
    :loaded="tracking.loaded"
    :phone="phone"
    :animate="animate"
    @open="openSettings"
    @move="move"
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
        :phone="phone"
        @untrack="untrack(row)"
      />
    </template>
  </TrackedListView>
  <TrackRepositoriesDialog
    v-model:open="pickerOpen"
    :search="pickerSearch"
  />
</template>
