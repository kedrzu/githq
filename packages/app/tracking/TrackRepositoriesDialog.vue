<!-- Picking repositories to track (T18, D25): the first sign-in's chooser (G2) in a modal, as its picker: owners on the left with tracked / all, the filter (`/`) and sort above the list. What is being untracked with Undo on offer (`PendingUntracks`) counts as gone, so it can be picked; picking it takes the untrack back. A tick only selects: "Track N repositories" (⌘↵) adds the picked after the others in one write, and Esc or Cancel closes without asking, the picks gone. Opens on an owner (a group's "Track more") or a search (`?q=`, from an untracked repository's screen). The modal itself, its keys and Esc are `TrackPickerDialog`'s. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, ref, shallowRef, watch } from 'vue';

import { useNow } from '@/services/useNow.js';

import { ApprovalRequests } from './ApprovalRequests.js';
import { PendingUntracks } from './PendingUntracks.js';
import * as l from './TrackRepositoriesDialog.loc.js';
import { TrackedItems } from './TrackedItems.js';
import { getCandidateRepositories, toTrackedRepository } from './trackingCandidates.js';
import TrackingChooser from './TrackingChooser.vue';
import TrackPickerDialog from './TrackPickerDialog.vue';
import { TrackingStore } from './TrackingStore.js';
import type { CandidateProject, CandidateRepository, TrackedRepositoryEntry } from './TrackingTypes.js';

/** How often the rows' "active 12m ago" move on. */
const TICK_MS = 60_000;
/** The chooser's projects, which the picker has none of. */
const NO_PROJECTS: readonly string[] = [];

const props = defineProps<{
  /** The owner it opens on: a group's "Track more". */
  owner?: string;
  /** What its filter holds when it opens: `?q=`, from an untracked repository's screen. */
  search?: string;
}>();

const open = defineModel<boolean>('open', { default: false });

const t = useTranslate();
const tracking = useService(TrackingStore);
const pendingUntracks = useService(PendingUntracks);
const approvals = useService(ApprovalRequests);
const trackedItems = useService(TrackedItems);

const now = useNow(TICK_MS, open);
const reading = ref(false);
const filter = ref('');
const picked = shallowRef<readonly string[]>([]);
/** Looked up by name and ticked: what confirming tracks them from. */
const found = shallowRef<readonly (CandidateProject | CandidateRepository)[]>([]);

const tracked = computed(() =>
  pendingUntracks.repositories.map((repository): TrackedRepositoryEntry => ({
    nameWithOwner: repository.nameWithOwner,
    isPrivate: trackedItems.isPrivate(repository.nameWithOwner),
  })),
);
// One picked here and tracked meanwhile (another tab) is no longer picked.
const picks = computed(() => {
  const names = new Set(tracked.value.map(entry => entry.nameWithOwner));
  return picked.value.filter(name => !names.has(name));
});

// Every opening starts afresh: what was picked before it closed is gone.
watch(
  open,
  isOpen => {
    if (isOpen) {
      picked.value = [];
      found.value = [];
      filter.value = props.search ?? '';
      void readCandidates();
    }
  },
  { immediate: true },
);

async function readCandidates() {
  reading.value = true;
  try {
    await tracking.loadCandidates();
  } finally {
    reading.value = false;
  }
}

function addFound(candidate: CandidateProject | CandidateRepository) {
  found.value = [...found.value, candidate];
}

function track() {
  if (picks.value.length === 0) {
    return;
  }

  // Not untracked after all: nothing was written, so it stays where it is, and its timer must not untrack it.
  for (const nameWithOwner of picks.value) {
    pendingUntracks.undo({ kind: 'repository', nameWithOwner });
  }

  const added = getAdded();
  if (added.length > 0) {
    tracking.choose(current => ({
      repositories: [
        ...current.repositories,
        ...added.filter(
          repository => !current.repositories.some(other => other.nameWithOwner === repository.nameWithOwner),
        ),
      ],
      projects: current.projects,
    }));
  }

  open.value = false;
}

/** The picks not tracked at all, as they are tracked: from what GitHub offered, or what was looked up. */
function getAdded() {
  const candidates = new Map(
    [...(tracking.candidates ? getCandidateRepositories(tracking.candidates) : []), ...found.value].flatMap(
      (candidate): [string, CandidateRepository][] =>
        'nameWithOwner' in candidate ? [[candidate.nameWithOwner, candidate]] : [],
    ),
  );
  return picks.value.flatMap(name => {
    const candidate = candidates.get(name);
    return candidate ? [toTrackedRepository(candidate)] : [];
  });
}
</script>

<template>
  <TrackPickerDialog
    v-model:open="open"
    v-model:filter="filter"
    :title="t(l.title)"
    :description="t(l.description)"
    :width="880"
    :summary="t(l.summary, { count: picks.length, names: picks.join(', ') })"
    :track-label="t(l.track, { count: picks.length })"
    :can-track="picks.length > 0"
    @track="track"
  >
    <TrackingChooser
      v-model:repositories="picked"
      v-model:filter="filter"
      :projects="NO_PROJECTS"
      :tracked="tracked"
      :reading="reading"
      :initial-owner="owner"
      :candidates="tracking.candidates"
      :now="now"
      :found="found"
      :approvals="approvals.requests"
      :find="tracking.findCandidate"
      @track="track"
      @load-more="tracking.loadMoreRepositories"
      @request-approval="approvals.record"
      @found="addFound"
    />
  </TrackPickerDialog>
</template>
