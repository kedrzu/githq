<!-- `/owner/name/issues`, `/owner/name/pulls` and `/owner/name/commits`: a repository's view (J1, J2, J5–J7) at GitHub's addresses of its lists and its history, a section each (git-client D14), tracked or not; `/owner/name/actions` a tracked one's workflows (actions W3a, `RepositoryWorkflowsTab`), which the route guard hands off to GitHub for any other; `/owner/name` opens the section it was left on, Issues the first time. Its items come from the item store with their projects' row fields (D12); each section's state, and its layout, grouping, order and properties shown — kept on this device for this repository — are its own, tracked or not. The pull requests of one stack in a group share an entry (`foldStacks`, D3), in the list and on the board. Moving an entry to another group on the board sets that value of each of its items through the edit engine — only where the user may; a stack's card sets it on each of its pull requests, an edit GitHub refuses undone for its own pull request alone. Tracked, a section whose state its download has not read yet, with nothing listed, stands as still arriving — ghost rows, on the board ghost columns — never as nothing there (first run and loading D5, ES14, ES15, ES29). What stands in the way — tracked, what its sync says of it; not tracked, of the section and state read on demand — is told once the kept copy is loaded, so a copy still loading never reads as offline (`cantBeRead`, D6, D12, ES16, ES17). The page holds the repository for its whole life, under each account signed in, so that untracking it here leaves the rows on screen, and while it is known not to be tracked and an item section is shown, has that section read on demand and page by page (`BrowsedRepositories`, D34); GitHub's own name for it replaces the address. The command menu's group of the repository (`AppCommands`) offers tracking it while it is not; its title's and the sidebar's menus no longer tracking it while it is, the rows staying on screen either way (D34). Its Commits section is the commit graph (`CommitGraphView`), in any repository, tracked or not (git-client D11); there the item lists are neither built nor asked for. The sections' layout, tabs or a column of the repository's own, is the user's setting (git-client D14); it is known before the page renders, as the route guard waits for the kept settings. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { AuthStore } from '@/auth/AuthStore.js';
import CommitGraphView from '@/commits/CommitGraphView.vue';
import type { CantBeReadCause } from '@/components/CantBeReadCause.js';
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
import { BrowsedRepositories } from '@/repos/BrowsedRepositories.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { getGitHubUrl, getProjectPath, getRepositoryPath, getRepositorySection } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { formatShortDate } from '@/utils/formatShortDate.js';
import { getCantBeReadCause } from '@/utils/getCantBeReadCause.js';
import { buildRepositoryWorkflows } from '@/workflows/buildRepositoryWorkflows.js';
import RepositoryWorkflowsHints from '@/workflows/RepositoryWorkflowsHints.vue';
import RepositoryWorkflowsTab from '@/workflows/RepositoryWorkflowsTab.vue';
import { WorkflowStore } from '@/workflows/WorkflowStore.js';
import { WorkflowTabPlaces } from '@/workflows/WorkflowTabPlaces.js';

import type { RepositoryListTexts, RepositoryState } from './buildRepositoryList.js';
import { buildRepositoryList } from './buildRepositoryList.js';
import { isRepositoryStateArriving } from './isRepositoryStateArriving.js';
import RepositoryContextMenu from './RepositoryContextMenu.vue';
import type { RepositoryProjectLink } from './RepositoryView.vue';
import RepositoryView from './RepositoryView.vue';
import * as l from './RepositoryView.loc.js';
import { getSectionItemKind, isItemSection } from './RepositorySection.js';
import type { RepositoryItemSection, RepositorySection } from './RepositorySection.js';
import { REPOSITORY_GROUPINGS, REPOSITORY_VIEW_DEFAULTS } from './repositoryViewOptions.js';
import { LastRepositoryTab } from './LastRepositoryTab.js';

const auth = useService(AuthStore);
const accounts = useService(AccountSession);
const items = useService(ItemStore);
const projects = useService(ProjectStore);
const tracking = useService(TrackingStore);
const repositories = useService(RepositoryStore);
const browsed = useService(BrowsedRepositories);
const workflows = useService(WorkflowStore);
const editor = useService(ItemEditor);
const sync = useService(SyncEngine);
const route = useRoute();
const router = useRouter();
const t = useTranslate();
const list = useItemList();
const tabs = useService(LastRepositoryTab);
const workflowPlaces = useService(WorkflowTabPlaces);
const graphView = useTemplateRef<InstanceType<typeof CommitGraphView>>('graphView');

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

