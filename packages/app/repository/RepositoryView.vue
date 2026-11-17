<!-- A repository's view (J1, J2, J5–J7, `ui/project.md` "Repository view"; git-client D14, D25, CH1). Its sections, Issues, Pull requests and Commits, and while tracked Workflows, are tabs beside the title — itself led by a lock or a book, read out as private or public (CH72) — on `1`, `2`, `3` and `4`, `[` and `]` stepping to the previous and next one as shown, wrapping around, each with its tooltip ("Go to issues" and its key) — one menu showing the current one when the header runs out of room (`ListToolbar`), ending in the hint for `[` `]` (CH82) — the first two with their count of open items while tracked, none while those are still arriving (first run and loading D4, D14). Workflows (actions D6, W3a) counts the broken ones — a dash while that is not known yet, no count with no workflows or with alerts off —; its body is the caller's (`workflows`), under a toolbar without view options. Commits (git-client D10, D11, CH3) has none of the list's tools: its header holds the title, the tabs, the way to its branches and tags (`B`, handled by the graph) and to its history on GitHub — and "not tracked" when it is not, which changes nothing there — over the graph the owner puts in (`commits`). Its sections are also the command menu's, in the group of the repository (on `1`–`4`, with their icons); `AppCommands` offers the rest of that group. Issues and Pull requests, tracked or not: the section's items, with GitHub's own properties, as a List or a Board through the list engine — the state (open by default, closed, both) on the right, moved into the display options last when the toolbar runs out of room; it is a command of the command menu too ("Filter by state…", on Issues and Pull requests); grouped by milestone, assignee, author, status (a pull request's stage as its status line tells; an issue open, closed or not planned), label or, for issues, issue type; under the toolbar the projects its listed items live in, each a way there. Rows show their projects' row fields as in my work (D12); a stack's entry the list was given shows as one — a row (`StackRow`), its pull requests nested under it once expanded, or on the board a card (`StackCard`) listing them inside it once expanded — and a pull request listed alone out of its stack carries its marker. On the board an item can be dragged — or moved with `⇧←`/`⇧→` — to another milestone, label, assignee or issue type when the user may set it (`canMove`) — never to another status or author; a stack's card moves its pull requests. Not tracked (J5–J7, D34), read on demand as `status` tells: "not tracked" and how much is read ("120 of 3412") by the title; the next page is asked for (`readMore`) as the list's end comes in reach (`ListEndSentinel`) — with a group collapsed, again after a page only if it added rows on screen, or a collapsed large group would have the whole repository read — and by one button beside the count on the board, whose columns scroll on their own, and while a group is collapsed, whose end may no longer move; a repository GitHub does not show, or one nothing of whose section can be read now, has only its name, "not tracked" and what stands in the way (J7, ES17, D6). Tracked or not, with nothing listed the section says why, first of what holds (first run and loading D6): it can't be read — GitHub won't show it, whatever arrived; GitHub refusing its changes, offline, paused or GitHub failing only for what hasn't arrived, named as the section's items in the state chosen ("fitloop/webapp's closed issues"), not the whole repository (`CantBeRead`, ES16, ES17) — it is still arriving (ghosts), the state hides all it holds, with a way to clear it (`FilteredOut`; counted only while tracked, as an untracked copy holds only what was read), or it holds nothing (`NothingThere`); with rows on screen the status bar alone tells. On a phone (mobile MB32) every header is the phone's top bar with the repository's name — on Issues and Pull requests the list's (`ListToolbar`), its options a sheet from below headed by the section, the state a row of chips there (`ListOptionsSheet`, mobile D36, D46), the sections left to the places panel and the command menu (mobile D53) —, the items a list, never a board, the layout kept for a wider window (`useShownLayout`, mobile D9), and the command line names the section with its open items while tracked ("Issues 142", mobile D17), its menu listing the sections first under the repository's name — Issues and Pull requests with their counts and the one shown checked, Commits and Workflows marked ↗ as leaving for github.com (mobile D21). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import {
  ArrowRight,
  ArrowUpRight,
  GitBranch,
  Github,
  Ban,
  BookMarked,
  CircleDashed,
  ListFilter,
  Lock,
  Milestone,
  PenLine,
  Shapes,
  SquareKanban,
  Tag,
  User,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand, CommandMarks, CommandParts } from '@/commands/CommandTypes.js';
