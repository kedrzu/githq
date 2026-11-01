<!-- The Repositories and Projects sections of Settings (G8): changing what is tracked, later. Lists what is tracked with how fresh it is, suggests the repositories the user's work lives in, offers what the user and their organisations have (read from GitHub when the section opens, once a session) and anyone's by name, and keeps the organisations hiding their data in view. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted } from 'vue';

import { useNow } from '@/services/useNow.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { Freshness } from '@/sync/Freshness.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { ApprovalRequests } from './ApprovalRequests.js';
import { toTrackedProject, toTrackedRepository } from './trackingCandidates.js';
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

defineProps<{
  /** Which of the two sections it is. */
  tab: TrackingTab;
}>();

const tracking = useService(TrackingStore);
const approvals = useService(ApprovalRequests);
const items = useService(ItemStore);
const trackedItems = useService(TrackedItems);
const sync = useService(SyncEngine);

const now = useNow(TICK_MS);

const tracked = computed(() => ({
  repositories: tracking.repositories.map((repository): TrackedRow => {
    const target: TrackedTarget = { kind: 'repository', nameWithOwner: repository.nameWithOwner };
    const progress = tracking.getProgress(target);
    return {
      target,
      name: repository.nameWithOwner,
      to: getRepositoryPath(repository.nameWithOwner),
      isPrivate: trackedItems.isPrivate(repository.nameWithOwner),
      items: progress.total === null ? null : progress.done,
      state: getState(target, sync.getRepositoryFreshness(repository.nameWithOwner).kind),
    };
  }),
  projects: tracking.projects.map((project): TrackedRow => {
    const target: TrackedTarget = { kind: 'project', id: project.id };
    const progress = tracking.getProgress(target);
    return {
      target,
      name: project.title,
      to: getProjectPath(project),
      isPrivate: false,
      items: progress.total === null ? null : progress.done,
      state: getState(target, sync.getProjectFreshness(project.id).kind),
    };
  }),
}));

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

onMounted(() => void tracking.loadCandidates());

function getState(target: TrackedTarget, freshness: Freshness['kind']): TrackedRowState {
  const progress = tracking.getProgress(target);
  if (progress.state === 'hidden') {
    return { kind: 'hidden' };
  }

  // Each kind through its own overload.
  const state = target.kind === 'repository' ? tracking.getSyncState(target) : tracking.getSyncState(target);
  if (!haveOpenItemsArrived(state)) {
    return {
      kind: 'downloading',
      percent: progress.total ? Math.floor((progress.done / progress.total) * 100) : null,
    };
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
    :tracked="tracked"
    :suggested="suggested"
    :candidates="tracking.candidates"
    :approvals="approvals.requests"
    :now="now"
    :find="tracking.findCandidate"
    @untrack="tracking.untrack"
    @track-suggested="trackSuggested"
    @track="track"
    @request-approval="approvals.record"
  />
</template>
