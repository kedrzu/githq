<!-- A repository's view (J1–J3, `ui/project.md` "Repository view"). Tracked: its issues and pull requests from the local copy, with GitHub's own properties, as a List or a Board through the list engine — the kind tabs (all, issues, pull requests) beside the title, the state (open by default, closed, both) on the right — moved into the display options last when the toolbar runs out of room; grouped by milestone, assignee, label, issue type or kind; under the toolbar the projects its listed items live in, each a way there. Rows show their projects' row fields as in my work (D12); a stack's entry the list was given shows as one — a row (`StackRow`), its pull requests nested under it once expanded, or on the board a card (`StackCard`) listing them inside it once expanded — and a pull request listed alone out of its stack carries its marker. On the board an item can be dragged — or moved with `⇧←`/`⇧→` — to another milestone, label, assignee or issue type when the user may set it (`canMove`); a stack's card moves its pull requests. Not tracked (J3): githq has only what concerns the user here; it says so, lists that — narrowed by the same kind tabs — and offers to track the repository, after which the rest arrives in place. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  BookMarked,
  EyeOff,
  GitCompareArrows,
  ListFilter,
  Lock,
  Milestone,
  Shapes,
  SquareKanban,
  Tag,
  User,
} from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import ItemCard from '@/lists/ItemCard.vue';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import { ITEM_PROPERTIES } from '@/lists/ItemProperty.js';
import ItemRow from '@/lists/ItemRow.vue';
import type { ItemSort } from '@/lists/ItemSort.js';
import ListToolbar from '@/lists/ListToolbar.vue';
import type { ListToolbarOption } from '@/lists/ListToolbarControl.vue';
import type {
  ListChoice,
  ListContextMenuProps,
  ListEntry,
  ListGroup,
  ListMove,
  ListViewOptions,
} from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import StackCard from '@/lists/StackCard.vue';
import StackRow from '@/lists/StackRow.vue';
import { useItemListChoices } from '@/lists/useItemListChoices.js';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import type { Item } from '@/store/ItemTypes.js';

import type { RepositoryKind, RepositoryList, RepositoryState } from './buildRepositoryList.js';
import { REPOSITORY_KINDS, REPOSITORY_STATES } from './buildRepositoryList.js';
import { REPOSITORY_VIEW_DEFAULTS } from './repositoryViewOptions.js';
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
    /** Tracked: githq keeps its copy. Not: only what concerns the user is in it (J3). */
    tracked: boolean;
    list: RepositoryList;
    /** Its open issues and pull requests, for the title. */
    openCount: number;
    /** The projects the listed items live in, and how many listed items are in none. */
    projects?: readonly RepositoryProjectLink[];
    withoutProject?: number;
    /** The signed-in user. */
    viewerLogin: string;
    /** Epoch ms the rows' ages are counted to. */
    now: number;
    /** The item opened over the list (panel or modal). */
    openedId?: string | null;
    /** What was just undone of an item's edits, by its id. */
    undone?: ReadonlyMap<string, string>;
    /** The view options differ from the defaults. */
    modified?: boolean;
    /** Whether the user may move the item from one group into another (set that milestone, label…). */
    canMove?: (entry: ListEntry<Item>, from: string, to: string) => boolean;
    /** Tracking it was asked for and GitHub shows no such repository. */
    notFound?: boolean;
    /** Tracking it is being asked for. */
    trackBusy?: boolean;
  }>(),
  {
    projects: () => [],
    withoutProject: 0,
    openedId: null,
    undone: () => new Map(),
    modified: false,
    canMove: () => false,
    notFound: false,
    trackBusy: false,
  },
);

const emit = defineEmits<{
  open: [id: string];
  listed: [ids: readonly string[]];
  /** An item dropped into another group: set its value. */
  move: [move: ListMove];
  /** The view options back to their defaults. */
  reset: [];
  /** "Track" (J3). */
  track: [];
}>();

const state = defineModel<RepositoryState>('state', { default: 'open' });
const kind = defineModel<RepositoryKind>('kind', { default: 'all' });
/** The selected item's id. */
const selectedId = defineModel<string | null>('selectedId', { default: null });
/** The items edited together (`x`). */
const checkedIds = defineModel<readonly string[]>('checkedIds', { default: () => [] });
/** Layout, grouping, order and the properties rows show; kept on this device by the page. */
const options = defineModel<ListViewOptions<RepositoryGrouping, ItemSort>>('options', {
  default: () => REPOSITORY_VIEW_DEFAULTS,
});

