<!-- The What to track section of Settings (G8, D24): the first sign-in's chooser, a tick meaning tracked. What GitHub offers is read when the section opens (once a session), the rest page by page as the list needs it, and anyone's repository or project is looked up by name. Ticking and unticking only stages changes — nothing is written until Save, which applies exactly those to what is tracked then, in one write: what was tracked meanwhile (another tab, the sidebar) or never shown as a row stays tracked. Discard puts the ticks back to what is tracked. A row the user has not touched follows what is tracked, and a staged change that became true meanwhile stops being one. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted, ref, shallowRef, watch } from 'vue';

import { useNow } from '@/services/useNow.js';

import { ApprovalRequests } from './ApprovalRequests.js';
import { TrackedItems } from './TrackedItems.js';
import {
  getCandidateProjects,
  getCandidateRepositories,
  toTrackedProject,
  toTrackedRepository,
} from './trackingCandidates.js';
import TrackingChooser from './TrackingChooser.vue';
import { TrackingStore } from './TrackingStore.js';
import type {
  CandidateProject,
  CandidateRepository,
  TrackedEntries,
  TrackedProject,
  TrackedRepository,
  TrackedStatus,
  TrackedTarget,
} from './TrackingTypes.js';
import { applyStagedChanges } from './utils/applyStagedChanges.js';
import { haveOpenItemsArrived } from './utils/haveOpenItemsArrived.js';

/** How often the rows' "synced 14s ago" move on. */
const TICK_MS = 15_000;

/** Ticks of one kind that differ from what is tracked, by `owner/name` or id. */
interface StagedKeys {
  /** Ticked and not tracked, in the order ticked. */
  readonly added: readonly string[];
  /** Tracked and unticked. */
  readonly removed: readonly string[];
}

const NOTHING_STAGED: StagedKeys = { added: [], removed: [] };

defineProps<{
  /** What its filter holds when it opens (`?q=`, from an untracked repository's or project's screen). */
  initialSearch?: string;
}>();

const tracking = useService(TrackingStore);
const approvals = useService(ApprovalRequests);
const trackedItems = useService(TrackedItems);

const now = useNow(TICK_MS);
const reading = ref(false);
/** Looked up by name and ticked: what saving tracks them from. */
const found = shallowRef<readonly (CandidateProject | CandidateRepository)[]>([]);
const stagedRepositories = shallowRef<StagedKeys>(NOTHING_STAGED);
const stagedProjects = shallowRef<StagedKeys>(NOTHING_STAGED);

const trackedNames = computed(() => tracking.repositories.map(repository => repository.nameWithOwner));
const trackedIds = computed(() => tracking.projects.map(project => project.id));

// The ticks: what is tracked, with the staged changes.
const repositories = computed({
  get: () => getTicks(trackedNames.value, stagedRepositories.value),
  set: ticks => {
    stagedRepositories.value = getStaged(trackedNames.value, ticks);
  },
});
const projects = computed({
  get: () => getTicks(trackedIds.value, stagedProjects.value),
  set: ticks => {
    stagedProjects.value = getStaged(trackedIds.value, ticks);
  },
});

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

const tracked = computed((): TrackedEntries => ({
  repositories: tracking.repositories.map(repository => ({
    nameWithOwner: repository.nameWithOwner,
    isPrivate: offeredPrivate.value.get(repository.nameWithOwner) ?? trackedItems.isPrivate(repository.nameWithOwner),
    status: getStatus({ kind: 'repository', nameWithOwner: repository.nameWithOwner }),
  })),
  projects: tracking.projects.map(project => ({
    id: project.id,
    title: project.title,
    owner: project.owner,
    status: getStatus({ kind: 'project', id: project.id }),
  })),
}));

// What is tracked changed meanwhile (another tab, the sidebar): a staged change it made true is no longer one.
watch(trackedNames, names => {
  stagedRepositories.value = pruneStaged(names, stagedRepositories.value);
});
watch(trackedIds, ids => {
  stagedProjects.value = pruneStaged(ids, stagedProjects.value);
});

onMounted(() => {
  void readCandidates();
});

async function readCandidates() {
  reading.value = true;
  try {
    await tracking.loadCandidates();
  } finally {
    reading.value = false;
  }
}

function getStatus(target: TrackedTarget): TrackedStatus {
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

  return { kind: 'read', at: state.lastSuccessAt, slower: state.refused !== null };
}

function addFound(candidate: CandidateProject | CandidateRepository) {
  found.value = [...found.value, candidate];
}

/** Saves the staged changes in one write, onto what is tracked by then. */
function save() {
  const added = getAdded();
  tracking.choose(current =>
    applyStagedChanges(current, {
      repositories: { added: added.repositories, removed: stagedRepositories.value.removed },
      projects: { added: added.projects, removed: stagedProjects.value.removed },
    }),
  );
  discard();
}

function discard() {
  stagedRepositories.value = NOTHING_STAGED;
  stagedProjects.value = NOTHING_STAGED;
}

/** The ticked ones that are not tracked, as they are tracked: from what GitHub offered, or what was looked up. */
function getAdded() {
  const candidates = tracking.candidates;
  const repositoriesByName = new Map<string, TrackedRepository>();
  const projectsById = new Map<string, TrackedProject>();
  for (const candidate of [
    ...(candidates ? [...getCandidateRepositories(candidates), ...getCandidateProjects(candidates)] : []),
    ...found.value,
  ]) {
    if ('nameWithOwner' in candidate) {
      repositoriesByName.set(candidate.nameWithOwner, toTrackedRepository(candidate));
    } else {
      projectsById.set(candidate.id, toTrackedProject(candidate));
    }
  }

  return {
    repositories: stagedRepositories.value.added.flatMap(name => repositoriesByName.get(name) ?? []),
    projects: stagedProjects.value.added.flatMap(id => projectsById.get(id) ?? []),
  };
}

function getTicks(trackedKeys: readonly string[], staged: StagedKeys) {
  const current = new Set(trackedKeys);
  const removed = new Set(staged.removed);
  return [...trackedKeys.filter(key => !removed.has(key)), ...staged.added.filter(key => !current.has(key))];
}

function getStaged(trackedKeys: readonly string[], ticks: readonly string[]): StagedKeys {
  const current = new Set(trackedKeys);
  const ticked = new Set(ticks);
  return {
    added: ticks.filter(key => !current.has(key)),
    removed: trackedKeys.filter(key => !ticked.has(key)),
  };
}

function pruneStaged(trackedKeys: readonly string[], staged: StagedKeys): StagedKeys {
  return getStaged(trackedKeys, getTicks(trackedKeys, staged));
}
</script>

<template>
  <!-- The section scrolls on its own under Settings' header, the bar of staged changes sticking to its bottom. -->
  <div :class="css.trackingSection">
    <TrackingChooser
      v-model:repositories="repositories"
      v-model:projects="projects"
      :tracked="tracked"
      :reading="reading"
      :initial-search="initialSearch"
      :candidates="tracking.candidates"
      :now="now"
      :found="found"
      :approvals="approvals.requests"
      :find="tracking.findCandidate"
      @save="save"
      @discard="discard"
      @load-more="tracking.loadMoreRepositories"
      @request-approval="approvals.record"
      @found="addFound"
    />
  </div>
</template>

<style lang="scss" module="css">
.trackingSection {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
