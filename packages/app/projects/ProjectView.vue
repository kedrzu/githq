<!-- A tracked project's view (D4, D5, `ui/project.md`): its saved views from GitHub as tabs (D13) — the first nine on `1`–`9`, said in each tab's tooltip ("Go to Backlog"), `[` and `]` stepping to the previous and next tab as shown, wrapping around (D14–D17) —, each with its own filter, grouping, order, layout and fields — the filter's terms shown under the toolbar, "Sorted by …" right after them — as a List or a Board through the list engine. The title is led by the project's icon (D12). A tab changed in githq is marked "modified locally", with "Reset" to GitHub's version; the display options say they stay on this device, and set the project's row field (D12), also a command of the command menu ("Row field…"). A view whose filter githq can't evaluate is answered by GitHub: its tab and the term carry a cloud (K6), and until GitHub answers it waits instead of showing the unfiltered items. Rows and cards show the project's fields; draft issues show as drafts; a stack's entry the list was given shows as one — a row (`StackRow`) with the field values its pull requests share (D15), its pull requests nested under it once expanded, or on the board a card (`StackCard`) listing them inside it once expanded — and a pull request listed alone out of its stack carries its marker. With the right to update the project, "New draft" at the end of a group or the bottom of a column writes a draft there, with that group's value; on the board items move between columns by drag or `⇧←`/`⇧→`, a stack's card with all its pull requests. Next to it "New issue" opens the quick capture adding the issue to the project with that group's value (H5). A project with nothing to make columns of offers no board (K7); an empty project (K8) offers to add existing issues (in the command menu), a new issue or a draft; a view nothing matches (K9) says so, with the ways out: all the project's items, or its filter cleared here (a change kept on this device, undone by Reset); on the board the note stands over the columns, which stay to write a draft into (ES19). While its items are still downloading, with none in or none the view matches yet, it is neither: ghosts stand where they will land — a screen of ghost rows, on the board its columns' heads without counts over ghost cards (first run and loading D5, D17, ES18, ES30) — and rows show as soon as they are in. With nothing on screen, first of all it says what stands in the way (D6, ES20; `CantBeRead`): GitHub not showing it whatever has arrived, offline, paused or GitHub failing only while its items are on their way — named as its items ("Platform Q4's items"), as the project and its views are in; with rows on screen the status bar alone tells. On a phone the toolbar is the phone's top bar, the saved views left to the places panel and the command menu (`ListToolbar`, mobile D53), its options a sheet from below headed by the view's name — the view's filter as a chip cleared here by its ×, Back to GitHub's view while changed, the view on github.com (`ListOptionsSheet`, mobile D36, D46, D49) —, a board view is a list grouped by its columns, the layout kept for a wider window (`useShownLayout`, mobile D9), and the command line names the view shown with its count, dotted when changed on this device (mobile D17, D49), its menu listing the saved views first (`viewCommands`), each with its count (`countView`), the one shown checked, those changed on this device dotted; the rows are the phone's (`ItemRow`, `StackRow`: mobile D23), a tracked repository named without its owner. -->
<script lang="ts" setup>
import { useLanguage } from '@nzyme/vue-i18n/useLanguage.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  Ban,
  Cloud,
  CircleCheck,
  FilePlus,
  FilterX,
  List,
  ListFilter,
  Loader,
  Map as MapIcon,
  Milestone,
  Monitor,
  Plus,
  SquareKanban,
  SquarePen,
  Tag,
  User,
  BookMarked,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { useRouter } from 'vue-router';