defineSlots<{
  /** The entries of the menu the title opens (`ListToolbar`'s `titleMenu`). */
  menu?(): unknown;
  /** The actions of the items edited together, while there are any. */
  selection?(props: { ids: readonly string[] }): unknown;
  /** The entries of a row's context menu (`ListView`'s `contextMenu`). */
  contextMenu?(props: ListContextMenuProps): unknown;
}>();

const t = useTranslate();
const choices = useItemListChoices();

const STATE_LABELS = { open: l.stateOpen, closed: l.stateClosed, all: l.stateAll } as const;
const KIND_LABELS = { all: l.all, issues: l.issues, pullRequests: l.pullRequests } as const;

const kindOptions = computed((): SegmentedTabsOption<RepositoryKind>[] =>
  REPOSITORY_KINDS.map(value => ({ value, label: t(KIND_LABELS[value]), count: props.list.counts[value] })),
);
const groupings = computed((): ListChoice<RepositoryGrouping>[] => {
  const section = t(l.fromGitHub);
  return [
    { value: 'none', label: t(l.groupNone), icon: Ban, section },
    { value: 'milestone', label: t(l.groupMilestone), icon: Milestone, section },
    { value: 'assignee', label: t(l.groupAssignee), icon: User, section },
    { value: 'label', label: t(l.groupLabel), icon: Tag, detail: t(l.groupLabelDetail), section },
    { value: 'issueType', label: t(l.groupIssueType), icon: Shapes, section },
    { value: 'kind', label: t(l.groupKind), icon: GitCompareArrows, section },
  ];
});
const properties = computed(() => {
  const shown = options.value.properties;
  return ITEM_PROPERTIES.filter((property): property is ItemProperty => shown.includes(property));
});
/** The state as a filter of the toolbar: on it while it fits, else in the display options. */
const stateOption = computed((): ListToolbarOption => {
  const section = t(l.state);
  return {
    kind: 'menu',
    key: 'state',
    label: section,
    icon: ListFilter,
    title: t(STATE_LABELS[state.value]),
    choices: REPOSITORY_STATES.map(value => ({ value, label: t(STATE_LABELS[value]), section })),
    value: state.value,
    choose: value => {
      state.value = REPOSITORY_STATES.find(candidate => candidate === value) ?? 'open';
    },
  };
});
const meta = computed(() => {
  const parts = props.isPrivate === null ? [] : [t(props.isPrivate ? l.private : l.public)];
  if (props.tracked) {
    parts.push(t(l.openCount, { count: props.openCount }));
  }

  return parts.join(' · ');
});
/** Not tracked: what concerns the user, in one group, as a list. */
const concerning = computed((): ListGroup<Item>[] => {
  const rows = props.list.groups.flatMap(group => group.rows);
  return rows.length > 0 ? [{ key: 'concerns', label: t(l.concernsYou), arrived: true, droppable: false, rows }] : [];
});
const concerningCount = computed(() => concerning.value[0]?.rows.length ?? 0);
const githubUrl = computed(() => `https://github.com/${props.nameWithOwner}`);
</script>

