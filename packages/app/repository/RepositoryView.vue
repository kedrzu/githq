<!-- A repository's view (J1–J3, `ui/project.md` "Repository view"; git-client D14, CH1). Its sections, Issues, Pull requests and Commits, and while tracked Workflows, are tabs beside the title on `1`, `2`, `3` and `4`, the first two with their count of open items while tracked. Workflows (actions D6, W3a) counts the broken ones — a dash while that is not known yet, no count with no workflows or with alerts off —; its body is the caller's (`workflows`), under a toolbar without view options. Commits (git-client D10, D11, CH3) has none of the list's tools: its header holds the title, the tabs, the way to its branches and tags (`B`, handled by the graph) and to its history on GitHub — and "not tracked" when it is not, which changes nothing there — over the graph the owner puts in (`commits`). Its sections are also the command menu's, in the group of the repository (on `1`–`4`, with their icons); `AppCommands` offers the rest of that group. Tracked: the section's items from the local copy, with GitHub's own properties, as a List or a Board through the list engine — the state (open by default, closed, both) on the right, moved into the display options last when the toolbar runs out of room; grouped by milestone, assignee, label or, for issues, issue type; under the toolbar the projects its listed items live in, each a way there. Rows show their projects' row fields as in my work (D12); a stack's entry the list was given shows as one — a row (`StackRow`), its pull requests nested under it once expanded, or on the board a card (`StackCard`) listing them inside it once expanded — and a pull request listed alone out of its stack carries its marker. On the board an item can be dragged — or moved with `⇧←`/`⇧→` — to another milestone, label, assignee or issue type when the user may set it (`canMove`); a stack's card moves its pull requests. Not tracked (J3, CH37, `UntrackedView`): githq has only what concerns the user here; it lists that of the section — the same tabs, without counts, a stack's pull requests as one entry — and says so of the section's items: how many others are open on GitHub (their count there less the open ones listed; without a number while GitHub's count is not known), pointing to Settings, and that its commits need no tracking (D20). The `column` layout (git-client D14, CH4–CH6, CH42) moves the name, the way to GitHub, "not tracked", the sections and the projects into a column of the repository's own (`RepositoryColumn`), resizable and of one width on every section (`RepositoryColumnSplit`), the pane staying mounted as the layout changes, and the pane's header holds the section's name and its tools: the list's on Issues and Pull requests, none on Commits, whose list of branches and tags the graph renders in the column (`refListTarget`). -->
<script lang="ts" setup>
import Translate from '@nzyme/vue-i18n/Translate.vue';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowRight,
  ArrowUpRight,
  GitBranch,
  Github,
  Ban,
  BookMarked,
  ListFilter,
  Milestone,
  Shapes,
  SquareKanban,
  Tag,
  User,
} from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import { COMMIT_REF_LIST_TARGET_ID } from '@/commits/CommitTypes.js';
import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import IconButton from '@/components/IconButton.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import type { SelectionSpan } from '@/lists/getSelectionSpan.js';
import { getSelectionSpan } from '@/lists/getSelectionSpan.js';
import ItemCard from '@/lists/ItemCard.vue';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import { ITEM_PROPERTIES } from '@/lists/ItemProperty.js';
import ItemRow from '@/lists/ItemRow.vue';
import type { ItemSort } from '@/lists/ItemSort.js';
import ListToolbar from '@/lists/ListToolbar.vue';
import type { ListToolbarOption } from '@/lists/ListToolbarControl.vue';
import ListTitle from '@/lists/ListTitle.vue';
import type {
  ListChoice,
  ListContextMenuProps,
  ListedItems,
  ListEntry,
  ListMove,
  ListViewOptions,
} from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import StackCard from '@/lists/StackCard.vue';
import StackRow from '@/lists/StackRow.vue';
import { useItemListChoices } from '@/lists/useItemListChoices.js';
import { getSettingsPath } from '@/settings/settingsRoutes.js';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import type { Item } from '@/store/ItemTypes.js';
import NotTrackedChip from '@/tracking/NotTrackedChip.vue';
import { getGitHubUrl, getRepositoryPath } from '@/tracking/trackingRoutes.js';
import UntrackedView from '@/tracking/UntrackedView.vue';
import type { RepositoryLayout } from '@/settings/sync/SettingsDocument.js';