import {
  filterByState,
  findRef,
  goToSection,
  nextTab,
  openOnGitHub,
  previousTab,
} from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import CantBeRead from '@/components/CantBeRead.vue';
import type { CantBeReadCause } from '@/components/CantBeReadCause.js';
import FilteredOut from '@/components/FilteredOut.vue';
import type { HeaderTabsSet } from '@/components/HeaderTabs.vue';
import IconButton from '@/components/IconButton.vue';
import NothingThere from '@/components/NothingThere.vue';
import type { SelectionSpan } from '@/lists/getSelectionSpan.js';
import { getSelectionSpan } from '@/lists/getSelectionSpan.js';
import ItemCard from '@/lists/ItemCard.vue';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import { ITEM_PROPERTIES } from '@/lists/ItemProperty.js';
import ItemRow from '@/lists/ItemRow.vue';
import ListEndSentinel from '@/lists/ListEndSentinel.vue';
import type { ItemSort } from '@/lists/ItemSort.js';
import ListToolbar from '@/lists/ListToolbar.vue';
import type { ListToolbarOption } from '@/lists/ListToolbarControl.vue';
import type {
  ListChoice,
  ListContextMenuProps,
  ListedItems,
  ListEndProps,
  ListEntry,
  ListMove,
  ListViewOptions,
} from '@/lists/ListTypes.js';
import type { ListTitleIcon } from '@/lists/ListTitle.vue';
import ListView from '@/lists/ListView.vue';
import StackCard from '@/lists/StackCard.vue';
import StackRow from '@/lists/StackRow.vue';
import { useItemListChoices } from '@/lists/useItemListChoices.js';
import { useShownLayout } from '@/lists/useShownLayout.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import PhoneTopBar from '@/shell/PhoneTopBar.vue';
import { usePhonePart } from '@/shell/usePhonePart.js';
import type { BrowsedStatus } from '@/repos/BrowsedRepositories.js';
import type { Item } from '@/store/ItemTypes.js';
import NotTrackedChip from '@/tracking/NotTrackedChip.vue';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';

import type { RepositoryList, RepositoryState } from './buildRepositoryList.js';
import { REPOSITORY_STATES } from './buildRepositoryList.js';
import { isItemSection, REPOSITORY_SECTION_ICONS, REPOSITORY_SECTIONS } from './RepositorySection.js';
import type { RepositoryItemSection, RepositorySection } from './RepositorySection.js';
import { REPOSITORY_GROUPINGS, REPOSITORY_VIEW_DEFAULTS } from './repositoryViewOptions.js';
import type { RepositoryGrouping } from './repositoryViewOptions.js';
import * as l from './RepositoryView.loc.js';

/** A project the repository's listed items live in, and the way there. */
export interface RepositoryProjectLink {
  readonly id: string;
  readonly title: string;
  /** How many of the listed items are in it. */
  readonly count: number;
  /** Its view in githq when tracked, else its page on GitHub. */
  readonly to: string;
  readonly external: boolean;
}

const props = withDefaults(
  defineProps<{
    /** `owner/name`. */
    nameWithOwner: string;
    /** `null` while nothing of it is in the local copy to tell. */
    isPrivate: boolean | null;
    /** Tracked: githq keeps its copy. Not: what is listed is read on demand (J5). */
    tracked: boolean;
    /** The section's list; `null` on Commits, which lists no items. */
    list?: RepositoryList | null;
    /** How many open items each item section holds, on its tab while tracked; `null` leaves it out while they arrive. */
    openCounts: Readonly<Record<RepositoryItemSection, number | null>>;
    /** How the reading of the section's state stands while it is read on demand; else `null`. */
    status?: BrowsedStatus | null;
    /** Why what the section lacks can't arrive now, as the page knows it; `null` when nothing stands in its way. */
    cantBeRead?: CantBeReadCause | null;
    /** The projects the listed items live in, and how many listed items are in none. */
    projects?: readonly RepositoryProjectLink[];
    withoutProject?: number;
    /** The signed-in user. */
    viewerLogin: string;
    /** Epoch ms the rows' ages are counted to. */
    now: number;
    /** The item opened over the list, in the panel. */
    openedId?: string | null;
    /** The user has an edit of the item on its way (`ListView`). */
    isEdited?: (id: string) => boolean;
    /** What was just undone of an item's edits, by its id. */
    undone?: ReadonlyMap<string, string>;
    /** The view options differ from the defaults. */
    modified?: boolean;
    /** Whether the user may move the item from one group into another (set that milestone, label…). */
    canMove?: (entry: ListEntry<Item>, from: string, to: string) => boolean;
    /** The Workflows section's count: its broken workflows; `unknown` shows a dash, `null` none. */
    workflowCount?: number | 'unknown' | null;
  }>(),
  {
    list: null,
    status: null,
    cantBeRead: null,
    projects: () => [],
    withoutProject: 0,
    openedId: null,
    isEdited: () => false,
    undone: () => new Map(),
    modified: false,
    canMove: () => false,
    workflowCount: null,
  },
);

