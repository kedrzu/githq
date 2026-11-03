<!-- `/owner/name/issues`, `/owner/name/pulls` and `/owner/name/commits`: a repository's view (J1–J3) at GitHub's addresses of its lists and its history, from the local copy, a section each (git-client D14), tracked or not; `/owner/name` opens the section it was left on, Issues the first time. Its items come with their projects' row fields (D12); each section's state, and its layout, grouping, order and properties shown — kept on this device for this repository — are its own. The pull requests of one stack in a group share an entry (`foldStacks`, D3), in the list and on the board. Moving an entry to another group on the board sets that value of each of its items through the edit engine — only where the user may; a stack's card sets it on each of its pull requests, an edit GitHub refuses undone for its own pull request alone. An untracked repository shows what concerns the user and points to Settings (J3), saying how many of its other items are open on GitHub — read on demand for it alone, never for a tracked one (CH37). Its Commits section is the commit graph (`CommitGraphView`), in any repository, tracked or not (git-client D11); there the item lists are neither built nor asked for. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { useCommands } from '@/commands/useCommands.js';
import CommitGraphView from '@/commits/CommitGraphView.vue';
import type { EditRequest } from '@/edits/EditTypes.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { foldStacks } from '@/lists/foldStacks.js';
import { NO_VALUE } from '@/lists/groupEntries.js';
import ItemContextMenu from '@/lists/ItemContextMenu.vue';
import SelectionActions from '@/lists/SelectionActions.vue';
import type { ListEntry, ListMove } from '@/lists/ListTypes.js';
import { useItemList } from '@/lists/useItemList.js';
import { ITEM_PROPERTIES } from '@/lists/ItemProperty.js';
import { ITEM_SORTS } from '@/lists/ItemSort.js';
import { useListViewOptions } from '@/lists/useListViewOptions.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { getProjectPath, getRepositoryPath, getRepositorySection } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { formatShortDate } from '@/utils/formatShortDate.js';

import type { RepositoryListTexts, RepositoryState } from './buildRepositoryList.js';
import { buildRepositoryList } from './buildRepositoryList.js';
import RepositoryContextMenu from './RepositoryContextMenu.vue';
import type { RepositoryProjectLink } from './RepositoryView.vue';
import RepositoryView from './RepositoryView.vue';
import * as l from './RepositoryView.loc.js';
import { getSectionItemKind, isItemSection } from './RepositorySection.js';
import type { RepositoryItemSection, RepositorySection } from './RepositorySection.js';
import { REPOSITORY_GROUPINGS, REPOSITORY_VIEW_DEFAULTS } from './repositoryViewOptions.js';
import { useRepositoryCommands } from './useRepositoryCommands.js';
import { LastRepositoryTab } from './LastRepositoryTab.js';

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
const repositoryCommands = useRepositoryCommands();
const tabs = useService(LastRepositoryTab);

/** Each section's state, kept while the page is. */
const states = ref<Record<RepositoryItemSection, RepositoryState>>({ issues: 'open', pullRequests: 'open' });

const owner = computed(() => (typeof route.params.owner === 'string' ? route.params.owner : ''));
const name = computed(() => (typeof route.params.name === 'string' ? route.params.name : ''));
const nameWithOwner = computed(() => `${owner.value}/${name.value}`);
const repositoryName = nameWithOwner.value;
/** The section the address names (`/owner/name/issues`); `null` at the repository's own address. */
const addressSection = computed(() => getRepositorySection(route.params.section));
/**
 * The section shown is the address's; at the repository's own address, typed or pasted, the one it was left on, Issues
 * the first time — shown at once, never redirected to. A tab replaces the address, keeping the query (an item opened
 * over the list) — the same page stays, with its selection.
 */
const section = computed({
  get: () => tabs.getShown(repositoryName, addressSection.value),
  set: (value: RepositorySection) => {
    void router.replace({ path: getRepositoryPath(nameWithOwner.value, value), query: route.query, hash: route.hash });
  },
});
/** The item section whose state and view options the page holds: the one shown; on Commits, which lists none, Issues. */
const listSection = computed((): RepositoryItemSection => (isItemSection(section.value) ? section.value : 'issues'));
const itemsShown = computed(() => isItemSection(section.value));
const state = computed({
  get: () => states.value[listSection.value],
  set: (value: RepositoryState) => {
    states.value = { ...states.value, [listSection.value]: value };
  },
});

// The section shown is remembered, so the links to this repository open it next time (`LastRepositoryTab.getPath`).
// Leaving, the address already names another repository or none, and this page's section is not theirs.
watch(
  addressSection,
  value => {
    if (value !== null && nameWithOwner.value === repositoryName) {
      tabs.remember(repositoryName, value);
    }
  },
  { immediate: true },
);