import type { RepositoryList, RepositoryState } from './buildRepositoryList.js';
import { REPOSITORY_STATES } from './buildRepositoryList.js';
import RepositoryColumn from './RepositoryColumn.vue';
import RepositoryColumnSplit from './RepositoryColumnSplit.vue';
import RepositoryMeta from './RepositoryMeta.vue';
import { isItemSection, REPOSITORY_SECTION_ICONS, REPOSITORY_SECTIONS } from './RepositorySection.js';
import type { RepositoryItemSection, RepositorySection } from './RepositorySection.js';
import { REPOSITORY_GROUPINGS, REPOSITORY_VIEW_DEFAULTS } from './repositoryViewOptions.js';
import type { RepositoryGrouping } from './repositoryViewOptions.js';
import * as l from './RepositoryView.loc.js';
import { useRepositoryMeta } from './useRepositoryMeta.js';

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
    /** Tracked: githq keeps its copy. Not: only what concerns the user is in it (J3). */
    tracked: boolean;
    /** The section's list; `null` on Commits, which lists no items. */
    list?: RepositoryList | null;
    /** How many open items each item section holds, on its tab while tracked. */
    openCounts: Readonly<Record<RepositoryItemSection, number>>;
    /** Not tracked: how many open items each item section holds on GitHub; `null` while not known. */
    gitHubOpenCounts?: Readonly<Record<RepositoryItemSection, number>> | null;
    /** The projects the listed items live in, and how many listed items are in none. */
    projects?: readonly RepositoryProjectLink[];
    withoutProject?: number;
    /** The signed-in user. */
    viewerLogin: string;
    /** Epoch ms the rows' ages are counted to. */
    now: number;
    /** The item opened over the list (panel or modal). */
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
    /** The sections as tabs beside the title, or in a column of the repository's own (git-client D14). */
    layout?: RepositoryLayout;
  }>(),
  {
    list: null,
    gitHubOpenCounts: null,
    projects: () => [],
    withoutProject: 0,
    openedId: null,
    isEdited: () => false,
    undone: () => new Map(),
    modified: false,
    canMove: () => false,
    workflowCount: null,
    layout: 'tabs',
  },
);

const emit = defineEmits<{
  open: [id: string];
  listed: [listed: ListedItems];
  /** An item dropped into another group: set its value. */
  move: [move: ListMove];
  /** The view options back to their defaults. */
  reset: [];
  /** On Commits, the header's tool: to the list of branches and tags beside the graph. */
  openRefList: [];
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
  /**
   * The Commits section's body, the commit graph; `refListInColumn` says its branches and tags render in the column,
   * in the element of `COMMIT_REF_LIST_TARGET_ID`, rather than beside it.
   */
  commits?(props: { refListInColumn: boolean }): unknown;
}>();

const t = useTranslate();
const choices = useItemListChoices();

const STATE_LABELS = { open: l.stateOpen, closed: l.stateClosed, all: l.stateAll } as const;
/** Each section's key. */
const SECTION_KEYS: Readonly<Record<RepositorySection, string>> = {
  issues: '1',
  pullRequests: '2',
  commits: '3',
  workflows: '4',
};
/** What each item section says of its items. */
const SECTION_TEXTS = {
  issues: {
    count: l.issueCount,
    liveIn: l.issuesLiveIn,
    nothing: l.nothingIssues,
    noneConcerns: l.noIssueConcerns,
    others: l.otherOpenIssues,
    othersUncounted: l.otherOpenIssuesUncounted,
  },
  pullRequests: {
    count: l.pullRequestCount,
    liveIn: l.pullRequestsLiveIn,
    nothing: l.nothingPullRequests,
    noneConcerns: l.noPullRequestConcerns,
    others: l.otherOpenPullRequests,
    othersUncounted: l.otherOpenPullRequestsUncounted,
  },
} as const;

