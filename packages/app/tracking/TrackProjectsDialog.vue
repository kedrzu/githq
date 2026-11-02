<!-- Picking projects to track (T22, D25): the project chooser (`ProjectChooser`) in the repository picker's modal (T18), 1040 wide. What is being untracked with Undo on offer (`PendingUntracks`) counts as gone, so it can be picked; picking it takes the untrack back. A tick only selects: "Track N projects" (⌘↵) adds the picked after the others in one write, and Esc or Cancel closes without asking, the picks gone. Opens on an owner (a group's "Track more") or a search (`?tab=projects&q=`, from an untracked project's screen). The modal itself, its keys and Esc are `TrackPickerDialog`'s. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, ref, shallowRef, watch } from 'vue';

import { useNow } from '@/services/useNow.js';

import { ApprovalRequests } from './ApprovalRequests.js';
import { PendingUntracks } from './PendingUntracks.js';
import ProjectChooser from './ProjectChooser.vue';
import * as l from './TrackProjectsDialog.loc.js';
import { getCandidateProjects, toTrackedProject } from './trackingCandidates.js';
import { TrackingStore } from './TrackingStore.js';
import TrackPickerDialog from './TrackPickerDialog.vue';
import type { CandidateProject } from './TrackingTypes.js';

/** How often the rows' "updated 1d ago" move on. */
const TICK_MS = 60_000;

const props = defineProps<{
  /** The owner it opens on: a group's "Track more". */
  owner?: string;
  /** What its filter holds when it opens: `?q=`, from an untracked project's screen. */
  search?: string;
}>();

const open = defineModel<boolean>('open', { default: false });

const t = useTranslate();
const tracking = useService(TrackingStore);
const pendingUntracks = useService(PendingUntracks);
const approvals = useService(ApprovalRequests);

const now = useNow(TICK_MS, open);
const reading = ref(false);
const filter = ref('');
const picked = shallowRef<readonly string[]>([]);
/** Looked up by address and ticked: what confirming tracks them from. */
const found = shallowRef<readonly CandidateProject[]>([]);

/** What GitHub offered and what was looked up, by id. */
const candidates = computed(
  () =>
    new Map(
      [...(tracking.candidates ? getCandidateProjects(tracking.candidates) : []), ...found.value].map(project => [
        project.id,
        project,
      ]),
    ),
);
// One picked here and tracked meanwhile (another tab) is no longer picked.
const picks = computed(() => {
  const ids = new Set(pendingUntracks.projects.map(project => project.id));
  return picked.value.filter(id => !ids.has(id));
});
/** The picks as the footer names them, `owner/title`. */
const pickNames = computed(() =>
  picks.value.flatMap(id => {
    const project = candidates.value.get(id) ?? tracking.projects.find(other => other.id === id);
    return project ? [`${project.owner}/${project.title}`] : [];
  }),
);

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

function addFound(project: CandidateProject) {
  found.value = [...found.value, project];
}

function track() {
  if (picks.value.length === 0) {
    return;
  }

  // Not untracked after all: nothing was written, so it stays where it is, and its timer must not untrack it.
  for (const id of picks.value) {
    pendingUntracks.undo({ kind: 'project', id });
  }

  const added = picks.value.flatMap(id => {
    const project = candidates.value.get(id);
    return project && !tracking.isTracked({ kind: 'project', id }) ? [toTrackedProject(project)] : [];
  });
  if (added.length > 0) {
    tracking.choose(current => ({
      repositories: current.repositories,
      projects: [
        ...current.projects,
        ...added.filter(project => !current.projects.some(other => other.id === project.id)),
      ],
    }));
  }

  open.value = false;
}
</script>

<template>
  <TrackPickerDialog
    v-model:open="open"
    v-model:filter="filter"
    :title="t(l.title)"
    :description="t(l.description)"
    :width="1040"
    :summary="t(l.summary, { count: picks.length, names: pickNames.join(', ') })"
    :track-label="t(l.track, { count: picks.length })"
    :can-track="picks.length > 0"
    @track="track"
  >
    <ProjectChooser
      v-model:projects="picked"
      v-model:filter="filter"
      :tracked="pendingUntracks.projects"
      :reading="reading"
      :initial-owner="owner"
      :candidates="tracking.candidates"
      :now="now"
      :found="found"
      :approvals="approvals.requests"
      :find="tracking.findCandidate"
      @track="track"
      @request-approval="approvals.record"
      @found="addFound"
    />
  </TrackPickerDialog>
</template>