const emit = defineEmits<{
  open: [id: string];
  /** Enter on the opened item's row: it expands to its page. */
  expand: [id: string];
  /** `⇧Enter` on a row not open: it opens straight on its page. */
  fullScreen: [id: string];
  listed: [listed: ListedItems];
  /** An item dropped into another group: set its value. */
  move: [move: ListMove];
  /** The view options back to their defaults. */
  reset: [];
  /** On Commits, the header's tool: to the list of branches and tags beside the graph. */
  openRefList: [];
  /** Read on demand: the end of the list came in reach, or the toolbar's button was pressed. */
  readMore: [];
}>();

const state = defineModel<RepositoryState>('state', { default: 'open' });
const section = defineModel<RepositorySection>('section', { default: 'issues' });
/** The selected item's id. */
const selectedId = defineModel<string | null>('selectedId', { default: null });
/** The items edited together (`x`). */
const checkedIds = defineModel<readonly string[]>('checkedIds', { default: () => [] });
/** The section's layout, grouping, order and the properties rows show; kept on this device by the page. */
const options = defineModel<ListViewOptions<RepositoryGrouping, ItemSort>>('options', {
  default: () => REPOSITORY_VIEW_DEFAULTS,
});

defineSlots<{
  /** The entries of the menu the title opens (`ListToolbar`'s `titleMenu`). */
  menu?(): unknown;
  /** The actions of the items edited together, while there are any. */
  selection?(props: { ids: readonly string[]; span: SelectionSpan }): unknown;
  /** The entries of a row's context menu (`ListView`'s `contextMenu`). */
  contextMenu?(props: ListContextMenuProps): unknown;
  /** The Workflows section's body, under the toolbar. */
  workflows?(): unknown;
  /** The Workflows section's key hints, at the toolbar's end. */
  workflowsHints?(): unknown;
  /** The Commits section's body, the commit graph. */
  commits?(): unknown;
}>();

const t = useTranslate();
const choices = useItemListChoices();
const phone = useService(PhoneLayout);
/** What the section's items are drawn as: a list on a phone, whatever the options keep (mobile D9). */
const listLayout = useShownLayout(() => options.value.layout);

const STATE_LABELS = { open: l.stateOpen, closed: l.stateClosed, all: l.stateAll } as const;
/** Each section's tooltip on its tab. */
const SECTION_TOOLTIPS = {
  issues: l.goToIssues,
  pullRequests: l.goToPullRequests,
  commits: l.goToCommits,
  workflows: l.goToWorkflows,
} as const;
/** What each item section says of its items. */
const SECTION_TEXTS = {
  issues: {
    liveIn: l.issuesLiveIn,
    hidden: l.stateHidesIssues,
    hiddenRead: l.stateHidesReadIssues,
    nothing: { open: l.noOpenIssues, closed: l.noClosedIssues, all: l.noIssues },
    nothingFact: { open: l.noOpenIssuesFact, closed: l.noClosedIssuesFact, all: l.noIssuesFact },
    unread: { open: l.openIssuesOf, closed: l.closedIssuesOf, all: l.issuesOf },
  },
  pullRequests: {
    liveIn: l.pullRequestsLiveIn,
    hidden: l.stateHidesPullRequests,
    hiddenRead: l.stateHidesReadPullRequests,
    nothing: { open: l.noOpenPullRequests, closed: l.noClosedPullRequests, all: l.noPullRequests },
    nothingFact: {
      open: l.noOpenPullRequestsFact,
      closed: l.noClosedPullRequestsFact,
      all: l.noPullRequestsFact,
    },
    unread: { open: l.openPullRequestsOf, closed: l.closedPullRequestsOf, all: l.pullRequestsOf },
  },
} as const;

