<!-- A repository's view (J1–J3, `ui/project.md` "Repository view"). Tracked: its issues and pull requests from the local copy, with GitHub's own properties, as a List or a Board through the list engine — the kind tabs (all, issues, pull requests) beside the title, the state (open by default, closed, both) on the right — moved into the display options last when the toolbar runs out of room; grouped by milestone, assignee, label, issue type or kind; under the toolbar the projects its listed items live in, each a way there. Rows show their projects' row fields as in my work (D12). On the board an item can be dragged — or moved with `⇧←`/`⇧→` — to another milestone, label, assignee or issue type when the user may set it (`canMove`). Not tracked (J3, `UntrackedView`): githq has only what concerns the user here; it lists that — narrowed by the same kind tabs — and says so, pointing to Settings. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  BookMarked,
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
import type { ListChoice, ListContextMenuProps, ListEntry, ListMove, ListViewOptions } from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import { useItemListChoices } from '@/lists/useItemListChoices.js';
import { getSettingsPath } from '@/settings/settingsRoutes.js';
import type { Item } from '@/store/ItemTypes.js';
import UntrackedView from '@/tracking/UntrackedView.vue';

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
  }>(),
  {
    projects: () => [],
    withoutProject: 0,
    openedId: null,
    undone: () => new Map(),
    modified: false,
    canMove: () => false,
  },
);

const emit = defineEmits<{
  open: [id: string];
  listed: [ids: readonly string[]];
  /** An item dropped into another group: set its value. */
  move: [move: ListMove];
  /** The view options back to their defaults. */
  reset: [];
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
/** Not tracked: what githq has of it, by the kind tabs' counts, whichever tab is shown (J3). */
const summary = computed(() => {
  const name = props.nameWithOwner;
  const { issues, pullRequests } = props.list.counts;
  if (issues > 0 && pullRequests > 0) {
    const what = t(l.issuesAndPullRequests, {
      issues: t(l.issueCount, { count: issues }),
      pullRequests: t(l.pullRequestCount, { count: pullRequests }),
    });
    return t(l.onlyWhatConcerns, { name, what });
  }

  if (issues > 0) {
    return t(l.onlyWhatConcerns, { name, what: t(l.issueCount, { count: issues }) });
  }

  if (pullRequests > 0) {
    return t(l.onlyWhatConcerns, { name, what: t(l.pullRequestCount, { count: pullRequests }) });
  }

  return t(l.nothingConcerns, { name });
});
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
        <template #row="{ entry, checked }">
          <ItemRow
            :item="entry.value"
            :properties="properties"
            people="assignees"
            :repository="nameWithOwner"
            :viewer-login="viewerLogin"
            :now="now"
            :checked="checked"
            :undone="undone.get(entry.id)"
          />
        </template>
        <template #card="{ entry, checked }">
          <ItemCard
            :item="entry.value"
            :properties="properties"
            people="assignees"
            :repository="nameWithOwner"
            :viewer-login="viewerLogin"
            :now="now"
            :checked="checked"
            :undone="undone.get(entry.id)"
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
      :others="t(list.counts.all > 0 ? l.othersOnGitHub : l.allOnGitHub)"
      :settings-to="getSettingsPath('repositories', nameWithOwner)"
      :properties="properties"
      :viewer-login="viewerLogin"
      :now="now"
      :opened-id="openedId"
      :undone="undone"
      @open="emit('open', $event)"
      @listed="emit('listed', $event)"
    >
      <template #controls>
        <SegmentedTabs
          v-model="kind"
          :class="css.repositoryView_kinds"
          :label="t(l.kinds)"
          :options="kindOptions"
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
    </UntrackedView>
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
</style>