import { APP_KEYS, NEW_ISSUE_KEY } from '@/commands/CommandRegistry.js';
import type { Command, CommandPart, CommandParts } from '@/commands/CommandTypes.js';
import { rowField } from '@/commands/definitions/index.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import CantBeRead from '@/components/CantBeRead.vue';
import type { CantBeReadCause } from '@/components/CantBeReadCause.js';
import EmptyState from '@/components/EmptyState.vue';
import type { HeaderTabsSet } from '@/components/HeaderTabs.vue';
import { TAB_STEP_KEYS } from '@/components/HeaderTabs.vue';
import FilteredOut from '@/components/FilteredOut.vue';
import { countListRows } from '@/lists/countListRows.js';
import type { SelectionSpan } from '@/lists/getSelectionSpan.js';
import { getSelectionSpan } from '@/lists/getSelectionSpan.js';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import * as propertyLabels from '@/lists/ItemProperty.loc.js';
import ItemCard from '@/lists/ItemCard.vue';
import ItemRow from '@/lists/ItemRow.vue';
import type { ListTitleIcon } from '@/lists/ListTitle.vue';
import ListToolbar from '@/lists/ListToolbar.vue';
import type { ListToolbarOption } from '@/lists/ListToolbarControl.vue';
import type {
  ListChoice,
  ListContextMenuProps,
  ListedItems,
  ListEntry,
  ListGroup,
  ListMove,
} from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import StackCard from '@/lists/StackCard.vue';
import StackRow from '@/lists/StackRow.vue';
import { useRepositoryTracked } from '@/lists/useRepositoryTracked.js';
import { useShownLayout } from '@/lists/useShownLayout.js';
import { usePhonePart } from '@/shell/usePhonePart.js';
import type { ProjectField } from '@/store/ItemDetailTypes.js';
import { formatList } from '@/utils/formatList.js';

import { describeProjectFilter } from './filter/describeProjectFilter.js';
import { parseProjectFilter } from './filter/parseProjectFilter.js';
import ProjectDraft from './ProjectDraft.vue';
import ProjectDraftComposer from './ProjectDraftComposer.vue';
import ProjectEntryFields from './ProjectEntryFields.vue';
import type { Project, ProjectEntry, ProjectView } from './ProjectTypes.js';
import * as l from './ProjectView.loc.js';
import type { ProjectGrouping, ProjectViewOptions } from './projectViewOptions.js';
import { getGroupingField, isItemProperty, MANUAL_SORT, parseProjectSort } from './projectViewOptions.js';

/** A saved view — or "All items" (K9) — as its tab shows it. */
export interface ProjectTab {
  /** Unique among the tabs: the saved view's id. */
  readonly key: string;
  readonly name: string;
  /** Its address in githq. */
  readonly to: RouteLocationRaw;
  /** It is the one shown. */
  readonly current: boolean;
  /** Its grouping, order, layout or fields were changed on this device (D13). */
  readonly modified: boolean;
  /** Its filter is answered by GitHub (K6). */
  readonly answered: boolean;
}

const props = withDefaults(
  defineProps<{
    project: Project;
    tabs: readonly ProjectTab[];
    /** The saved view shown; `null` for a project without one, or all its items shown (K9). */
    view: ProjectView | null;
    /** The view's groups; `null` while GitHub has not answered a view githq can't evaluate (K6). */
    groups: readonly ListGroup<ProjectEntry>[] | null;
    /** The project's items, archived ones left out — for its title, and to tell an empty project (K8). */
    itemCount: number;
    /**
     * Its items are still downloading: with none in, or none the view matches yet, ghosts stand where they will land —
     * never an empty project with its add actions (K8), nor a view matching nothing (K9) (first run and loading ES18,
     * ES30).
     */
    arriving?: boolean;
    /** Why what it lacks can't arrive now, as the page knows it; `null` when nothing stands in its way. */
    cantBeRead?: CantBeReadCause | null;
    /** The term of the view's filter githq can't evaluate; `null` when it evaluates the filter itself. */
    answeredTerm?: string | null;
    /** The options differ from the saved view's (D13). */
    modified?: boolean;
    /** The saved view is a roadmap on GitHub, shown as a list. */
    roadmap?: boolean;
    /** The orders the display options offer, named. */
    sorts: readonly ListChoice[];
    /** The project's row field (D12): its id, `null` for none. */
    rowFieldId: string | null;
    /** The signed-in user. */
    viewerLogin: string;
    /** Epoch ms the rows' ages are counted to. */
    now: number;
    openedId?: string | null;
    /** The user has an edit of the item on its way (`ListView`). */
    isEdited?: (id: string) => boolean;
    undone?: ReadonlyMap<string, string>;
    /** Whether the entry may be moved from one group into another (set the field). */
    canMove?: (entry: ListEntry<ProjectEntry>, from: string, to: string) => boolean;
    /** Where "Show all items" goes when nothing matches the view's filter (K9); `null` where none keeps any out. */
    allItemsTo?: RouteLocationRaw | null;
    /** The tracked repositories (`owner/name`): a phone's rows name them without their owner (mobile D23). */
    trackedRepositories?: readonly string[];
    /**
     * Going to each saved view, as the command menu's level under the project has them (`useProjectCommands`), the first
     * nine on `1`–`9`: run by their keys while the view is shown, their keys on the tabs, and the phone's menu of the
     * views lists them first (mobile D17).
     */
    viewCommands?: readonly Command[];
    /**
     * How many items another saved view (by its tab's key) lists, for the phone's menu of the views; `null` while that is
     * not known. Asked only as the menu draws.
     */
    countView?: (key: string) => number | null;
  }>(),
  {
    allItemsTo: null,
    trackedRepositories: () => [],
    arriving: false,
    cantBeRead: null,
    answeredTerm: null,
    modified: false,
    roadmap: false,
    openedId: null,
    isEdited: () => false,
    undone: () => new Map(),
    canMove: () => false,
    viewCommands: () => [],
    countView: () => null,
  },
);

