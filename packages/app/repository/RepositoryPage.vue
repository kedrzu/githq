<!-- `/owner/name`: a repository's view (J1–J3) at GitHub's address of it, from the local copy; `/owner/name/issues` and `/owner/name/pulls` list one kind of its items, tracked or not. Its items come with their projects' row fields (D12); the layout, grouping, order and properties shown are kept on this device for this repository. Moving an item to another group on the board sets that value through the edit engine — only where the user may. An untracked repository offers to track it; its copy then arrives in place. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { NO_VALUE } from '@/lists/groupEntries.js';
import SelectionActions from '@/lists/SelectionActions.vue';
import type { ListEntry, ListMove } from '@/lists/ListTypes.js';
import { useItemList } from '@/lists/useItemList.js';
import { useListViewOptions } from '@/lists/useListViewOptions.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { getProjectPath, getRepositoryKind, getRepositoryPath } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { formatShortDate } from '@/utils/formatShortDate.js';

import type { RepositoryKind, RepositoryListTexts, RepositoryState } from './buildRepositoryList.js';
import { buildRepositoryList } from './buildRepositoryList.js';
import type { RepositoryProjectLink } from './RepositoryView.vue';
import RepositoryView from './RepositoryView.vue';
import * as l from './RepositoryView.loc.js';
import { REPOSITORY_VIEW_CHOICES, REPOSITORY_VIEW_DEFAULTS } from './repositoryViewOptions.js';

const auth = useService(AuthStore);
const items = useService(ItemStore);
const projects = useService(ProjectStore);
const tracking = useService(TrackingStore);
const repositories = useService(RepositoryStore);
const editor = useService(ItemEditor);
const route = useRoute();
const router = useRouter();
const t = useTranslate();
const list = useItemList();

const state = ref<RepositoryState>('open');
const notFound = ref(false);
const trackBusy = ref(false);

const owner = computed(() => (typeof route.params.owner === 'string' ? route.params.owner : ''));
const name = computed(() => (typeof route.params.name === 'string' ? route.params.name : ''));
const nameWithOwner = computed(() => `${owner.value}/${name.value}`);
/**
 * The kind of items listed is the address's (`/owner/name/issues`); a tab replaces it, keeping the query (an item
 * opened over the list) — the same page stays, with its selection and view options.
 */
const kind = computed({
  get: () => getRepositoryKind(route.params.kind),
  set: (value: RepositoryKind) => {
    void router.replace({ path: getRepositoryPath(nameWithOwner.value, value), query: route.query, hash: route.hash });
  },
});
const view = useListViewOptions({
  list: () => `repository:${nameWithOwner.value}`,
  defaults: REPOSITORY_VIEW_DEFAULTS,
  choices: REPOSITORY_VIEW_CHOICES,
});
const tracked = computed(() => tracking.isTracked({ kind: 'repository', nameWithOwner: nameWithOwner.value }));
// D12: each row's projects as my work shows them — the tracked ones first, with their row field.
const repositoryItems = computed(() =>
  items.all
    .filter(item => item.repository.nameWithOwner === nameWithOwner.value)
    .map(item => projects.withRowFields(item)),
);
const texts = computed((): RepositoryListTexts => ({
  all: t(l.allItems),
  noMilestone: t(l.noMilestone),
  noLabel: t(l.noLabel),
  unassigned: t(l.unassigned),
  noType: t(l.noType),
  issues: t(l.issues),
  pullRequests: t(l.pullRequests),
  milestoneDetail: ({ closed, total, dueOn }) => {
    const progress = t(l.milestoneProgress, { closed, total });
    return dueOn ? t(l.milestoneDue, { progress, date: formatShortDate(Date.parse(dueOn)) }) : progress;
  },
}));
const repositoryList = computed(() =>
  buildRepositoryList({
    items: repositoryItems.value,
    // Not tracked, the copy holds what concerns the user — open items of my work; nothing else is offered.
    state: tracked.value ? state.value : 'open',
    kind: kind.value,
    grouping: tracked.value ? view.options.grouping : 'none',
    sort: view.options.sort,
    texts: texts.value,
  }),
);
const openCount = computed(() => repositoryItems.value.filter(item => item.state === 'OPEN').length);
const isPrivate = computed(() => repositoryItems.value[0]?.repository.isPrivate ?? null);
/** The projects the listed items live in, each with how many of them; tracked ones open in githq. */
const projectLinks = computed(() => {
  const links = new Map<string, RepositoryProjectLink>();
  let withoutProject = 0;
  for (const item of listedItems()) {
    if (item.projects.length === 0) {
      withoutProject++;
    }

    for (const place of item.projects) {
      const known = links.get(place.projectId);
      if (known) {
        links.set(place.projectId, { ...known, count: known.count + 1 });
        continue;
      }

      const project = tracking.projects.find(candidate => candidate.id === place.projectId);
      links.set(place.projectId, {
        id: place.projectId,
        title: place.title,
        count: 1,
        to: project ? getProjectPath(project) : place.url,
        external: !project,
      });
    }
  }

  return { links: [...links.values()], withoutProject };
});

