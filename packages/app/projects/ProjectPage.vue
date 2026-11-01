<!-- `/orgs/<login>/projects/<n>[/views/<v>]`, `/users/<login>/projects/<n>[/views/<v>]`: a tracked project's view at GitHub's addresses of it, from the local copy (D4, D13). The saved view named by the address — else the first — gives the filter, evaluated here (or answered by GitHub, K6), and the layout, grouping, order and fields; what the user changes of them is kept on this device per view. Field edits from the view — moving a card, `⇧←`/`⇧→` — and draft issues go through the edit engine, only where the user may update the project (D14). A project still arriving says so; one not tracked shows what concerns the user and points to Settings (J4). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { Plus, SquareKanban, SquarePen } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { CommandRegistry, NEW_ISSUE_KEY } from '@/commands/CommandRegistry.js';
import type { CommandOption } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import EmptyState from '@/components/EmptyState.vue';
import type { DraftIssueFieldInput } from '@/edits/ItemEditor.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import type { ProjectFieldInput } from '@/edits/EditTypes.js';
import { formatShortReference } from '@/item/itemRoutes.js';
import { getItemComparator } from '@/lists/getItemComparator.js';
import { NO_VALUE } from '@/lists/groupEntries.js';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import type { ListChoice, ListEntry, ListMove } from '@/lists/ListTypes.js';
import { ListViewOptionsStore } from '@/lists/ListViewOptionsStore.js';
import ItemContextMenu from '@/lists/ItemContextMenu.vue';
import SelectionActions from '@/lists/SelectionActions.vue';
import { useItemList } from '@/lists/useItemList.js';
import { useListViewOptions } from '@/lists/useListViewOptions.js';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import { getSettingsPath } from '@/settings/settingsRoutes.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { ProjectIteration } from '@/store/ItemDetailTypes.js';
import { TrackedItems } from '@/tracking/TrackedItems.js';
import type { ProjectAddress } from '@/tracking/trackingRoutes.js';
import { getProjectPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import * as untracked from '@/tracking/UntrackedView.loc.js';
import UntrackedView from '@/tracking/UntrackedView.vue';
import { formatShortDate } from '@/utils/formatShortDate.js';

import type { ProjectListTexts } from './buildProjectList.js';
import { buildProjectList, getProjectEntryId } from './buildProjectList.js';
import { compileProjectFilter } from './filter/compileProjectFilter.js';
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
  getColumnGrouping,
  getGroupingField,
  getProjectViewChoices,
  getProjectViewDefaults,
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
/** The options kept for "All items" (K9: `?all`), beside the saved views'. */
const ALL_ITEMS_LIST = 'all';
/** What the rows of a project not tracked show: it has no saved view or row field of its own to say (J4). */
const UNTRACKED_PROPERTIES: readonly ItemProperty[] = ['status', 'labels', 'people', 'updated'];

const auth = useService(AuthStore);
const tracking = useService(TrackingStore);
const trackedItems = useService(TrackedItems);
const projects = useService(ProjectStore);
const items = useService(ItemStore);
const editor = useService(ItemEditor);
const answers = useService(ProjectViewAnswers);
const listViewOptions = useService(ListViewOptionsStore);
const composer = useService(NewIssueComposer);
const registry = useService(CommandRegistry);
const route = useRoute();
const t = useTranslate();
const list = useItemList();
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

// In a project, a new issue is added to it (H5): its `C` comes before the app's. Items already on GitHub are
// added from the local copy, several in a row (K8).
useCommands(() =>
  project.value?.viewerCanUpdate
    ? [
        {
          id: 'project.newIssue',
          title: t(l.newIssueInProject, { project: project.value.title }),
          section: 'view',
          key: NEW_ISSUE_KEY,
          icon: SquarePen,
          run: () => startNewIssue(null, null),
        },
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
const view = computed((): SavedView | null => {
  const views = project.value?.views ?? [];
  return views.find(candidate => candidate.number === viewNumber.value) ?? views[0] ?? null;
});
const defaults = computed(() => {
  const saved =
    project.value && view.value
      ? getProjectViewDefaults(project.value, view.value)
      : { options: NO_VIEW_OPTIONS, roadmap: false };
  return showAll.value ? { ...saved, options: { ...saved.options, filter: '' } } : saved;
});
const options = useListViewOptions({
  list: () => listKey(project.value?.id ?? '', showAll.value ? ALL_ITEMS_LIST : (view.value?.id ?? '')),
  defaults: () => defaults.value.options,
  choices: () =>
    project.value
      ? getProjectViewChoices(project.value, defaults.value.options)
      : { groupings: [], sorts: [], properties: [] },
});
/** On the board the grouping is the columns: a single select or iteration field. */
const grouping = computed((): ProjectGrouping => {
  const chosen = options.options.grouping;
  if (options.options.layout !== 'board' || !project.value || isColumnGrouping(project.value, chosen)) {
    return chosen;
  }

  return getColumnGrouping(project.value, view.value) ?? 'none';
});
const shownOptions = computed((): ProjectViewOptions => ({ ...options.options, grouping: grouping.value }));
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
/** The filter applied: the saved view's, unless cleared here or all items are shown. */
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
const filter = computed(() => options.options.filter ?? '');
const compiled = computed(() =>
  compileProjectFilter({
    filter: filter.value || null,
    fields: project.value?.fields ?? [],
    viewerLogin: auth.viewer?.login ?? '',
    today: today.value,
    hasDrafts: hasDrafts(),
    hasDraftPullRequests: hasDraftPullRequests(),
  }),
);
const answered = computed(() => {
  const evaluated = compiled.value;
  return evaluated.kind === 'github' && project.value && filter.value
    ? { projectId: project.value.id, filter: filter.value, term: evaluated.term }
    : null;
});
const selected = computed(() =>
  selectProjectEntries({
    entries: entries.value,
    filter: compiled.value,
    answered: answered.value ? answers.get(answered.value.projectId, answered.value.filter).ids : null,
  }),
);
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
const groups = computed(() =>
  project.value && selected.value
    ? buildProjectList({
        project: project.value,
        entries: selected.value,
        grouping: grouping.value,
        sort: options.options.sort,
        texts: texts.value,
        today: today.value,
      })
    : null,
);
const itemCount = computed(() => entries.value.filter(entry => !entry.item.isArchived).length);
const tabs = computed((): ProjectTab[] => {
  const current = project.value;
  if (!current) {
    return [];
  }

  // The tab shown follows its options; the others by what this device keeps of them.
  const saved = current.views.map((other): ProjectTab => {
    const shown = !showAll.value && other.id === view.value?.id;
    return {
      key: other.id,
      name: other.name,
      to: getProjectPath(current, other.number),
      current: shown,
      modified: shown ? options.modified : listViewOptions.has(listKey(current.id, other.id)),
      answered: shown
        ? answered.value !== null
        : compileProjectFilter({
            filter: other.filter,
            fields: current.fields,
            viewerLogin: auth.viewer?.login ?? '',
            today: today.value,
            hasDrafts: hasDrafts(),
            hasDraftPullRequests: hasDraftPullRequests(),
          }).kind === 'github',
    };
  });
  const all: ProjectTab = {
    key: ALL_ITEMS_LIST,
    name: t(l.allItems),
    to: { path: route.path, query: { all: null } },
    current: true,
    modified: options.modified,
    answered: false,
  };
  return showAll.value ? [...saved, all] : saved;
});
/** "Show all items" where a filter keeps some out (K9): this view's options, no filter. */
const allItemsTo = computed(() => (!showAll.value && filter.value ? { path: route.path, query: { all: null } } : null));
const sorts = computed((): ListChoice[] => {
  const current = project.value;
  if (!current) {
    return [];
  }

  return getProjectViewChoices(current, defaults.value.options).sorts.map(sort => ({
    value: sort,
    label: describeSort(current, sort),
  }));
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

function listKey(projectId: string, viewId: string) {
  return `project:${projectId}:${viewId}`;
}

function hasDrafts() {
  return entries.value.some(entry => entry.item.draft !== null);
}

function hasDraftPullRequests() {
  return entries.value.some(entry => entry.content?.kind === 'pullRequest' && entry.content.isDraft);
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

function move({ id, to }: ListMove) {
  const current = project.value;
  const entry = findEntry(id);
  const field = current ? getGroupingField(current, grouping.value) : undefined;
  if (!current || !entry || !field) {
    return;
  }

  const value = toFieldInput(field.kind, to);
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

function setListed(ids: readonly string[]) {
  // Draft issues are not opened through the item view: stepping through the list skips them.
  list.setListed(ids.filter(id => findEntry(id)?.content));
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
    :view="showAll ? null : view"
    :groups="groups"
    :item-count="itemCount"
    :all-items-to="allItemsTo"
    :answered-term="answered?.term ?? null"
    :options="shownOptions"
    :modified="options.modified"
    :roadmap="defaults.roadmap && options.options.layout === 'list'"
    :sorts="sorts"
    :row-field-id="rowFieldId"
    :viewer-login="auth.viewer.login"
    :now="list.now"
    :opened-id="list.openedId"
    :undone="list.undone"
    :can-move="canMove"
    @update:options="options.set($event)"
    @update:row-field-id="setRowField"
    @reset="options.reset()"
    @open="open"
    @listed="setListed"
    @move="move"
    @add-draft="addDraft"
    @new-issue="startNewIssue"
    @add-items="registry.openMenu(ADD_ITEMS_COMMAND)"
    @clear-filter="options.set({ filter: '' })"
  >
    <template #menu>
      <ProjectContextMenu
        :project-id="project.id"
        :new-issue-key="NEW_ISSUE_KEY"
      />
    </template>
    <template #selection="{ ids }">
      <SelectionActions
        :ids="ids"
        @clear="list.checkedIds = []"
      />
    </template>
    <template #contextMenu="menu">
      <ItemContextMenu
        :ids="menu.ids"
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
    :icon="SquareKanban"
    :name="name"
    :meta="owner"
    :github-url="githubUrl"
    :rows="concerningRows"
    :summary="
      concerning.length > 0
        ? t(l.onlyWhatConcerns, { name, count: concerning.length })
        : t(untracked.nothingConcerns, { name })
    "
    :others="t(concerning.length > 0 ? l.othersOnGitHub : l.allOnGitHub)"
    :settings-to="getSettingsPath('projects', githubUrl)"
    :properties="UNTRACKED_PROPERTIES"
    :viewer-login="auth.viewer.login"
    :now="list.now"
    :opened-id="list.openedId"
    :undone="list.undone"
    @open="list.open"
    @listed="list.setListed"
  >
    <template #contextMenu="menu">
      <ItemContextMenu
        :ids="menu.ids"
        @open="menu.open"
      />
    </template>
  </UntrackedView>

  <div
    v-if="tracked && !project"
    :class="css.projectPage"
  >
    <header
      :class="css.projectPage_header"
      v-bind="WINDOW_DRAG_REGION"
    >
      <h1 :class="css.projectPage_title">{{ name }}</h1>
    </header>
    <EmptyState
      :icon="SquareKanban"
      :title="t(l.arrivingTitle, { name })"
      :detail="t(l.arrivingDetail, { count: trackedItems.getOpenCount({ kind: 'project', id: tracked.id }) })"
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
  display: flex;
  flex: none;
  align-items: center;
  height: $list-header-height;
  padding: 0 $spacing-16;
  border-bottom: 1px solid $color-border;
}

.projectPage_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
}
</style>