const emit = defineEmits<{
  open: [id: string];
  /** Enter on the opened item's row: it expands to its page. */
  expand: [id: string];
  /** `⇧Enter` on a row not open: it opens straight on its page. */
  fullScreen: [id: string];
  listed: [listed: ListedItems];
  /** An item dropped into another column or group: set its field. */
  move: [move: ListMove];
  /** Back to the saved view's options. */
  reset: [];
  /** A draft written in a group (its key; `null` in a project with no groups yet). */
  addDraft: [title: string, group: string | null];
  /** "New issue" in a group (H5): the quick capture, adding the issue here with the group's value (none: `null`). */
  newIssue: [group: string | null, label: string | null];
  /** "Add existing issues" in the empty project (K8): the command menu's submenu of them. */
  addItems: [];
  /** "Clear filters here" where nothing matches the view (K9), or a phone's × on it: its filter cleared on this device. */
  clearFilter: [];
  /** Another row field for the project (`null`: none). */
  'update:rowFieldId': [fieldId: string | null];
}>();

/** The selected item's id. */
const selectedId = defineModel<string | null>('selectedId', { default: null });
/** The items edited together (`x`). */
const checkedIds = defineModel<readonly string[]>('checkedIds', { default: () => [] });
/** Layout, grouping, order and the properties rows show; kept on this device by the page. */
const options = defineModel<ProjectViewOptions>('options', { required: true });

defineSlots<{
  /** The entries of the menu the title opens (`ListToolbar`'s `titleMenu`). */
  menu?(): unknown;
  /** The actions of the items edited together, while there are any. */
  selection?(props: { ids: readonly string[]; span: SelectionSpan }): unknown;
  /** The entries of a row's context menu (`ListView`'s `contextMenu`). */
  contextMenu?(props: ListContextMenuProps): unknown;
}>();

/** The row field's value when the project has none. */
const NO_ROW_FIELD = '';

const t = useTranslate();
const router = useRouter();
/** What is drawn: a list on a phone, a board view keeping its columns as its grouping (mobile D9). */
const layout = useShownLayout(() => options.value.layout);
const language = useLanguage();
/** The group a draft is being written in; `null` for the empty project's. */
const composing = ref<string | null | undefined>(undefined);