// An untracked repository's workflows are not read (actions D4): it has no Workflows section.
const sections = computed(() =>
  props.tracked ? REPOSITORY_SECTIONS : REPOSITORY_SECTIONS.filter(value => value !== 'workflows'),
);
/** The sections as the header's tabs, each with its icon, key and count. */
const sectionTabs = computed((): HeaderTabsSet => ({
  kind: 'model',
  label: t(l.sections),
  options: sections.value.map(value => ({
    value,
    label: t(l[value]),
    icon: REPOSITORY_SECTION_ICONS[value],
    keyshortcuts: keyOf(goToSection, REPOSITORY_SECTIONS.indexOf(value) + 1),
    tooltip: t(SECTION_TOOLTIPS[value]),
    count: getSectionCount(value),
  })),
  value: section.value,
  choose: value => {
    section.value = sections.value.find(candidate => candidate === value) ?? section.value;
  },
  stepHint: t(l.stepSections),
}));
/** Before the name, inside the title's button (CH72): a lock or a book, read out as private or public; none while unknown. */
const titleIcon = computed((): ListTitleIcon | null => {
  if (props.isPrivate === null) {
    return null;
  }

  return props.isPrivate ? { icon: Lock, label: t(l.private) } : { icon: BookMarked, label: t(l.public) };
});
/** The item section shown; `null` on Commits. */
const itemSection = computed(() => (isItemSection(section.value) ? section.value : null));
const sectionTexts = computed(() => SECTION_TEXTS[itemSection.value ?? 'issues']);
const groupings = computed((): ListChoice<RepositoryGrouping>[] => {
  const group = t(l.fromGitHub);
  const all: ListChoice<RepositoryGrouping>[] = [
    { value: 'none', label: t(l.groupNone), icon: Ban, section: group },
    { value: 'milestone', label: t(l.groupMilestone), icon: Milestone, section: group },
    { value: 'assignee', label: t(l.groupAssignee), icon: User, section: group },
    { value: 'author', label: t(l.groupAuthor), icon: PenLine, section: group },
    { value: 'status', label: t(l.groupStatus), icon: CircleDashed, section: group },
    { value: 'label', label: t(l.groupLabel), icon: Tag, detail: t(l.groupLabelDetail), section: group },
    { value: 'issueType', label: t(l.groupIssueType), icon: Shapes, section: group },
  ];
  return all.filter(choice => REPOSITORY_GROUPINGS[itemSection.value ?? 'issues'].includes(choice.value));
});
const properties = computed(() => {
  const shown = options.value.properties;
  return ITEM_PROPERTIES.filter((property): property is ItemProperty => shown.includes(property));
});
/** The state as a filter of the toolbar: on it while it fits, else in the display options. */
const stateOption = computed((): ListToolbarOption => {
  const label = t(l.state);
  return {
    kind: 'menu',
    key: 'state',
    label,
    icon: ListFilter,
    title: t(STATE_LABELS[state.value]),
    command: filterByState,
    choices: REPOSITORY_STATES.map(value => ({ value, label: t(STATE_LABELS[value]), section: label })),
    value: state.value,
    choose: value => {
      state.value = REPOSITORY_STATES.find(candidate => candidate === value) ?? 'open';
    },
  };
});
/** How much of the section's state is read ("120 of 3412"); `null` before GitHub has said. */
const readCount = computed(() => {
  const total = props.status?.total ?? null;
  return total === null || !props.list
    ? null
    : t(l.readCount, { read: props.list.count, total: Math.max(total, props.list.count) });
});
/**
 * With nothing listed, what stands in the way (D6): GitHub not showing it stands whatever has arrived, as nothing more
 * comes; the others — GitHub refusing a tracked copy's changes too — only for what hasn't, as what has can be trusted
 * while they last, the list keeping its own reason and the status bar telling the rest.
 */
const unreadable = computed(() => {
  const cause = props.cantBeRead;
  return cause && props.list?.count === 0 && (cause.kind === 'hidden' || props.list.arriving) ? cause : null;
});
/**
 * What hasn't arrived, short of a repository GitHub doesn't show: the section's items in the state chosen, not the
 * whole repository — the open ones in, the closed ones on their way, or the other section in.
 */
