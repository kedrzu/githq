<!-- The Repositories and Projects sections of Settings (G8): changing what is tracked, later. Lists what is tracked with how fresh it is, suggests the repositories the user's work lives in, offers what the user and their organisations have (read from GitHub when the section opens, once a session, the rest page by page as a filter needs it) and anyone's by name, and keeps the organisations in view. -->
<script lang="ts" setup>
import { sumOver } from '@nzyme/utils/array/sumOver.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted, shallowRef, watch } from 'vue';

import { Browser } from '@/services/Browser.js';
import { useNow } from '@/services/useNow.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { Freshness } from '@/sync/Freshness.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { ApprovalRequests } from './ApprovalRequests.js';
import { getCandidateRepositories, toTrackedProject, toTrackedRepository } from './trackingCandidates.js';
import { getProjectPath, getRepositoryPath } from './trackingRoutes.js';
import { TrackingStore } from './TrackingStore.js';
import type { CandidateProject, CandidateRepository, TrackedTarget } from './TrackingTypes.js';
import TrackingView from './TrackingView.vue';
import type { SuggestedRepository, TrackedRow, TrackedRowState, TrackingTab } from './TrackingView.vue';
import { TrackedItems } from './TrackedItems.js';
import { haveOpenItemsArrived } from './utils/haveOpenItemsArrived.js';

/** How often the rows' "14s ago" move on. */
const TICK_MS = 15_000;
/** How many of the repositories "my work" lives in the section suggests. */
const SUGGESTED = 8;
/** How long what is tracked and kept must stay as it is before the size this browser keeps is asked again. */
const ESTIMATE_DELAY_MS = 1000;

defineProps<{
  /** Which of the two sections it is. */
  tab: TrackingTab;
  /** What its search field holds when it opens (`?q=`, from an untracked repository's or project's screen). */
  initialSearch?: string;
}>();

const tracking = useService(TrackingStore);
const approvals = useService(ApprovalRequests);
const items = useService(ItemStore);
const trackedItems = useService(TrackedItems);
const sync = useService(SyncEngine);
const browser = useService(Browser);

const now = useNow(TICK_MS);
const storedBytes = shallowRef<number | null>(null);

// Whether a repository is private, as what GitHub offered says: read this session, it tells before any of its items
// arrive, and after a change of visibility.
const offeredPrivate = computed(() => {
  const candidates = tracking.candidates;
  return new Map(
    (candidates ? getCandidateRepositories(candidates) : []).map(repository => [
      repository.nameWithOwner,
      repository.isPrivate,
    ]),
  );
});

const tracked = computed(() => ({
  repositories: tracking.repositories.map((repository): TrackedRow => {
    const target: TrackedTarget = { kind: 'repository', nameWithOwner: repository.nameWithOwner };
    const progress = tracking.getProgress(target);
    return {
      target,
      name: repository.nameWithOwner,
      owner: parseRepositoryName(repository.nameWithOwner).owner,
      to: getRepositoryPath(repository.nameWithOwner),
      isPrivate: offeredPrivate.value.get(repository.nameWithOwner) ?? trackedItems.isPrivate(repository.nameWithOwner),
      items: progress.total === null ? null : progress.done,
      activeAt: trackedItems.getActiveAt(repository.nameWithOwner),
      state: getState(target, sync.getRepositoryFreshness(repository.nameWithOwner).kind),
    };
  }),
  projects: tracking.projects.map((project): TrackedRow => {
    const target: TrackedTarget = { kind: 'project', id: project.id };
    const progress = tracking.getProgress(target);
    return {
      target,
      name: project.title,
      owner: project.owner,
      to: getProjectPath(project),
      isPrivate: null,
      items: progress.total === null ? null : progress.done,
      activeAt: null,
      state: getState(target, sync.getProjectFreshness(project.id).kind),
    };
  }),
}));

const trackedRows = computed(() => [...tracked.value.repositories, ...tracked.value.projects]);

// The repositories "my work" has items in that are not tracked, the most items first.
const suggested = computed((): SuggestedRepository[] => {
  const byName = new Map<string, { isPrivate: boolean; items: number; activeAt: number }>();
  const seen = new Set<string>();
  for (const group of MY_WORK_GROUPS) {
    for (const id of items.membership[group] ?? []) {
      const item = items.get(id);
      if (
        !item ||
        seen.has(id) ||
        tracking.isTracked({ kind: 'repository', nameWithOwner: item.repository.nameWithOwner })
      ) {
        continue;
      }

      seen.add(id);
      const entry = byName.get(item.repository.nameWithOwner);
      const updatedAt = Date.parse(item.updatedAt);
      byName.set(item.repository.nameWithOwner, {
        isPrivate: item.repository.isPrivate,
        items: (entry?.items ?? 0) + 1,
        activeAt: Math.max(entry?.activeAt ?? 0, updatedAt),
      });
    }
  }

  return [...byName]
    .map(([nameWithOwner, entry]) => ({ nameWithOwner, ...entry }))
    .toSorted((a, b) => b.items - a.items || b.activeAt - a.activeAt)
    .slice(0, SUGGESTED);
});

onMounted(() => {
  void tracking.loadCandidates();
  void estimateStorage(() => false);
});

// What this browser keeps grows with each page a download writes and shrinks with each untracking: asked again once
// what is tracked and how many items are kept settle, latest wins.
watch(
  [() => trackedRows.value.map(row => row.name).join('\n'), () => sumOver(trackedRows.value, row => row.items ?? 0)],
  (_now, _before, onCleanup) => {
    let stale = false;
    const timer = setTimeout(() => void estimateStorage(() => stale), ESTIMATE_DELAY_MS);
    onCleanup(() => {
      stale = true;
      clearTimeout(timer);
    });
  },
);

async function estimateStorage(isStale: () => boolean) {
  const estimate = await browser.estimateStorage();
  if (!isStale()) {
    storedBytes.value = estimate;
  }
}

function getState(target: TrackedTarget, freshness: Freshness['kind']): TrackedRowState {
  const progress = tracking.getProgress(target);
  if (progress.state === 'hidden') {
    return { kind: 'hidden' };
  }

  // Each kind through its own overload.
  const state = target.kind === 'repository' ? tracking.getSyncState(target) : tracking.getSyncState(target);
  if (!haveOpenItemsArrived(state)) {
    return { kind: 'downloading', done: progress.done, total: progress.total };
  }

  if (state.refused && state.kind === 'repository') {
    return { kind: 'refused' };
  }

  return { kind: 'read', at: state.lastSuccessAt, fresh: freshness === 'fresh', slower: state.refused !== null };
}

async function trackSuggested(nameWithOwner: string) {
  const found = await tracking.findCandidate({ kind: 'repository', ...parseRepositoryName(nameWithOwner) });
  if (found) {
    track(found);
  }
}

function track(candidate: CandidateProject | CandidateRepository) {
  tracking.track(
    'nameWithOwner' in candidate
      ? { repository: toTrackedRepository(candidate) }
      : { project: toTrackedProject(candidate) },
  );
}
</script>

<template>
  <TrackingView
    :tab="tab"
    :initial-search="initialSearch"
    :tracked="tracked"
    :suggested="suggested"
    :candidates="tracking.candidates"
    :approvals="approvals.requests"
    :stored-bytes="storedBytes"
    :now="now"
    :find="tracking.findCandidate"
    @untrack="tracking.untrack"
    @track-suggested="trackSuggested"
    @track="track"
    @load-more="tracking.loadMoreRepositories"
    @request-approval="approvals.record"
  />
</template>
