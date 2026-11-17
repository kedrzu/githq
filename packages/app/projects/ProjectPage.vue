<!-- `/orgs/<login>/projects/<n>[/views/<v>]`, `/users/<login>/projects/<n>[/views/<v>]`: a tracked project's view at GitHub's addresses of it, from the local copy (D4, D13). The saved view named by the address — else the first — gives the filter, evaluated here (or answered by GitHub, K6), and the layout, grouping, order and fields; what the user changes of them is kept on this device per view. Field edits from the view — moving a card, `⇧←`/`⇧→` — and draft issues go through the edit engine, only where the user may update the project (D14). The pull requests of one stack in a group share an entry (`foldStacks`, D3), in the list and on the board — under the view's filter all of them where any matches, the others de-emphasised (`withStackMembers`, SP25); moving a stack's card sets the field of each of its pull requests, one edit GitHub refuses undone for its own pull request alone. A tracked project stands as still arriving until its first download has read all its items: before the project itself is in — its fields, views and so its layout come with its first page of items — its title over a screen of ghost rows, then its view, ghosts where nothing is in yet (`ProjectView`, first run and loading D5, ES18, ES30). What stands in the way of that — GitHub not showing it, offline, paused, GitHub failing — is told once the kept copy is loaded (`cantBeRead`, D6, D12, ES20), in place of the ghosts. One not tracked shows what concerns the user and points to Settings (J4). On a phone every state has the phone's top bar with the project's name (mobile D14), the view's its options too (`ListToolbar`), and a board view keeps its columns as its grouping while drawn as a list (mobile D9). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { Plus } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { bindCommand } from '@/commands/bindCommand.js';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import type { CommandOption } from '@/commands/CommandTypes.js';
import { newIssueInProject } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import CantBeRead from '@/components/CantBeRead.vue';
import type { CantBeReadCause } from '@/components/CantBeReadCause.js';
import StillArriving from '@/components/StillArriving.vue';
import type { DraftIssueFieldInput } from '@/edits/ItemEditor.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import type { ProjectFieldInput } from '@/edits/EditTypes.js';
import { formatShortReference } from '@/item/itemRoutes.js';
import { getItemComparator } from '@/lists/getItemComparator.js';
import { countListRows } from '@/lists/countListRows.js';
import { NO_VALUE } from '@/lists/groupEntries.js';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import type { ListChoice, ListEntry, ListMove } from '@/lists/ListTypes.js';
import { ListViewOptionsStore } from '@/lists/ListViewOptionsStore.js';
import ItemContextMenu from '@/lists/ItemContextMenu.vue';
import SelectionActions from '@/lists/SelectionActions.vue';
import { useItemList } from '@/lists/useItemList.js';
import { useListViewOptions } from '@/lists/useListViewOptions.js';
import { useShownLayout } from '@/lists/useShownLayout.js';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import PhoneTopBar from '@/shell/PhoneTopBar.vue';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import { getSettingsPath } from '@/settings/settingsRoutes.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { ProjectField, ProjectIteration } from '@/store/ItemDetailTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import type { ProjectAddress } from '@/tracking/trackingRoutes.js';
import { getProjectPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import UntrackedView from '@/tracking/UntrackedView.vue';
import { haveOpenItemsArrived } from '@/tracking/utils/haveOpenItemsArrived.js';
import { formatShortDate } from '@/utils/formatShortDate.js';
import { getCantBeReadCause } from '@/utils/getCantBeReadCause.js';

import type { ProjectListTexts } from './buildProjectList.js';
import { buildProjectList, getProjectEntryId } from './buildProjectList.js';
import { compileProjectFilter } from './filter/compileProjectFilter.js';
import type { CompiledProjectFilter } from './filter/compileProjectFilter.js';
import { foldProjectGroups } from './foldProjectGroups.js';
import { getProjectViewTabs } from './getProjectViewTabs.js';
import type { ProjectFilterContext } from './getProjectViewTabs.js';
import * as l from './ProjectPage.loc.js';
import ProjectDraftDialog from './ProjectDraftDialog.vue';
import { ProjectStore } from './ProjectStore.js';
import type { Project, ProjectEntry, ProjectView as SavedView } from './ProjectTypes.js';
import ProjectContextMenu from './ProjectContextMenu.vue';
import ProjectView from './ProjectView.vue';
import type { ProjectTab } from './ProjectView.vue';
import { ProjectViewAnswers } from './ProjectViewAnswers.js';
import type { ProjectGrouping, ProjectSortKey, ProjectViewOptions } from './projectViewOptions.js';
import {
  ALL_ITEMS_LIST,
  getColumnGrouping,
  getGroupingField,
  getProjectViewChoices,
  getProjectViewDefaults,
  getProjectViewListKey,
  isColumnGrouping,
  MANUAL_SORT,
  parseProjectSort,
} from './projectViewOptions.js';
import { selectProjectEntries } from './selectProjectEntries.js';
import { useProjectCommands } from './useProjectCommands.js';

/** "Add existing issues…": its submenu opens from the empty project too (K8). */
const ADD_ITEMS_COMMAND = 'project.addItems';

/** What a project without saved views is shown as. */
const NO_VIEW_OPTIONS: ProjectViewOptions = {
  layout: 'list',
  grouping: 'none',
  sort: MANUAL_SORT,
  properties: [],
  filter: '',
};
/** What the rows of a project not tracked show: it has no saved view or row field of its own to say (J4). */
const UNTRACKED_PROPERTIES: readonly ItemProperty[] = ['status', 'size', 'labels', 'people', 'updated'];

const auth = useService(AuthStore);
const tracking = useService(TrackingStore);
const projects = useService(ProjectStore);
const items = useService(ItemStore);
const editor = useService(ItemEditor);
const answers = useService(ProjectViewAnswers);
const listViewOptions = useService(ListViewOptionsStore);
const composer = useService(NewIssueComposer);
const registry = useService(CommandRegistry);
const sync = useService(SyncEngine);
const phone = useService(PhoneLayout);
const route = useRoute();
const t = useTranslate();
const projectCommands = useProjectCommands();

const openedDraftId = shallowRef<string | null>(null);

const owner = computed(() => (typeof route.params.owner === 'string' ? route.params.owner : ''));
const number = computed(() => Number(route.params.number));
const address = computed((): ProjectAddress => ({
  owner: owner.value,
  ownerKind: route.path.startsWith('/orgs/') ? 'org' : 'user',
  number: number.value,
}));
const githubUrl = computed(() => `${GITHUB_ORIGIN}${getProjectPath(address.value)}`);
const viewNumber = computed(() => (typeof route.params.view === 'string' ? Number(route.params.view) : null));
/** "Show all items" (K9): the project's items with no saved view's filter, shown as the saved view is otherwise. */
const showAll = computed(() => route.query.all !== undefined);
const tracked = computed(() =>
  tracking.projects.find(candidate => candidate.owner === owner.value && candidate.number === number.value),
);
const project = computed((): Project | null => (tracked.value ? (projects.get(tracked.value.id) ?? null) : null));
/** Its first download has not read all its items yet, and GitHub shows it: what is missing is still on its way (D5). */
const arriving = computed(() => {
  const state = tracked.value ? tracking.getSyncState({ kind: 'project', id: tracked.value.id }) : undefined;
  return tracked.value !== undefined && !state?.hidden && !haveOpenItemsArrived(state);
});
/** Why what the project lacks can't arrive now; `null` when nothing stands in its way. */
const cantBeRead = computed((): CantBeReadCause | null => {
  if (!tracked.value || !projects.loaded || !items.loaded) {
    return null;
  }

  const { id } = tracked.value;
  return getCantBeReadCause({
    freshness: sync.getProjectFreshness(id),
    retry: () => sync.pollNow(sync.getProjectLoop(id)),
    url: githubUrl.value,
  });
});
/** Not tracked, the copy holds what concerns the user: the open items of my work that say they are in it (J4). */
const concerning = computed(() => {
  if (tracked.value) {
    return [];
  }

  return items.all
    .filter(item => item.state === 'OPEN' && item.projects.some(isThisProject))
    .map(item => projects.withRowFields(item))
    .toSorted(getItemComparator('updated'));
});

// In a project, a new issue is added to it (H5), on its own `C`: the app's "New issue" has no key (commands D7). Items
// already on GitHub are added from the local copy, several in a row (K8).
useCommands(() =>
  project.value?.viewerCanUpdate
    ? [
        bindCommand(
          newIssueInProject,
          {
            section: 'view',
            title: t(l.newIssueInProject, { project: project.value.title }),
            run: () => startNewIssue(null, null),
          },
          t,
        ),
        {
          id: ADD_ITEMS_COMMAND,
          title: t(l.addItemsToProject, { project: project.value.title }),
          section: 'view',
          icon: Plus,
          options: () => ({ options: addableItems.value, several: true }),
        },
      ]
    : [],
);
// The project's page on GitHub is in the command menu too, named, as the screen is about it.
useCommands(() => [
  {
    ...projectCommands({ ...address.value, id: tracked.value?.id ?? null }).openOnGitHub,
    detail: tracked.value?.title ?? `${owner.value}#${number.value}`,
  },
]);
/**
 * Going to each saved view, as the command menu's level under the project: run by their keys `1`–`9` while the project is
 * on screen (`ProjectView` registers them), and the phone's menu of the views (mobile D17).
 */
const viewCommands = computed(() => projectCommands({ ...address.value, id: tracked.value?.id ?? null }).savedViews);
const view = computed((): SavedView | null => {
  const views = project.value?.views ?? [];
  return views.find(candidate => candidate.number === viewNumber.value) ?? views[0] ?? null;
});
// Back on an item opened from here names the view shown, as its tab does, or the project (mobile D20).
const list = useItemList(() => (showAll.value ? t(l.allItems) : (view.value?.name ?? tracked.value?.title ?? '')));
const defaults = computed(() => {
  const saved =
    project.value && view.value
      ? getProjectViewDefaults(project.value, view.value)
      : { options: NO_VIEW_OPTIONS, roadmap: false };
  return showAll.value ? { ...saved, options: { ...saved.options, filter: '' } } : saved;
});
const options = useListViewOptions({
  list: () => getProjectViewListKey(project.value?.id ?? '', showAll.value ? ALL_ITEMS_LIST : (view.value?.id ?? '')),
  defaults: () => defaults.value.options,
  choices: () =>
    project.value
      ? getProjectViewChoices(project.value, defaults.value.options)
      : { groupings: [], sorts: [], properties: [] },
});
/**
 * On the board the grouping is the columns: a single select or iteration field — on a phone too, where the board kept
 * is drawn as a list grouped by its columns (mobile D9).
 */
const grouping = computed((): ProjectGrouping => {
  const chosen = options.options.grouping;
  if (options.options.layout !== 'board' || !project.value || isColumnGrouping(project.value, chosen)) {
    return chosen;
  }

  return getColumnGrouping(project.value, view.value) ?? 'none';
});
const shownOptions = computed((): ProjectViewOptions => ({ ...options.options, grouping: grouping.value }));
const layout = useShownLayout(() => options.options.layout);
const today = computed(() => new Date(list.now).toISOString().slice(0, 10));
/** The project's entries as shown: items with their issue's or pull request's row, and drafts. */
const entries = computed((): ProjectEntry[] => {
  if (!project.value) {
    return [];
  }

  return projects.getItems(project.value.id).flatMap(item => {
    const content = item.contentId === null ? null : (items.get(item.contentId) ?? null);
    return content || item.draft ? [{ item, content }] : [];
  });
});
// One array until they change: the menu finds in it per keystroke, and it readies an array once (`filterOptions`).
const addableItems = computed((): CommandOption[] => {
  const current = project.value;
  if (!current) {
    return [];
  }

  const added = new Set(entries.value.map(entry => entry.item.contentId));
  return items.all
    .filter(item => !added.has(item.id) && !isPendingItem(item))
    .toSorted((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map(item => ({
      value: item.id,
      label: item.title,
      detail: formatShortReference(item),
      pick: () => void editor.edit([item.id], { kind: 'addToProject', project: current }),
    }));
});
/** The filter applied: the saved view's, unless cleared here or all items are shown. */
const filter = computed(() => options.options.filter ?? '');
/** What the project's filters are compiled with besides their text and its fields. */
const filterContext = computed((): ProjectFilterContext => ({
  viewerLogin: auth.viewer?.login ?? '',
  today: today.value,
  hasDrafts: entries.value.some(entry => entry.item.draft !== null),
  hasDraftPullRequests: entries.value.some(entry => entry.content?.kind === 'pullRequest' && entry.content.isDraft),
}));
const compiled = computed(() => compileFilter(project.value?.fields ?? [], filter.value));
const answered = computed(() => {
  const evaluated = compiled.value;
  return evaluated.kind === 'github' && project.value && filter.value
    ? { projectId: project.value.id, filter: filter.value, term: evaluated.term }
    : null;
});
const selected = computed(() => selectView(compiled.value, filter.value));
const stacks = computed(() => groupStacks(items.all));
const texts = computed((): ProjectListTexts => ({
  all: t(l.allItems),
  noValue: field => t(l.noValue, { field }),
  unassigned: t(l.unassigned),
  noMilestone: t(l.noMilestone),
  drafts: t(l.drafts),
  iterationDetail: (iteration, current) => {
    const range = formatIteration(iteration);
    return current ? t(l.iterationCurrent, { range }) : range;
  },
}));
const groups = computed(() => {
  const current = project.value;
  return current && selected.value ? foldGroups(current, selected.value, grouping.value) : null;
});
const itemCount = computed(() => entries.value.filter(entry => !entry.item.isArchived).length);
// The tab shown follows its options; the others by what this device keeps of them.
const tabs = computed((): ProjectTab[] =>
  project.value
    ? getProjectViewTabs({
        project: project.value,
        shownKey: showAll.value ? ALL_ITEMS_LIST : (view.value?.id ?? null),
        shownState: { modified: options.modified, answered: answered.value !== null },
        allItems: { name: t(l.allItems), to: { path: route.path, query: { all: null } } },
        isKept: key => listViewOptions.has(key),
        filterContext: filterContext.value,
      })
    : [],
);
/** "Show all items" where a filter keeps some out (K9): this view's options, no filter. */
const allItemsTo = computed(() => (!showAll.value && filter.value ? { path: route.path, query: { all: null } } : null));
const sorts = computed((): ListChoice[] => {
  const current = project.value;
  if (!current) {
    return [];
  }

  return getProjectViewChoices(current, defaults.value.options).sorts.map((sort): ListChoice => {
    const levels = parseProjectSort(current, sort);
    const level = levels.length === 1 ? levels[0] : undefined;
    return {
      value: sort,
      label: describeSort(current, sort),
      ...(level && {
        sortDirection: { key: level.key, keyLabel: describeSortKey(current, level.key), direction: level.direction },
      }),
    };
  });
});
const rowFieldId = computed(() => (project.value ? (projects.getRowField(project.value.id)?.id ?? null) : null));
const openedDraft = computed(() => {
  const id = openedDraftId.value;
  return id === null ? null : (entries.value.find(entry => entry.item.itemId === id)?.item ?? null);
});
const name = computed(() => {
  const place = concerning.value[0]?.projects.find(isThisProject);
  return tracked.value?.title ?? place?.title ?? `${owner.value} #${number.value}`;
});
const concerningRows = computed(() =>
  concerning.value.map(item => ({ key: item.id, id: item.id, value: item, nested: [] })),
);

// A view GitHub answers is asked while it is shown (K6) — once per view, however often its items change.
watch(
  () => (answered.value ? JSON.stringify(answered.value) : null),
  (_key, _previous, onCleanup) => {
    const shown = answered.value;
    if (shown) {
      onCleanup(answers.show(shown));
    }
  },
  { immediate: true },
);

/** Whether a place an item says it is in is this project, by its address on GitHub. */
function isThisProject(place: { readonly url: string }) {
  return place.url.toLowerCase() === githubUrl.value.toLowerCase();
}

function buildGroups(current: Project, shown: readonly ProjectEntry[], by: ProjectGrouping) {
  return buildProjectList({
    project: current,
    entries: shown,
    grouping: by,
    sort: options.options.sort,
    texts: texts.value,
    today: today.value,
    arriving: arriving.value,
  });
}

/**
 * How many entries another saved view lists, for the phone's menu of the views (mobile D17): its filter as saved on
 * GitHub evaluated here, or as GitHub last answered it — a stack one entry, as the view shown counts it; `null` until it
 * has.
 */
function countView(viewId: string) {
  const current = project.value;
  const other = current?.views.find(candidate => candidate.id === viewId);
  if (!current || !other) {
    return null;
  }

  const matched = selectView(compileFilter(current.fields, other.filter), other.filter ?? '');
  // Grouped as the view is saved on GitHub, as its filter is: a stack its grouping splits counts as the view shows it.
  const saved = getProjectViewDefaults(current, other).options.grouping;
  return matched === null ? null : countListRows(foldGroups(current, matched, saved));
}

/** A filter of the project's entries as the views read it, for the signed-in user today. */
function compileFilter(fields: readonly ProjectField[], source: string | null) {
  return compileProjectFilter({ ...filterContext.value, filter: source || null, fields });
}

/** The entries a compiled filter keeps: evaluated here, or as GitHub last answered it (K6); `null` until it has. */
function selectView(compiledFilter: CompiledProjectFilter, source: string) {
  const current = project.value;
  return selectProjectEntries({
    entries: entries.value,
    filter: compiledFilter,
    answered: compiledFilter.kind === 'github' && current && source ? answers.get(current.id, source).ids : null,
  });
}

/**
 * The groups of the entries a filter keeps (`foldProjectGroups`): a stack described from the whole stack, which the
 * local copy holds even where the project does not.
 */
function foldGroups(current: Project, matched: readonly ProjectEntry[], by: ProjectGrouping) {
  return foldProjectGroups({
    matched,
    entries: entries.value.filter(entry => !entry.item.isArchived),
    build: shown => buildGroups(current, shown, by),
    stacks: stacks.value,
    describe: stack => describeStack({ stack, viewerLogin: auth.viewer?.login ?? '', getItem: id => items.get(id) }),
  });
}

function formatIteration(iteration: ProjectIteration) {
  const start = Date.parse(`${iteration.startDate}T00:00:00Z`);
  const end = start + (iteration.duration - 1) * 86_400_000;
  return t(l.iterationRange, { start: formatShortDate(start), end: formatShortDate(end) });
}

function describeSort(current: Project, sort: string) {
  const levels = parseProjectSort(current, sort);
  if (levels.length === 0) {
    return t(l.manual);
  }

  return levels
    .map(level =>
      t(level.direction === 'asc' ? l.ascending : l.descending, { key: describeSortKey(current, level.key) }),
    )
    .join(', ');
}

function describeSortKey(current: Project, key: ProjectSortKey) {
  switch (key) {
    case 'title':
      return t(l.sortTitle);
    case 'repository':
      return t(l.sortRepository);
    case 'milestone':
      return t(l.sortMilestone);
    case 'assignees':
      return t(l.sortAssignees);
    default:
      return getGroupingField(current, key)?.name ?? key;
  }
}

function findEntry(id: string) {
  return selected.value?.find(entry => getProjectEntryId(entry) === id) ?? null;
}

function canMove(entry: ListEntry<ProjectEntry>) {
  const current = project.value;
  const field = current ? getGroupingField(current, grouping.value) : undefined;
  return (
    current !== null &&
    current.viewerCanUpdate &&
    (field?.kind === 'singleSelect' || field?.kind === 'iteration') &&
    !entry.value.item.itemId.startsWith('pending:')
  );
}

function move({ ids, to }: ListMove) {
  const current = project.value;
  const field = current ? getGroupingField(current, grouping.value) : undefined;
  const [id, ...others] = ids;
  if (!current || !field || id === undefined) {
    return;
  }

  const value = toFieldInput(field.kind, to);
  if (others.length > 0) {
    // A stack's card (D3): the field of each pull request's own place, as for the items edited together.
    void editor.edit(ids, { kind: 'projectFieldInProject', projectId: current.id, fieldId: field.id, value });
    return;
  }

  const entry = findEntry(id);
  if (!entry) {
    return;
  }

  if (entry.content) {
    void editor.edit([entry.content.id], {
      kind: 'projectField',
      projectItemId: entry.item.itemId,
      fieldId: field.id,
      value,
    });
  } else {
    void editor.setDraftField(entry.item.itemId, field.id, value);
  }
}

/** The quick capture adding the issue to this project (H5) — with the value of the group it was started in. */
function startNewIssue(group: string | null, label: string | null) {
  const current = project.value;
  if (!current) {
    return;
  }

  const field = getGroupingField(current, grouping.value);
  const value = field && group !== null ? toFieldInput(field.kind, group) : null;
  composer.start({
    repository: null,
    project: {
      projectId: current.id,
      title: current.title,
      values: field && value && label !== null ? [{ fieldId: field.id, fieldName: field.name, value, label }] : [],
    },
    parent: null,
  });
}

/** The issues and pull requests of the local copy not in the project yet, the latest changed first. */
function addDraft(title: string, group: string | null) {
  const current = project.value;
  if (!current) {
    return;
  }

  const field = getGroupingField(current, grouping.value);
  const value = field && group !== null ? toFieldInput(field.kind, group) : null;
  const values: DraftIssueFieldInput[] = field && value ? [{ fieldId: field.id, value }] : [];
  void editor.addDraftIssue(current.id, { title, body: '', values });
}

/** A group's key as the value of the field grouped by: an option's or an iteration's id. */
function toFieldInput(kind: string, key: string): ProjectFieldInput | null {
  if (key === NO_VALUE) {
    return null;
  }

  switch (kind) {
    case 'singleSelect':
      return { kind: 'singleSelect', optionId: key };
    case 'iteration':
      return { kind: 'iteration', iterationId: key };
    default:
      return null;
  }
}

function open(id: string) {
  const entry = findEntry(id);
  if (entry && !entry.content) {
    openedDraftId.value = entry.item.itemId;
    return;
  }

  list.open(id);
}

/** `⇧Enter`: an item straight on its page; a draft, which has none, opens as Enter opens it. */
function openFullScreen(id: string) {
  const entry = findEntry(id);
  if (entry && !entry.content) {
    open(id);
    return;
  }

  list.openFullScreen(id);
}

function setRowField(fieldId: string | null) {
  if (project.value) {
    projects.setRowField(project.value.id, fieldId);
  }
}
</script>

<template>
  <ProjectView
    v-if="project && auth.viewer"
    v-model:selected-id="list.selectedId"
    v-model:checked-ids="list.checkedIds"
    :project="project"
    :tabs="tabs"
    :view-commands="viewCommands"
    :count-view="countView"
    :view="showAll ? null : view"
    :groups="groups"
    :item-count="itemCount"
    :arriving="arriving"
    :cant-be-read="cantBeRead"
    :all-items-to="allItemsTo"
    :answered-term="answered?.term ?? null"
    :options="shownOptions"
    :modified="options.modified"
    :roadmap="defaults.roadmap && layout === 'list'"
    :sorts="sorts"
    :row-field-id="rowFieldId"
    :viewer-login="auth.viewer.login"
    :now="list.now"
    :opened-id="list.openedId"
    :is-edited="list.isEdited"
    :undone="list.undone"
    :can-move="canMove"
    :tracked-repositories="tracking.repositoryNames"
    @update:options="options.set($event)"
    @update:row-field-id="setRowField"
    @reset="options.reset()"
    @open="open"
    @expand="list.expand"
    @full-screen="openFullScreen"
    @listed="list.setListed"
    @move="move"
    @add-draft="addDraft"
    @new-issue="startNewIssue"
    @add-items="registry.openMenu(ADD_ITEMS_COMMAND)"
    @clear-filter="options.set({ filter: '' })"
  >
    <template #menu>
      <ProjectContextMenu
        :project-id="project.id"
        :new-issue-key="keyOf(newIssueInProject)"
        current
        :shown-view="showAll ? null : (view?.id ?? null)"
      />
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
  </ProjectView>
  <ProjectDraftDialog
    v-if="project"
    :project="project"
    :item="openedDraft"
    @close="openedDraftId = null"
  />

  <UntrackedView
    v-if="!tracked && auth.viewer"
    v-model:selected-id="list.selectedId"
    v-model:checked-ids="list.checkedIds"
    :name="name"
    :meta="owner"
    :github-url="githubUrl"
    :rows="concerningRows"
    :summary="
      concerning.length > 0 ? t(l.onlyWhatConcerns, { name, count: concerning.length }) : t(l.nothingConcerns, { name })
    "
    :properties="UNTRACKED_PROPERTIES"
    :viewer-login="auth.viewer.login"
    :now="list.now"
    :opened-id="list.openedId"
    :is-edited="list.isEdited"
    :undone="list.undone"
    @open="list.open"
    @expand="list.expand"
    @full-screen="list.openFullScreen"
    @listed="list.setListed"
  >
    <template #others>
      <p>{{ t(concerning.length > 0 ? l.othersOnGitHub : l.allOnGitHub) }}</p>
      <p>
        {{ t(l.youCanTrackIt) }}
        <Button
          variant="link"
          :link="getSettingsPath('projects', githubUrl)"
        >
          {{ t(l.settings) }}
        </Button>
      </p>
    </template>
    <template #contextMenu="menu">
      <ItemContextMenu
        :ids="menu.ids"
        :merge="menu.merge"
        @open="menu.open"
      />
    </template>
  </UntrackedView>

  <div
    v-if="tracked && !project"
    :class="css.projectPage"
  >
    <PhoneTopBar
      v-if="phone.active"
      :title="name"
    />
    <header
      v-else
      :class="css.projectPage_header"
      v-bind="WINDOW_DRAG_REGION"
    >
      <h1 :class="css.projectPage_title">{{ name }}</h1>
    </header>
    <CantBeRead
      v-if="cantBeRead"
      place="screen"
      :cause="cantBeRead"
      :thing="name"
    />
    <!-- Its layout comes with it, from its saved views: until then a screen of ghost rows (ES18). -->
    <StillArriving
      v-else
      place="screen"
    />
  </div>
</template>

<style lang="scss" module="css">
.projectPage {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.projectPage_header {
  @include list-header;

  gap: 0;
}

.projectPage_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
}
</style>