const canWrite = computed(() => props.project.viewerCanUpdate);
const selectFields = computed(() => props.project.fields.filter(field => field.kind === 'singleSelect'));
/** No single select or iteration to make columns of (K7). */
const boardDisabled = computed(
  () => !props.project.fields.some(field => field.kind === 'singleSelect' || field.kind === 'iteration'),
);
const groupings = computed((): ListChoice[] => {
  const github = t(l.fromGitHub);
  const fields = t(l.projectFields);
  const choices: ListChoice<ProjectGrouping>[] =
    options.value.layout === 'board'
      ? []
      : [
          { value: 'none', label: t(l.groupNone), icon: Ban, section: github },
          { value: 'repository', label: t(l.groupRepository), icon: BookMarked, section: github },
          { value: 'milestone', label: t(l.groupMilestone), icon: Milestone, section: github },
          { value: 'assignees', label: t(l.groupAssignees), icon: User, section: github },
        ];
  for (const field of props.project.fields) {
    const column = field.kind === 'singleSelect' || field.kind === 'iteration';
    if (field.kind !== 'multiSelect' && (column || options.value.layout === 'list')) {
      choices.push({ value: `field:${field.id}`, label: field.name, icon: Tag, section: fields });
    }
  }

  return choices;
});
const properties = computed((): ListChoice[] => [
  ...(['status', 'size', 'labels', 'milestone', 'people', 'updated'] as const).map(property => ({
    value: property,
    label: t(propertyLabels[property]),
  })),
  ...props.project.fields.map(field => ({ value: `field:${field.id}`, label: field.name })),
]);
/** GitHub's own properties rows show. */
const itemProperties = computed(() =>
  options.value.properties.filter((property): property is ItemProperty => isItemProperty(property)),
);
/** The fields rows show, in the project's order — the one grouped by left out: its group says it. */
const shownFields = computed((): ProjectField[] => {
  const shown = new Set(options.value.properties);
  return props.project.fields.filter(
    field => shown.has(`field:${field.id}`) && `field:${field.id}` !== options.value.grouping,
  );
});
const isTracked = useRepositoryTracked(() => props.trackedRepositories);
/** The filter applied: the view's, unless cleared here. */
const filter = computed(() => options.value.filter ?? '');
const filterTerms = computed(() => {
  const applied = filter.value;
  return applied ? (parseProjectFilter(applied) ?? [{ text: applied }]).map(term => term.text) : [];
});
/** ES19: what the filter hides, in words — "Iteration is Sprint 15 and State is open hide all 128 items." */
const filterHides = computed(() => {
  if (!filter.value) {
    return null;
  }

  const phrases = describeProjectFilter({ filter: filter.value, fields: props.project.fields, lang: language.value });
  return phrases.length === 1
    ? t(l.filterHidesItems, { filter: phrases[0], count: props.itemCount })
    : t(l.filtersHideItems, { filters: formatList(phrases), count: props.itemCount });
});
const groupingField = computed(() => getGroupingField(props.project, options.value.grouping));
/** "New draft" in a group: only where the group's value can be given to a draft, or there are no groups. */
const draftable = computed(
  () =>
    canWrite.value &&
    (options.value.grouping === 'none' ||
      groupingField.value?.kind === 'singleSelect' ||
      groupingField.value?.kind === 'iteration'),
);
/** How many the view lists, for the phone's command line; `null` while they arrive or it can't be read. */
const phoneCount = computed(() =>
  props.arriving || props.groups === null || unreadable.value ? null : shownCount.value,
);
const shownCount = computed(() => countListRows(props.groups ?? []));
/**
 * With nothing on screen, what stands in the way (D6): GitHub not showing it stands whatever has arrived, as nothing more
 * comes; the others only while its items are on their way.
 */
const unreadable = computed(() => {
  const cause = props.cantBeRead;
  return cause && shownCount.value === 0 && (cause.kind === 'hidden' || props.arriving) ? cause : null;
});
/** The field this project shows next to its items in other lists, among the list's view options. */
const rowFieldOption = computed((): ListToolbarOption => {
  const choices = [
    ...selectFields.value.map(field => ({ value: field.id, label: field.name })),
    { value: NO_ROW_FIELD, label: t(l.rowFieldNone) },
  ];
  const value = props.rowFieldId ?? NO_ROW_FIELD;
  return {
    kind: 'menu',
    key: 'rowField',
    label: t(l.inOtherLists, { project: props.project.title }),
    icon: SquareKanban,
    title: t(l.rowField, { field: choices.find(choice => choice.value === value)?.label ?? t(l.rowFieldNone) }),
    choices,
    value,
    detail: t(l.rowFieldDetail),
    command: rowField,
    choose: chosen => emit('update:rowFieldId', chosen === NO_ROW_FIELD ? null : chosen),
  };
});
/** The project's board before its title, inside the title's button (D12). */
const TITLE_ICON: ListTitleIcon = { icon: SquareKanban, tone: 'accent' };
/** The saved views as the header's tabs, each a link; while items are checked the selection's actions take their place. */
const viewTabs = computed((): HeaderTabsSet => ({
  kind: 'links',
  label: t(l.savedViews),
  links: props.tabs.map(tab => ({
    key: tab.key,
    label: tab.name,
    to: tab.to,
    current: tab.current,
    answered: tab.answered,
    modified: tab.modified,
    keyshortcuts: getViewCommand(tab.key)?.key,
    tooltip: t(l.goToView, { view: tab.name }),
  })),
  stepHint: t(l.stepViews),
}));
const fieldNames = computed(() => props.project.fields.map(field => `${field.name} (${field.kind})`).join(', '));
const sortSummary = computed(() => {
  const levels = parseProjectSort(props.project, options.value.sort);
  return options.value.sort === MANUAL_SORT || levels.length === 0
    ? t(l.manual)
    : (props.sorts.find(choice => choice.value === options.value.sort)?.label ?? '');
});