const view = useListViewOptions({
  list: () => `repository:${nameWithOwner.value}:${listSection.value}`,
  defaults: REPOSITORY_VIEW_DEFAULTS,
  choices: () => ({
    groupings: REPOSITORY_GROUPINGS[listSection.value],
    sorts: ITEM_SORTS,
    properties: ITEM_PROPERTIES,
  }),
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
    kind: getSectionItemKind(listSection.value),
    grouping: tracked.value ? view.options.grouping : 'none',
    sort: view.options.sort,
    texts: texts.value,
  }),
);
/** The list as shown: a stack's pull requests folded into its entries. */
const shownList = computed(() => {
  const built = repositoryList.value;
  return {
    ...built,
    groups: foldStacks({
      groups: built.groups,
      getPullRequest: item => (item.kind === 'pullRequest' ? item : null),
      stacks: groupStacks(repositoryItems.value),
      describe: stack => describeStack({ stack, viewerLogin: auth.viewer?.login ?? '', getItem: id => items.get(id) }),
    }),
  };
});
/** How many open items each section holds, for its tab. */
const openCounts = computed((): Record<RepositoryItemSection, number> => {
  const open = repositoryItems.value.filter(item => item.state === 'OPEN');
  return {
    issues: open.filter(item => item.kind === 'issue').length,
    pullRequests: open.filter(item => item.kind === 'pullRequest').length,
  };
});
/** Known not to be tracked once the user's choice is read: only then are GitHub's counts of its open items asked. */
const untracked = computed(() => tracking.loaded && !tracked.value);
/** Not tracked: how many open items each section holds on GitHub, as last read; `null` while not known. */
const gitHubOpenCounts = computed((): Record<RepositoryItemSection, number> | null => {
  const counts = untracked.value ? repositories.getOpenCounts(nameWithOwner.value) : undefined;
  return counts ? { issues: counts.issues, pullRequests: counts.pullRequests } : null;
});
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

// The repository's page on GitHub is in the command menu too, named, as the screen is about it.
useCommands(() => [{ ...repositoryCommands(nameWithOwner.value).openOnGitHub, detail: nameWithOwner.value }]);

// What the user may set here (labels, milestones, people) is read with the repository's permission; not tracked,
// GitHub's counts of its open items, for the lines saying how many githq does not have. Neither on Commits, which asks
// GitHub only through its graph's store.
watch(
  [nameWithOwner, tracked, untracked, itemsShown],
  ([repository, isTracked, isUntracked, listed]) => {
    if (!listed) {
      return;
    }

    if (isTracked) {
      void repositories.ensure(repository);
    } else if (isUntracked) {
      void repositories.ensureOpenCounts(repository);
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
    case 'none':
      return false;
    default:
      return assertNever(grouping);
  }
}

function move({ ids, from, to }: ListMove) {
  const request = getMoveRequest(from, to);
  if (request) {
    void editor.edit(ids, request);
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
    case 'none':
      return null;
    default:
      return assertNever(grouping);
  }
}
</script>

<template>
  <RepositoryView
    v-if="auth.viewer"
    v-model:state="state"
    v-model:section="section"
    v-model:selected-id="list.selectedId"
    v-model:checked-ids="list.checkedIds"
    :options="view.options"
    :modified="view.modified"
    :name-with-owner="nameWithOwner"
    :is-private="isPrivate"
    :tracked="tracked"
    :list="itemsShown ? shownList : null"
    :open-counts="openCounts"
    :git-hub-open-counts="gitHubOpenCounts"
    :projects="itemsShown ? projectLinks.links : []"
    :without-project="itemsShown ? projectLinks.withoutProject : 0"
    :viewer-login="auth.viewer.login"
    :now="list.now"
    :opened-id="list.openedId"
    :undone="list.undone"
    :can-move="canMove"
    @update:options="view.set($event)"
    @reset="view.reset()"
    @open="list.open"
    @listed="list.setListed"
    @move="move"
  >
    <template #menu>
      <RepositoryContextMenu :name-with-owner="nameWithOwner" />
    </template>
    <template #selection="{ ids, span }">
      <SelectionActions
        :ids="ids"
        :span="span"
        @clear="list.checkedIds = []"
      />
    </template>
    <template #contextMenu="menu">
      <ItemContextMenu
        :ids="menu.ids"
        @open="menu.open"
      />
    </template>
    <template #commits>
      <CommitGraphView :name-with-owner="nameWithOwner" />
    </template>
  </RepositoryView>
</template>