<template>
  <div :class="css.repositoryView">
    <template v-if="tracked">
      <ListToolbar
        v-model:options="options"
        :title="nameWithOwner"
        :groupings="groupings"
        :sorts="choices.sorts.value"
        :properties="choices.properties.value"
        :filters="[stateOption]"
        :modified="modified"
        @reset="emit('reset')"
      >
        <template
          v-if="$slots.menu"
          #titleMenu
        >
          <slot name="menu" />
        </template>
        <template #title>
          <span :class="css.repositoryView_meta">
            <Lock
              v-if="isPrivate"
              :class="css.repositoryView_metaIcon"
              aria-hidden="true"
            />
            {{ meta }}
          </span>
        </template>
        <slot
          v-if="checkedIds.length > 0"
          name="selection"
          :ids="checkedIds"
        />
        <SegmentedTabs
          v-model="kind"
          :class="css.repositoryView_kinds"
          :label="t(l.kinds)"
          :options="kindOptions"
        />
      </ListToolbar>

      <nav
        v-if="projects.length > 0"
        :class="css.repositoryView_projects"
        :aria-label="t(l.liveIn)"
      >
        <span>{{ t(l.liveIn) }}</span>
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
            :class="css.repositoryView_metaIcon"
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
        :get-url="item => item.url"
        :can-move="canMove"
        @open="emit('open', $event)"
        @listed="emit('listed', $event)"
        @move="emit('move', $event)"
      >
        <template #row="{ entry, parent, checked, stack, stackMarker }">
          <StackRow
            v-if="stack"
            :stack="stack"
            :properties="properties"
            :repository="nameWithOwner"
            :now="now"
            :checked="checked"
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
        <template #card="{ entry, checked, stack, stackMarker, expanded, selectedMember, toggleStack, openMember }">
          <StackCard
            v-if="stack"
            :stack="stack"
            :properties="properties"
            :repository="nameWithOwner"
            :now="now"
            :checked="checked"
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
            :detail="t(l.nothingDetail)"
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

    <template v-else>
      <header
        :class="css.repositoryView_header"
        v-bind="WINDOW_DRAG_REGION"
      >
        <BookMarked
          :class="css.repositoryView_headerIcon"
          aria-hidden="true"
        />
        <h1 :class="css.repositoryView_title">{{ nameWithOwner }}</h1>
        <span
          v-if="meta"
          :class="css.repositoryView_meta"
          >{{ meta }}</span
        >
        <span :class="css.repositoryView_badge">
          <EyeOff
            :class="css.repositoryView_metaIcon"
            aria-hidden="true"
          />
          {{ t(l.notTracked) }}
        </span>
        <SegmentedTabs
          v-model="kind"
          :class="css.repositoryView_kinds"
          :label="t(l.kinds)"
          :options="kindOptions"
        />
        <span :class="css.repositoryView_spacer" />
        <Button
          variant="ghost"
          size="sm"
          :icon="ArrowUpRight"
          :link="githubUrl"
          target="_blank"
        >
          {{ t(l.openOnGitHub) }}
        </Button>
      </header>

      <section
        :class="css.repositoryView_callout"
        :aria-label="t(l.notTrackedTitle, { name: nameWithOwner })"
      >
        <EyeOff
          :class="css.repositoryView_calloutIcon"
          aria-hidden="true"
        />
        <div :class="css.repositoryView_calloutText">
          <h2 :class="css.repositoryView_calloutTitle">{{ t(l.notTrackedTitle, { name: nameWithOwner }) }}</h2>
          <p>{{ notFound ? t(l.notFound) : t(l.notTrackedDetail, { count: concerningCount }) }}</p>
        </div>
        <Button
          v-if="!notFound"
          variant="primary"
          :busy="trackBusy"
          @click="emit('track')"
        >
          {{ t(l.track, { name: nameWithOwner }) }}
        </Button>
      </section>

      <div :class="css.repositoryView_concerning">
        <ListView
          v-model:selected-id="selectedId"
          v-model:checked-ids="checkedIds"
          :groups="concerning"
          layout="list"
          :opened-id="openedId"
          :get-url="item => item.url"
          @open="emit('open', $event)"
          @listed="emit('listed', $event)"
        >
          <template #row="{ entry, parent, checked, stack, stackMarker }">
            <StackRow
              v-if="stack"
              :stack="stack"
              :properties="properties"
              :now="now"
              :checked="checked"
            />
            <ItemRow
              v-else
              :item="entry.value"
              :parent="parent?.value"
              :properties="properties"
              :viewer-login="viewerLogin"
              :now="now"
              :checked="checked"
              :undone="undone.get(entry.id)"
              :stack="stackMarker"
            />
          </template>
          <template #card="{ entry, checked }">
            <ItemCard
              :item="entry.value"
              :properties="properties"
              :viewer-login="viewerLogin"
              :now="now"
              :checked="checked"
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
        <p :class="css.repositoryView_note">{{ t(l.othersAfterTracking, { name: nameWithOwner }) }}</p>
      </div>
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

.repositoryView_meta {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  white-space: nowrap;
}

.repositoryView_metaIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

.repositoryView_kinds {
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

.repositoryView_header {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: $list-header-height;
  padding: 0 $spacing-16;
  border-bottom: 1px solid $color-border;
}

.repositoryView_headerIcon {
  flex: none;
  width: 15px;
  height: 15px;
  color: $color-fg-2;
}

.repositoryView_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

.repositoryView_badge {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 1px 8px;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
  border: 1px solid $color-border-2;
  border-radius: 10px;
}

.repositoryView_spacer {
  flex: 1;
}

.repositoryView_callout {
  display: flex;
  flex: none;
  gap: $spacing-16;
  align-items: center;
  padding: $spacing-16 $spacing-24;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;
}

.repositoryView_calloutIcon {
  flex: none;
  box-sizing: content-box;
  width: 18px;
  height: 18px;
  padding: 10px;
  color: $color-fg-2;
  background: $color-bg-3;
  border-radius: $radius-lg;
}

.repositoryView_calloutText {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-4;
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.repositoryView_calloutTitle {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

// The few rows that concern the user, then the note under them, scrolled together.
.repositoryView_concerning {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.repositoryView_note {
  flex: none;
  padding: $spacing-16 $spacing-16 $spacing-24 56px;
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}
</style>