const unreadThing = computed(() => t(sectionTexts.value.unread[state.value], { repository: props.nameWithOwner }));
/** The state hiding all the section holds, as the note names it. */
const stateIs = computed(() => t(state.value === 'closed' ? l.stateIsClosed : l.stateIsOpen));
/**
 * Not tracked, the same with none of the list's tools (J7, ES17): GitHub not showing it, rows of the copy or not, or
 * nothing of the section held. Holding some, a state that can't be read keeps them, so the user can go back to them.
 */
const unreadableAlone = computed(() => {
  const cause = props.cantBeRead;
  return !props.tracked && cause && (cause.kind === 'hidden' || (unreadable.value && props.list?.held === 0))
    ? cause
    : null;
});
const githubUrl = computed(() => getGitHubUrl(props.nameWithOwner));
const commitsUrl = computed(() => `${githubUrl.value}/commits`);
/** A group of the list is collapsed (`ListView`). */
const someCollapsed = ref(false);

// On a phone the command line names the section with its open items while tracked (mobile D17); Commits and Workflows,
// which a phone hands off to GitHub, none.
// Its menu lists the sections first (mobile D17): Issues and Pull requests with their open items, Commits and Workflows marked
// as leaving for github.com, where the route guard hands a phone off (D21).
usePhonePart(() =>
  itemSection.value
    ? {
        label: t(l[itemSection.value]),
        count: props.tracked ? props.openCounts[itemSection.value] : null,
        parts: getPhoneParts,
      }
    : null,
);

// `1`–`4` go to the sections, `[` and `]` step through them as the tabs show them, wrapping around (CH82); in ⌘K the
// steps would only stand between the sections.
useCommands(() => [
  ...bindSections(() => ({})),
  bindCommand(
    previousTab,
    {
      place: 'repository',
      title: t(l.previousSection),
      section: 'repository',
      menu: false,
      run: () => stepSection(-1),
    },
    t,
  ),
  bindCommand(
    nextTab,
    { place: 'repository', title: t(l.nextSection), section: 'repository', menu: false, run: () => stepSection(1) },
    t,
  ),
]);

/**
 * What moving looks the end of the list up again; the state and the section each read pages of their own. Each page read
 * moves it, but with a group collapsed only one that added rows on screen: a page gone into the collapsed group leaves
 * the end where it was, in reach, and going on would read the whole repository with nothing scrolled.
 */
function getReadPosition({ rowsShown }: ListEndProps) {
  const read = someCollapsed.value ? `shown:${rowsShown}` : `cursor:${props.status?.cursor ?? ''}`;
  return `${section.value}:${state.value}:${read}`;
}

/** Going to each section shown, on its number (`goToSection`), with the marks it has where it is listed. */
function bindSections(getMarks: (candidate: RepositorySection) => CommandMarks): BoundCommand[] {
  return bindCommand(
    goToSection,
    REPOSITORY_SECTIONS.map(candidate =>
      sections.value.includes(candidate)
        ? {
            title: t(l[candidate]),
            section: 'repository',
            icon: REPOSITORY_SECTION_ICONS[candidate],
            run: () => {
              section.value = candidate;
            },
            ...getMarks(candidate),
          }
        : null,
    ),
    t,
  );
}

/** Goes to the section before (`-1`) or after (`1`) the one shown, from the last to the first and back. */
function stepSection(step: number) {
  const all = sections.value;
  const index = all.indexOf(section.value);
  section.value = all[(index + step + all.length) % all.length] ?? section.value;
}

function getPhoneParts(): CommandParts {
  return {
    heading: props.nameWithOwner,
    rows: bindSections(getPhoneMarks).map(command => ({ kind: 'command', command })),
  };
}

/** On a phone Issues and Pull requests say their open items and which is shown; Commits and Workflows leave for GitHub. */
function getPhoneMarks(candidate: RepositorySection): CommandMarks {
  return isItemSection(candidate)
    ? { count: props.tracked ? props.openCounts[candidate] : null, current: candidate === section.value }
    : { external: true };
}

function getSectionCount(value: RepositorySection) {
  if (value === 'workflows') {
    return props.workflowCount === 'unknown' ? '–' : (props.workflowCount ?? undefined);
  }

  return props.tracked && isItemSection(value) ? (props.openCounts[value] ?? undefined) : undefined;
}
</script>