/** The workflow unfolded in the Workflows section (actions W3b), which the toolbar's key hints follow; `null` with none. */
const unfoldedWorkflow = computed({
  get: () => workflowPlaces.get(repositoryName).unfolded,
  set: (unfolded: string | null) => workflowPlaces.update(repositoryName, { unfolded }),
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
/**
 * The repository while its section on screen is read on demand: known not to be tracked once the user's choice is read,
 * with an item section shown. Leaving, the address already names another repository or none, which is not this page's.
 */
const browsedName = computed(() =>
  tracking.loaded && !tracked.value && itemsShown.value && nameWithOwner.value === repositoryName
    ? repositoryName
    : null,
);
/** How the reading of the section and state shown stands; `null` while nothing is read on demand. */
const status = computed(() =>
  browsedName.value === null ? null : browsed.getStatus(browsedName.value, listSection.value, state.value),
);
/** Why what the section lacks can't arrive now; `null` when nothing stands in its way. */
const cantBeRead = computed((): CantBeReadCause | null => {
  if (!itemsShown.value || !items.loaded || !tracking.loaded) {
    return null;
  }

  const url = getGitHubUrl(getRepositoryPath(nameWithOwner.value));
  if (browsedName.value !== null) {
    const shown = browsedName.value;
    const shownSection = listSection.value;
    return getCantBeReadCause({
      freshness: browsed.getFreshness(shown, shownSection, state.value),
      retry: () => browsed.readNow(shown, shownSection),
      url,
    });
  }

  return tracking.getSyncState({ kind: 'repository', nameWithOwner: nameWithOwner.value })?.hidden
    ? { kind: 'hidden', url }
    : getCantBeReadCause({
        freshness: sync.getRepositoryFreshness(nameWithOwner.value),
        retry: () => sync.pollTrackedNow(),
        url,
      });
});
const repositoryList = computed(() =>
  buildRepositoryList({
    items: repositoryItems.value,
    state: state.value,
    kind: getSectionItemKind(listSection.value),
    grouping: view.options.grouping,
    sort: view.options.sort,
    texts: texts.value,
    // Nothing else says what a repository not tracked holds until GitHub has answered, nor a tracked one until its
    // download has read the state shown (first run and loading D5).
    arriving: tracked.value
      ? isRepositoryStateArriving(
          tracking.getSyncState({ kind: 'repository', nameWithOwner: nameWithOwner.value }),
          getSectionItemKind(listSection.value),
          state.value,
        )
      : (status.value?.total ?? null) === null,
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
/** Its Workflows section (actions W3a), and the tab's count. */
const workflowList = computed(() =>
  buildRepositoryWorkflows({
    stored: workflows.get(nameWithOwner.value),
    settings: workflows.getRefSettings(nameWithOwner.value),
    now: list.now,
  }),
);
/**
 * How many open items each section holds, for its tab; `null` while its download has yet to read them, as a partial total
 * would read as the whole, and with none held of one GitHub hides, as nothing would read as nothing there (first run and
 * loading D4, D6, D14).
 */
const openCounts = computed((): Record<RepositoryItemSection, number | null> => {
  const open = repositoryItems.value.filter(item => item.state === 'OPEN');
  const syncState = tracking.getSyncState({ kind: 'repository', nameWithOwner: nameWithOwner.value });
  return { issues: countOf('issue'), pullRequests: countOf('pullRequest') };

  function countOf(kind: Item['kind']) {
    const count = open.filter(item => item.kind === kind).length;
    return isRepositoryStateArriving(syncState, kind, 'open') || (syncState?.hidden && count === 0) ? null : count;
  }
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

// No longer tracked, here or elsewhere, its Workflows section goes (actions D4): its other sections stay on screen.
watch(
  () => section.value === 'workflows' && nameWithOwner.value === repositoryName && tracking.loaded && !tracked.value,
  leave => {
    if (leave) {
      section.value = 'issues';
    }
  },
);

// Tracked too, so that untracking it from here leaves its rows on screen. Before the section is shown: a first hold
// starts it afresh. An account's holds end with it, and the page stays through a switch: the next account takes its own.
watch(
  () => accounts.current,
  (account, _previous, onCleanup) => {
    if (account) {
      onCleanup(browsed.hold(repositoryName));
    }
  },
  { immediate: true },
);

// What the user may set here (labels, milestones, people) is read with the repository's permission. Not on Commits,
// which asks GitHub only through its graph's store, and for a repository only browsed, not from a hidden tab nor once
// GitHub has said it does not show it (D34).
watch(
  () =>
    itemsShown.value &&
    nameWithOwner.value === repositoryName &&
    ((browsed.isTabVisible() && status.value?.notShown !== true) || (tracking.loaded && tracked.value)),
  asks => {
    if (asks) {
      void repositories.ensure(repositoryName);
    }
  },
  { immediate: true },
);

watch(
  [browsedName, listSection, state],
  ([repository, shownSection, shownState], _previous, onCleanup) => {
    if (repository !== null) {
      onCleanup(browsed.show({ nameWithOwner: repository, section: shownSection, state: shownState }));
    }
  },
  { immediate: true },
);

// GitHub's own name for it (another case, a rename), at the same section: the page under it goes on with what was read.
watch(
  () => status.value?.settledName ?? null,
  settled => {
    if (settled !== null) {
      void router.replace({
        path: getRepositoryPath(settled, addressSection.value ?? undefined),
        query: route.query,
        hash: route.hash,
      });
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

function readMore() {
  if (browsedName.value !== null) {
    void browsed.loadMore(browsedName.value, listSection.value, state.value);
  }
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
    :status="status"
    :cant-be-read="cantBeRead"
    :projects="itemsShown ? projectLinks.links : []"
    :without-project="itemsShown ? projectLinks.withoutProject : 0"
    :viewer-login="auth.viewer.login"
    :now="list.now"
    :opened-id="list.openedId"
    :is-edited="list.isEdited"
    :undone="list.undone"
    :can-move="canMove"
    :workflow-count="tracked ? workflowList.count : null"
    :layout="tracking.repositoryLayout"
    @update:options="view.set($event)"
    @reset="view.reset()"
    @open="list.open"
    @listed="list.setListed"
    @move="move"
    @read-more="readMore"
    @open-ref-list="graphView?.openRefList()"
  >
    <template #workflows>
      <RepositoryWorkflowsTab
        v-model:unfolded="unfoldedWorkflow"
        :name-with-owner="nameWithOwner"
        :list="workflowList"
        :now="list.now"
      />
    </template>
    <template #workflowsHints>
      <RepositoryWorkflowsHints
        v-if="workflowList.groups.length > 0"
        :unfolded="unfoldedWorkflow !== null"
      />
    </template>
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
        :merge="menu.merge"
        @open="menu.open"
      />
    </template>
    <template #commits="{ refListInColumn }">
      <CommitGraphView
        ref="graphView"
        :name-with-owner="nameWithOwner"
        :ref-list-in-column="refListInColumn"
      />
    </template>
  </RepositoryView>
</template>