// An untracked repository's workflows are not read (actions D4): it has no Workflows section.
const sections = computed(() =>
  props.tracked ? REPOSITORY_SECTIONS : REPOSITORY_SECTIONS.filter(value => value !== 'workflows'),
);
const sectionOptions = computed((): SegmentedTabsOption<RepositorySection>[] =>
  sections.value.map(value => ({
    value,
    label: t(l[value]),
    keyshortcuts: SECTION_KEYS[value],
    count: getSectionCount(value),
  })),
);
/** The item section shown; `null` on Commits. */
const itemSection = computed(() => (isItemSection(section.value) ? section.value : null));
const sectionTexts = computed(() => SECTION_TEXTS[itemSection.value ?? 'issues']);
const groupings = computed((): ListChoice<RepositoryGrouping>[] => {
  const group = t(l.fromGitHub);
  const all: ListChoice<RepositoryGrouping>[] = [
    { value: 'none', label: t(l.groupNone), icon: Ban, section: group },
    { value: 'milestone', label: t(l.groupMilestone), icon: Milestone, section: group },
    { value: 'assignee', label: t(l.groupAssignee), icon: User, section: group },
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
    choices: REPOSITORY_STATES.map(value => ({ value, label: t(STATE_LABELS[value]), section: label })),
    value: state.value,
    choose: value => {
      state.value = REPOSITORY_STATES.find(candidate => candidate === value) ?? 'open';
    },
  };
});
const meta = useRepositoryMeta(() => props.isPrivate);
/** Not tracked: what githq has of the section's items (J3, CH37). */
const summary = computed(() => {
  const name = props.nameWithOwner;
  const count = props.list?.count ?? 0;
  return count > 0
    ? t(l.onlyWhatConcerns, { name, what: t(sectionTexts.value.count, { count }) })
    : t(sectionTexts.value.noneConcerns, { name });
});
/** Not tracked: where the section's other open items are — their count on GitHub less the open ones listed here. */
const others = computed(() => {
  const texts = sectionTexts.value;
  const shown = itemSection.value ?? 'issues';
  const onGitHub = props.gitHubOpenCounts?.[shown];
  return onGitHub == null
    ? t(texts.othersUncounted)
    : t(texts.others, { count: Math.max(0, onGitHub - props.openCounts[shown]) });
});
const githubUrl = computed(() => `https://github.com/${props.nameWithOwner}`);
const commitsUrl = computed(() => `${githubUrl.value}/commits`);
const workflowsUrl = computed(() => getGitHubUrl(getRepositoryPath(props.nameWithOwner, 'workflows')));
const columnGitHubUrl = computed(() => {
  switch (section.value) {
    case 'commits':
      return commitsUrl.value;
    case 'workflows':
      return workflowsUrl.value;
    default:
      return githubUrl.value;
  }
});
const inColumn = computed(() => props.layout === 'column');
// A column coming mounts after the pane is updated, and the graph's list must find its place there once told to go.
const refListInColumn = ref(inColumn.value);
watch(
  inColumn,
  value => {
    refListInColumn.value = value;
  },
  { flush: 'post' },
);

useCommands(() =>
  sections.value.map(candidate => ({
    id: `repository.section.${candidate}`,
    title: t(l[candidate]),
    section: 'repository',
    key: SECTION_KEYS[candidate],
    icon: REPOSITORY_SECTION_ICONS[candidate],
    run: () => {
      section.value = candidate;
    },
  })),
);

function getSectionCount(value: RepositorySection) {
  if (value === 'workflows') {
    return props.workflowCount === 'unknown' ? '–' : (props.workflowCount ?? undefined);
  }

  return props.tracked && isItemSection(value) ? props.openCounts[value] : undefined;
}
</script>