// What the user may set here (labels, milestones, people) is read with the repository's permission.
watch(
  [nameWithOwner, tracked],
  ([repository, isTracked]) => {
    notFound.value = false;
    if (isTracked) {
      void repositories.ensure(repository);
    }
  },
  { immediate: true },
);

function listedItems() {
  const seen = new Map<string, Item>();
  for (const group of repositoryList.value.groups) {
    for (const row of group.rows) {
      seen.set(row.id, row.value);
    }
  }

  return seen.values();
}

function canMove(entry: ListEntry<Item>, from: string, to: string) {
  const item = entry.value;
  const permissions = editor.getPermissions(item);
  const grouping = view.options.grouping;
  switch (grouping) {
    case 'milestone':
      return permissions.milestone;
    case 'label':
      return permissions.labels && !item.labels.some(label => label.name === to && to !== from);
    case 'assignee':
      return permissions.assignees && !item.assignees.some(user => user.login === to && to !== from);
    case 'issueType':
      return item.kind === 'issue' && permissions.issueType;
    case 'kind':
    case 'none':
      return false;
    default:
      return assertNever(grouping);
  }
}

function move({ id, from, to }: ListMove) {
  const request = getMoveRequest(from, to);
  if (request) {
    void editor.edit([id], request);
  }
}

function getMoveRequest(from: string, to: string): EditRequest | null {
  const grouping = view.options.grouping;
  switch (grouping) {
    case 'milestone':
      return { kind: 'milestone', title: to === NO_VALUE ? null : to };
    case 'label':
      return { kind: 'labels', add: to === NO_VALUE ? [] : [to], remove: from === NO_VALUE ? [] : [from] };
    case 'assignee':
      return { kind: 'assignees', add: to === NO_VALUE ? [] : [to], remove: from === NO_VALUE ? [] : [from] };
    case 'issueType':
      return { kind: 'issueType', name: to === NO_VALUE ? null : to };
    case 'kind':
    case 'none':
      return null;
    default:
      return assertNever(grouping);
  }
}

async function track() {
  trackBusy.value = true;
  try {
    const found = await tracking.findCandidate({ kind: 'repository', owner: owner.value, name: name.value });
    if (found && 'nameWithOwner' in found) {
      tracking.track({ repository: { nameWithOwner: found.nameWithOwner, id: found.id } });
    } else {
      notFound.value = true;
    }
  } finally {
    trackBusy.value = false;
  }
}
</script>

<template>
  <RepositoryView
    v-if="auth.viewer"
    v-model:state="state"
    v-model:kind="kind"
    v-model:selected-id="list.selectedId"
    v-model:checked-ids="list.checkedIds"
    :options="view.options"
    :modified="view.modified"
    :name-with-owner="nameWithOwner"
    :is-private="isPrivate"
    :tracked="tracked"
    :list="repositoryList"
    :open-count="openCount"
    :projects="projectLinks.links"
    :without-project="projectLinks.withoutProject"
    :viewer-login="auth.viewer.login"
    :now="list.now"
    :opened-id="list.openedId"
    :undone="list.undone"
    :can-move="canMove"
    :not-found="notFound"
    :track-busy="trackBusy"
    @update:options="view.set($event)"
    @reset="view.reset()"
    @open="list.open"
    @listed="list.setListed"
    @move="move"
    @track="track"
  >
    <template #selection="{ ids }">
      <SelectionActions
        :ids="ids"
        @clear="list.checkedIds = []"
      />
    </template>
  </RepositoryView>
</template>