// The saved views run by their keys while the project is on screen; the command menu finds them under the project
// already (`AppCommands`), so they are not offered in it a second time. `[` and `]` step through the tabs as shown,
// "All items" too while it is one, wrapping around (D17).
useCommands(() => [
  ...props.viewCommands.map(command => ({ ...command, menu: false })),
  {
    id: 'project.previousView',
    // Keys and the help sheet only: in ⌘K it would only stand between the sections.
    menu: false,
    title: t(l.previousView),
    section: 'view',
    key: TAB_STEP_KEYS.previous,
    icon: ChevronLeft,
    when: () => props.tabs.length > 1,
    run: () => stepView(-1),
  },
  {
    id: 'project.nextView',
    menu: false,
    title: t(l.nextView),
    section: 'view',
    key: TAB_STEP_KEYS.next,
    icon: ChevronRight,
    when: () => props.tabs.length > 1,
    run: () => stepView(1),
  },
]);

// On a phone the command line names the tab shown with how many the view lists, left out while they arrive, with a dot
// when it was changed on this device (mobile D17, D49); its menu lists the saved views first.
usePhonePart(() => {
  const current = props.tabs.find(tab => tab.current);
  return {
    label: current?.name ?? props.project.title,
    count: phoneCount.value,
    changed: current?.modified ?? false,
    parts: getPhoneParts,
  };
});

/**
 * The saved views, as the menu's level under the project offers them (`viewCommands`), each with how many it lists,
 * the one shown checked and those changed on this device dotted (mobile D17, D49).
 */
function getPhoneParts(): CommandParts {
  return {
    heading: t(l.phoneViews, { project: props.project.title }),
    rows: props.viewCommands.flatMap((command): CommandPart[] => {
      const tab = props.tabs.find(candidate => `view:${candidate.key}` === command.id);
      if (!tab) {
        return [];
      }

      const count = tab.current ? phoneCount.value : props.countView(tab.key);
      // Under the heading "… · views" a view need not say it is one.
      const marked = { ...command, detail: undefined, count, current: tab.current, changed: tab.modified };
      return [{ kind: 'command', command: marked }];
    }),
  };
}

/** Goes to the tab before (`-1`) or after (`1`) the one shown, from the last to the first and back. */
function stepView(step: number) {
  const { tabs } = props;
  const index = tabs.findIndex(tab => tab.current);
  const next = tabs[(index + step + tabs.length) % tabs.length];
  if (next) {
    void router.push(next.to);
  }
}

/** The command going to a saved view, by its tab's key; none for "All items". */
function getViewCommand(key: string) {
  return props.viewCommands.find(command => command.id === `view:${key}`);
}

function addDraft(title: string, group: string | null) {
  emit('addDraft', title, group);
}

/** A draft issue has its own dialog, not the item view: it is no step of an opened item. */
function hasItemView(entry: ProjectEntry) {
  return entry.content !== null;
}
</script>