<template>
  <div :class="css.repositoryView">
    <template v-if="section === 'workflows'">
      <ListToolbar
        v-model:options="options"
        :title="nameWithOwner"
        :title-icon="titleIcon"
        :groupings="groupings"
        :sorts="choices.sorts.value"
        :properties="choices.properties.value"
        :filters="[stateOption]"
        :modified="modified"
        :tabs="sectionTabs"
        bare
        @reset="emit('reset')"
      >
        <template
          v-if="$slots.menu"
          #titleMenu
        >
          <slot name="menu" />
        </template>
        <template #end>
          <slot name="workflowsHints" />
        </template>
      </ListToolbar>
      <slot name="workflows" />
    </template>
    <!-- Commits (git-client D10, D11): none of the list's tools apply, and tracked or not it shows in full. -->
    <template v-else-if="itemSection === null || !list">
      <PhoneTopBar
        v-if="phone.active"
        :title="nameWithOwner"
      />
      <ListToolbar
        v-else
        v-model:options="options"
        :title="nameWithOwner"
        :title-icon="titleIcon"
        :groupings="groupings"
        :sorts="choices.sorts.value"
        :properties="choices.properties.value"
        :tabs="sectionTabs"
        bare
      >
        <template
          v-if="$slots.menu"
          #titleMenu
        >
          <slot name="menu" />
        </template>
        <template
          v-if="!tracked"
          #title
        >
          <NotTrackedChip />
        </template>
        <template #end>
          <Button
            variant="ghost"
            size="sm"
            :icon="GitBranch"
            :kbd="keyOf(findRef)"
            :keyshortcuts="keyOf(findRef)"
            @click="emit('openRefList')"
          >
            {{ t(l.branchesAndTags) }}
          </Button>
          <IconButton
            :icon="Github"
            :label="t(openOnGitHub.title)"
            :link="commitsUrl"
            target="_blank"
          />
        </template>
      </ListToolbar>
      <slot name="commits" />
    </template>

    <!-- J7, ES17: nothing of it can be listed, and none of the list's tools apply. -->
    <template v-else-if="unreadableAlone">
      <PhoneTopBar
        v-if="phone.active"
        :title="nameWithOwner"
      />
      <ListToolbar
        v-else
        v-model:options="options"
        :title="nameWithOwner"
        :title-icon="titleIcon"
        :groupings="groupings"
        :sorts="choices.sorts.value"
        :properties="choices.properties.value"
        bare
      >
        <template
          v-if="$slots.menu"
          #titleMenu
        >
          <slot name="menu" />
        </template>
        <template #title>
          <NotTrackedChip />
        </template>
      </ListToolbar>
      <CantBeRead
        place="screen"
        :cause="unreadableAlone"
        :thing="nameWithOwner"
      />
    </template>

    <template v-else>
      <ListToolbar
        v-model:options="options"
        :title="nameWithOwner"
        :title-icon="titleIcon"
        :list-name="t(l[itemSection])"
        :groupings="groupings"
        :sorts="choices.sorts.value"
        :properties="choices.properties.value"
        :filters="[stateOption]"
        :modified="modified"
        :tabs="sectionTabs"
        @reset="emit('reset')"
      >
        <template
          v-if="$slots.menu"
          #titleMenu
        >
          <slot name="menu" />
        </template>
        <template
          v-if="!tracked"
          #title
        >
          <NotTrackedChip />
        </template>
        <template
          v-if="$slots.selection"
          #selection
        >
          <slot
            v-if="checkedIds.length > 0"
            name="selection"
            :ids="checkedIds"
            :span="getSelectionSpan(list.groups, checkedIds)"
          />
        </template>
        <span
          v-if="readCount"
          :class="css.repositoryView_readCount"
          >{{ readCount }}</span
        >
        <!-- The board's columns scroll on their own, and a short one would read everything: a button, not its end. So too
                 with a group collapsed: a page gone into it leaves the end where it was, and reading stops until expanded. -->
        <Button
          v-if="status?.hasMore && (listLayout === 'board' || someCollapsed)"
          variant="outline"
          size="sm"
          @click="emit('readMore')"
        >
          {{ t(status.reading ? l.readingMore : l.readMore) }}
        </Button>
      </ListToolbar>

      <nav
        v-if="projects.length > 0"
        :class="css.repositoryView_projects"
        :aria-label="t(sectionTexts.liveIn)"
      >
        <span>{{ t(sectionTexts.liveIn) }}</span>
        <Button
          v-for="project in projects"
          :key="project.id"
          variant="outline"
          size="sm"
          :icon="SquareKanban"
          :link="project.to"
          :target="project.external ? '_blank' : undefined"
        >
          {{ project.title }}
          <span :class="css.repositoryView_count">{{ project.count }}</span>
          <component
            :is="project.external ? ArrowUpRight : ArrowRight"
            :class="css.repositoryView_projectIcon"
            aria-hidden="true"
          />
        </Button>
        <span v-if="withoutProject > 0">· {{ t(l.inNoProject, { count: withoutProject }) }}</span>
      </nav>

      <ListView
        v-model:selected-id="selectedId"
        v-model:checked-ids="checkedIds"
        :scroll-key="`repository:${nameWithOwner}:${section}`"
        :groups="list.groups"
        :groups-arriving="list.arriving && !unreadable"
        :layout="listLayout"
        :opened-id="openedId"
        :is-edited="isEdited"
        :get-url="item => item.url"
        :can-move="canMove"
        @open="emit('open', $event)"
        @expand="emit('expand', $event)"
        @full-screen="emit('fullScreen', $event)"
        @listed="emit('listed', $event)"
        @move="emit('move', $event)"
        @some-collapsed="someCollapsed = $event"
      >
        <template #row="{ entry, parent, selected, checked, halfChecked, stack, stackMarker, expanded, toggleStack }">
          <StackRow
            v-if="stack"
            :stack="stack"
            :properties="properties"
            :repository="nameWithOwner"
            :now="now"
            :selected="selected"
            :checked="checked"
            :half-checked="halfChecked"
            :expanded="expanded"
            :opened-id="openedId"
            @toggle="toggleStack"
          />
          <ItemRow
            v-else
            :item="entry.value"
            :parent="parent?.value"
            :properties="properties"
            people="assignees"
            :repository="nameWithOwner"
            :viewer-login="viewerLogin"
            :now="now"
            :checked="checked"
            :undone="undone.get(entry.id)"
            :stack="stackMarker"
          />
        </template>
        <template
          #card="{ entry, checked, halfChecked, stack, stackMarker, expanded, selectedMember, toggleStack, openMember }"
        >
          <StackCard
            v-if="stack"
            :stack="stack"
            :properties="properties"
            :repository="nameWithOwner"
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
            v-else
            :item="entry.value"
            :properties="properties"
            people="assignees"
            :repository="nameWithOwner"
            :viewer-login="viewerLogin"
            :now="now"
            :checked="checked"
            :undone="undone.get(entry.id)"
            :stack="stackMarker"
          />
        </template>
        <template #empty>
          <CantBeRead
            v-if="unreadable"
            place="screen"
            :cause="unreadable"
            :thing="unreadable.kind === 'hidden' ? nameWithOwner : unreadThing"
            :plural="unreadable.kind !== 'hidden'"
          />
          <FilteredOut
            v-else-if="list.held > 0"
            :fact="tracked ? t(l.filteredToZeroFact, { total: list.held }) : undefined"
            :detail="
              tracked
                ? t(sectionTexts.hidden, { count: list.held, state: stateIs })
                : t(sectionTexts.hiddenRead, { state: stateIs })
            "
            :clear="() => (state = 'all')"
          />
          <NothingThere
            v-else
            place="screen"
            :icon="BookMarked"
            :title="t(sectionTexts.nothing[state])"
            :fact="t(sectionTexts.nothingFact[state])"
            :detail="t(l.nothingDetail, { repository: nameWithOwner })"
          />
        </template>
        <template
          v-if="status?.hasMore"
          #end="end"
        >
          <ListEndSentinel
            :position="getReadPosition(end)"
            @reach="emit('readMore')"
          >
            <template v-if="status.reading">{{ t(l.readingMore) }}</template>
          </ListEndSentinel>
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
.repositoryView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.repositoryView_projectIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

.repositoryView_projects {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-16;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  border-bottom: 1px solid $color-border;
}

.repositoryView_readCount {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.repositoryView_count {
  font-family: $font-family-mono;
  color: $color-fg-dim;
}
</style>