<template>
  <div :class="css.repositoryView">
    <RepositoryColumnSplit :shown="inColumn">
      <template #column>
        <RepositoryColumn
          v-model:section="section"
          :name-with-owner="nameWithOwner"
          :is-private="isPrivate"
          :tracked="tracked"
          :sections="sectionOptions"
          :github-url="columnGitHubUrl"
          :projects="itemSection !== null && tracked ? projects : []"
          :without-project="withoutProject"
          :projects-label="t(sectionTexts.liveIn)"
        >
          <template
            v-if="$slots.menu"
            #menu
          >
            <slot name="menu" />
          </template>
          <div
            v-if="section === 'commits'"
            :id="COMMIT_REF_LIST_TARGET_ID"
            :class="css.repositoryView_refList"
          />
        </RepositoryColumn>
      </template>
      <div :class="css.repositoryView_pane">
        <!-- In the column, the section's name alone, where the section has no tools of its own to put beside it. -->
        <header
          v-if="inColumn && section !== 'workflows' && (itemSection === null || !list || !tracked)"
          :class="css.repositoryView_header"
          v-bind="WINDOW_DRAG_REGION"
        >
          <ListTitle :title="t(l[section])" />
        </header>
        <template v-if="section === 'workflows'">
          <ListToolbar
            v-model:options="options"
            :title="inColumn ? t(l.workflows) : nameWithOwner"
            :groupings="groupings"
            :sorts="choices.sorts.value"
            :properties="choices.properties.value"
            :filters="[stateOption]"
            :modified="modified"
            bare
            @reset="emit('reset')"
          >
            <template
              v-if="$slots.menu && !inColumn"
              #titleMenu
            >
              <slot name="menu" />
            </template>
            <template
              v-if="!inColumn"
              #title
            >
              <RepositoryMeta :is-private="isPrivate" />
            </template>
            <SegmentedTabs
              v-if="!inColumn"
              v-model="section"
              :class="css.repositoryView_sections"
              :label="t(l.sections)"
              :options="sectionOptions"
            />
            <template #end>
              <slot name="workflowsHints" />
            </template>
          </ListToolbar>
          <slot name="workflows" />
        </template>
        <!-- Commits (git-client D10, D11): none of the list's tools apply, and tracked or not it shows in full. -->
        <template v-else-if="itemSection === null || !list">
          <header
            v-if="!inColumn"
            :class="css.repositoryView_header"
            v-bind="WINDOW_DRAG_REGION"
          >
            <ListTitle :title="nameWithOwner">
              <template
                v-if="$slots.menu"
                #menu
              >
                <slot name="menu" />
              </template>
            </ListTitle>
            <RepositoryMeta :is-private="isPrivate" />
            <NotTrackedChip v-if="!tracked" />
            <SegmentedTabs
              v-model="section"
              :class="css.repositoryView_sections"
              :label="t(l.sections)"
              :options="sectionOptions"
            />
            <span :class="css.repositoryView_spacer" />
            <Button
              variant="ghost"
              size="sm"
              :icon="GitBranch"
              kbd="B"
              aria-keyshortcuts="B"
              @click="emit('openRefList')"
            >
              {{ t(l.branchesAndTags) }}
            </Button>
            <IconButton
              :icon="Github"
              :label="t(l.openOnGitHub)"
              :link="commitsUrl"
              target="_blank"
            />
          </header>
          <slot
            name="commits"
            :ref-list-in-column="refListInColumn"
          />
        </template>

        <template v-else-if="tracked">
          <ListToolbar
            v-model:options="options"
            :title="inColumn ? t(l[itemSection]) : nameWithOwner"
            :groupings="groupings"
            :sorts="choices.sorts.value"
            :properties="choices.properties.value"
            :filters="[stateOption]"
            :modified="modified"
            @reset="emit('reset')"
          >
            <template
              v-if="$slots.menu && !inColumn"
              #titleMenu
            >
              <slot name="menu" />
            </template>
            <template
              v-if="!inColumn"
              #title
            >
              <RepositoryMeta :is-private="isPrivate" />
            </template>
            <slot
              v-if="checkedIds.length > 0"
              name="selection"
              :ids="checkedIds"
              :span="getSelectionSpan(list.groups, checkedIds)"
            />
            <SegmentedTabs
              v-if="!inColumn"
              v-model="section"
              :class="css.repositoryView_sections"
              :label="t(l.sections)"
              :options="sectionOptions"
            />
          </ListToolbar>

          <nav
            v-if="!inColumn && projects.length > 0"
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
            :groups="list.groups"
            :layout="options.layout"
            :opened-id="openedId"
            :is-edited="isEdited"
            :get-url="item => item.url"
            :can-move="canMove"
            @open="emit('open', $event)"
            @listed="emit('listed', $event)"
            @move="emit('move', $event)"
          >
            <template #row="{ entry, parent, selected, checked, halfChecked, stack, stackMarker }">
              <StackRow
                v-if="stack"
                :stack="stack"
                :properties="properties"
                :repository="nameWithOwner"
                :now="now"
                :selected="selected"
                :checked="checked"
                :half-checked="halfChecked"
                :opened-id="openedId"
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
              #card="{
                entry,
                checked,
                halfChecked,
                stack,
                stackMarker,
                expanded,
                selectedMember,
                toggleStack,
                openMember,
              }"
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
              <EmptyState
                :icon="BookMarked"
                :title="t(l.nothingTitle)"
                :detail="t(sectionTexts.nothing)"
              />
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

        <UntrackedView
          v-else
          v-model:selected-id="selectedId"
          v-model:checked-ids="checkedIds"
          :icon="BookMarked"
          :name="nameWithOwner"
          :meta="meta"
          :github-url="githubUrl"
          :rows="list.groups.flatMap(group => group.rows)"
          :summary="summary"
          :properties="properties"
          :viewer-login="viewerLogin"
          :now="now"
          :opened-id="openedId"
          :is-edited="isEdited"
          :undone="undone"
          :headerless="inColumn"
          @open="emit('open', $event)"
          @listed="emit('listed', $event)"
        >
          <template #controls>
            <SegmentedTabs
              v-model="section"
              :class="css.repositoryView_sections"
              :label="t(l.sections)"
              :options="sectionOptions"
            />
          </template>
          <template #others>
            <p>
              <Translate :t="l.onlyConcernsYou">
                <template #name>{{ nameWithOwner }}</template>
                <template #others>{{ others }}</template>
                <template #settings>
                  <Button
                    variant="link"
                    :link="getSettingsPath('repositories', nameWithOwner)"
                  >
                    {{ t(l.settings) }}
                  </Button>
                </template>
              </Translate>
            </p>
            <!-- D20: the explanation is about the items; Commits needs no tracking. -->
            <p>{{ t(l.commitsNeedNoTracking) }}</p>
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
        </UntrackedView>
      </div>
    </RepositoryColumnSplit>
  </div>
</template>

<style lang="scss" module="css">
.repositoryView {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.repositoryView_pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

// CH6: the column's lower part, where the graph renders its branches and tags.
.repositoryView_refList {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid $color-border;
}

.repositoryView_projectIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

.repositoryView_header {
  @include list-header;
}

.repositoryView_spacer {
  flex: 1;
}

.repositoryView_sections {
  padding-left: $spacing-8;
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

.repositoryView_count {
  font-family: $font-family-mono;
  color: $color-fg-dim;
}
</style>