<template>
  <div :class="css.projectView">
    <ListToolbar
      v-model:options="options"
      :title="project.title"
      :title-icon="TITLE_ICON"
      :groupings="groupings"
      :sorts="sorts"
      :properties="properties"
      :modified="modified"
      :board-disabled="boardDisabled"
      :extra-options="[rowFieldOption]"
      :list-name="tabs.find(tab => tab.current)?.name"
      :git-hub-view="view && `${project.url}/views/${view.number}`"
      :tabs="tabs.length > 0 && checkedIds.length === 0 ? viewTabs : null"
      @reset="emit('reset')"
      @clear-filter="emit('clearFilter')"
    >
      <template
        v-if="$slots.menu"
        #titleMenu
      >
        <slot name="menu" />
      </template>
      <template #title>
        <span :class="css.projectView_meta">
          <!-- While its items arrive the count is left out: a partial total would read as the whole (D14). -->
          {{ arriving || unreadable ? project.owner : t(l.meta, { owner: project.owner, count: itemCount }) }}
        </span>
      </template>
      <template
        v-if="$slots.selection"
        #selection
      >
        <slot
          v-if="checkedIds.length > 0"
          name="selection"
          :ids="checkedIds"
          :span="getSelectionSpan(groups ?? [], checkedIds)"
        />
      </template>
      <span
        v-if="modified"
        :class="css.projectView_changed"
      >
        {{ t(l.changedHere) }}
        <Button
          variant="link"
          size="sm"
          @click="emit('reset')"
        >
          {{ t(l.reset) }}
        </Button>
      </span>

      <template #displayHeader>
        <div :class="css.projectView_deviceNote">
          <span :class="css.projectView_deviceTitle">
            <Monitor
              :class="css.projectView_metaIcon"
              aria-hidden="true"
            />
            {{ t(l.deviceOnlyTitle) }}
          </span>
          <span>{{ view ? t(l.deviceOnlyDetail, { view: view.name }) : t(l.deviceOnlyNoView) }}</span>
        </div>
      </template>
      <template #display>
        <p
          v-if="boardDisabled"
          :class="css.projectView_note"
        >
          {{ t(l.boardUnavailable, { project: project.title, fields: fieldNames || t(l.noFields) }) }}
          <a
            :href="`${project.url}/settings`"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t(l.addFieldOnGitHub) }}</a
          >
        </p>
      </template>
    </ListToolbar>

    <div
      v-if="view && (filterTerms.length > 0 || roadmap) && !unreadable"
      :class="css.projectView_filter"
      :aria-label="t(l.filterLabel, { view: view.name })"
      role="group"
    >
      <ListFilter
        :class="css.projectView_metaIcon"
        aria-hidden="true"
      />
      <span
        v-for="term in filterTerms"
        :key="term"
        :class="[css.projectView_term, term === answeredTerm && css.projectView_term_answered]"
        :title="term === answeredTerm ? t(l.answeredTerm) : undefined"
      >
        <Cloud
          v-if="term === answeredTerm"
          :class="css.projectView_metaIcon"
          role="img"
          :aria-label="t(l.answeredByGitHub)"
        />
        {{ term }}
      </span>
      <span
        v-if="roadmap"
        :class="css.projectView_roadmap"
      >
        <MapIcon
          :class="css.projectView_metaIcon"
          aria-hidden="true"
        />
        {{ t(l.roadmap) }}
      </span>
      <span :class="css.projectView_sortSummary">{{ t(l.sortedBy, { order: sortSummary }) }}</span>
    </div>

    <!-- ES20: first of all reasons, and nothing of the view's own applies. -->
    <CantBeRead
      v-if="unreadable"
      place="screen"
      :cause="unreadable"
      :thing="unreadable.kind === 'hidden' ? project.title : t(l.itemsOf, { project: project.title })"
      :plural="unreadable.kind !== 'hidden'"
    />

    <!-- K8: nothing in the project at all — not while its items are still on their way (ES18). -->
    <EmptyState
      v-else-if="itemCount === 0 && !arriving"
      :icon="SquareKanban"
      :title="t(l.emptyProjectTitle, { project: project.title })"
      :detail="t(l.emptyProjectDetail)"
      :fact="t(l.emptyProjectFact)"
    >
      <template
        v-if="canWrite"
        #action
      >
        <ProjectDraftComposer
          v-if="composing === null"
          :group="null"
          @add="addDraft($event, null)"
          @close="composing = undefined"
        />
        <template v-else>
          <Button
            variant="secondary"
            size="sm"
            :icon="Plus"
            :kbd="APP_KEYS.commandMenu"
            :keyshortcuts="formatAriaKeyShortcuts(APP_KEYS.commandMenu)"
            @click="emit('addItems')"
          >
            {{ t(l.addExistingIssues) }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :icon="SquarePen"
            :kbd="NEW_ISSUE_KEY"
            :keyshortcuts="NEW_ISSUE_KEY"
            @click="emit('newIssue', null, null)"
          >
            {{ t(l.newIssue) }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :icon="FilePlus"
            @click="composing = null"
          >
            {{ t(l.newDraft) }}
          </Button>
        </template>
      </template>
    </EmptyState>

    <!-- K6: GitHub has not answered the view yet — its items are not the unfiltered ones. -->
    <EmptyState
      v-else-if="groups === null"
      :icon="Loader"
      :title="t(l.askingTitle)"
      :detail="t(l.askingDetail, { term: answeredTerm ?? '' })"
      :fact="t(l.askingFact, { term: answeredTerm ?? '' })"
    />

    <!-- K9: the view is fine, nothing matches it now. A board keeps its columns, to write a draft into. -->
    <EmptyState
      v-else-if="shownCount === 0 && layout === 'list' && !arriving"
      :icon="CircleCheck"
      tone="good"
      :title="t(l.emptyViewTitle, { view: view?.name ?? project.title })"
      :detail="
        view && filter
          ? t(l.emptyViewDetail, { view: view.name, filter })
          : t(l.emptyViewDetailNoFilter, { view: view?.name ?? project.title })
      "
      :fact="view && filter ? t(l.emptyViewFact, { filter }) : undefined"
    >
      <template
        v-if="allItemsTo || filter"
        #action
      >
        <Button
          v-if="allItemsTo"
          variant="secondary"
          size="sm"
          :icon="List"
          :link="allItemsTo"
        >
          {{ t(l.showAllItems) }}
        </Button>
        <Button
          v-if="filter"
          variant="secondary"
          size="sm"
          :icon="FilterX"
          @click="emit('clearFilter')"
        >
          {{ t(l.clearFilters) }}
        </Button>
      </template>
    </EmptyState>

    <template v-else>
      <!-- ES19: the filter leaves the board nothing, and its columns stay, to write a draft into. -->
      <div
        v-if="shownCount === 0 && !arriving"
        :class="css.projectView_filteredOut"
      >
        <FilteredOut
          :detail="filterHides ?? t(l.emptyViewDetailNoFilter, { view: view?.name ?? project.title })"
          :clear="filter ? () => emit('clearFilter') : undefined"
        />
      </div>
      <ListView
        v-model:selected-id="selectedId"
        v-model:checked-ids="checkedIds"
        :scroll-key="`project:${project.id}:${view?.id ?? ''}`"
        :groups="groups"
        :groups-arriving="arriving && groups.length === 0"
        :layout="layout"
        :opened-id="openedId"
        :is-edited="isEdited"
        :get-url="entry => entry.content?.url ?? null"
        :can-move="canMove"
        :can-open-over="hasItemView"
        @open="emit('open', $event)"
        @expand="emit('expand', $event)"
        @full-screen="emit('fullScreen', $event)"
        @listed="emit('listed', $event)"
        @move="emit('move', $event)"
      >
        <template
          #row="{ entry, parent, selected, checked, halfChecked, stack, stackMarker, nested, expanded, toggleStack }"
        >
          <StackRow
            v-if="stack"
            :stack="stack"
            :properties="itemProperties"
            :repository-tracked="isTracked(stack.pullRequests[0]?.repository.nameWithOwner)"
            :now="now"
            :selected="selected"
            :checked="checked"
            :half-checked="halfChecked"
            :expanded="expanded"
            :opened-id="openedId"
            @toggle="toggleStack"
          >
            <template #fields>
              <ProjectEntryFields
                :items="nested.map(member => member.value.item)"
                :fields="shownFields"
              />
            </template>
          </StackRow>
          <ItemRow
            v-else-if="entry.value.content"
            :item="entry.value.content"
            :parent="parent?.value.content"
            :repository-tracked="isTracked(entry.value.content.repository.nameWithOwner)"
            :properties="itemProperties"
            people="assignees"
            :viewer-login="viewerLogin"
            :now="now"
            :checked="checked"
            :undone="undone.get(entry.id)"
            :stack="stackMarker"
          >
            <template #fields>
              <ProjectEntryFields
                :items="[entry.value.item]"
                :fields="shownFields"
              />
            </template>
          </ItemRow>
          <ProjectDraft
            v-else
            :item="entry.value.item"
            :fields="shownFields"
            :people="itemProperties.includes('people')"
            layout="row"
            :checked="checked"
          />
        </template>
        <template
          #card="{ entry, checked, halfChecked, stack, stackMarker, expanded, selectedMember, toggleStack, openMember }"
        >
          <StackCard
            v-if="stack"
            :stack="stack"
            :properties="itemProperties"
            :now="now"
            :checked="checked"
            :half-checked="halfChecked"
            :opened-id="openedId"
            :expanded="expanded"
            :selected-member="selectedMember"
            @toggle="toggleStack"
            @open="openMember"
          />
          <ItemCard
            v-else-if="entry.value.content"
            :item="entry.value.content"
            :properties="itemProperties"
            people="assignees"
            :viewer-login="viewerLogin"
            :now="now"
            :checked="checked"
            :undone="undone.get(entry.id)"
            :stack="stackMarker"
          >
            <template #fields>
              <ProjectEntryFields
                :items="[entry.value.item]"
                :fields="shownFields"
              />
            </template>
          </ItemCard>
          <ProjectDraft
            v-else
            :item="entry.value.item"
            :fields="shownFields"
            :people="itemProperties.includes('people')"
            layout="card"
            :checked="checked"
          />
        </template>
        <template #groupFooter="{ group }">
          <template v-if="draftable">
            <ProjectDraftComposer
              v-if="composing === group.key"
              :group="group.label"
              @add="addDraft($event, group.key)"
              @close="composing = undefined"
            />
            <div
              v-else
              :class="css.projectView_newDraft"
            >
              <Button
                variant="ghost"
                size="sm"
                :icon="SquarePen"
                @click="emit('newIssue', group.key, group.label)"
              >
                {{ t(l.newIssueIn, { group: group.label }) }}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                :icon="Plus"
                @click="composing = group.key"
              >
                {{ t(l.newDraftIn, { group: group.label }) }}
              </Button>
            </div>
          </template>
        </template>
        <template
          v-if="$slots.contextMenu"
          #contextMenu="menu"
        >
          <slot
            name="contextMenu"
            v-bind="menu"
          />
        </template>
      </ListView>
    </template>
  </div>
</template>

<style lang="scss" module="css">
.projectView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.projectView_meta {
  font-size: $font-size-sm;
  color: $color-fg-dim;
  white-space: nowrap;
}

.projectView_metaIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

.projectView_changed {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  padding: 1px 4px 1px 10px;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
  border: 1px solid $color-border-2;
  border-radius: $radius-md;
}

.projectView_deviceNote {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding: $spacing-12 14px;
  font-size: $font-size-2xs;
  line-height: $line-height-normal;
  color: $color-fg-dim;
  background: $color-bg-3;
  border-bottom: 1px solid $color-border;
}

.projectView_deviceTitle {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.projectView_note {
  padding: $spacing-8 $spacing-10;
  margin: $spacing-12 14px 0;
  font-size: $font-size-2xs;
  line-height: $line-height-normal;
  color: $color-fg-2;
  background: $color-bg-2;
  border-radius: $radius-md;

  a {
    display: block;
    margin-top: $spacing-4;
    color: $color-fg;
  }
}

.projectView_filter {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-16;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  border-bottom: 1px solid $color-border;
}

.projectView_term {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 1px 8px;
  font-family: $font-family-mono;
  color: $color-fg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-md;
}

.projectView_term_answered {
  color: $color-purple;
  border-color: rgba($color-purple, 0.5);
}

.projectView_roadmap {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.projectView_sortSummary {
  white-space: nowrap;
}

.projectView_filteredOut {
  flex: none;
}

.projectView_newDraft {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2;
  margin: $spacing-4 $spacing-12 $spacing-8 $spacing-24;
}
</style>
