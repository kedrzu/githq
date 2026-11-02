<!-- A tracked project's view (D4, D5, `ui/project.md`): its saved views from GitHub as tabs (D13), each with its own filter, grouping, order, layout and fields — the filter's terms shown under the toolbar — as a List or a Board through the list engine. A tab changed in githq is marked "modified locally", with "Reset" to GitHub's version; the display options say they stay on this device, and set the project's row field (D12). A view whose filter githq can't evaluate is answered by GitHub: its tab and the term carry a cloud (K6), and until GitHub answers it waits instead of showing the unfiltered items. Rows and cards show the project's fields; draft issues show as drafts; a stack's entry the list was given shows as one — a row (`StackRow`) with the field values its pull requests share (D15), its pull requests nested under it once expanded, or on the board a card (`StackCard`) listing them inside it once expanded — and a pull request listed alone out of its stack carries its marker. With the right to update the project, "New draft" at the end of a group or the bottom of a column writes a draft there, with that group's value; on the board items move between columns by drag or `⇧←`/`⇧→`, a stack's card with all its pull requests. Next to it "New issue" opens the quick capture adding the issue to the project with that group's value (H5). A project with nothing to make columns of offers no board (K7); an empty project (K8) offers to add existing issues (in the command menu), a new issue or a draft; a view nothing matches (K9) says so, with the ways out: all the project's items, or its filter cleared here (a change kept on this device, undone by Reset). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  Ban,
  Cloud,
  CircleCheck,
  FilePlus,
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
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import type { RouteLocationRaw } from 'vue-router';

import { APP_KEYS, NEW_ISSUE_KEY } from '@/commands/CommandRegistry.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import type { SelectionSpan } from '@/lists/getSelectionSpan.js';
import { getSelectionSpan } from '@/lists/getSelectionSpan.js';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import * as propertyLabels from '@/lists/ItemProperty.loc.js';
import ItemCard from '@/lists/ItemCard.vue';
import ItemRow from '@/lists/ItemRow.vue';
import ListToolbar from '@/lists/ListToolbar.vue';
import type { ListToolbarOption } from '@/lists/ListToolbarControl.vue';
import type { ListChoice, ListContextMenuProps, ListEntry, ListGroup, ListMove } from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import StackCard from '@/lists/StackCard.vue';
import StackRow from '@/lists/StackRow.vue';
import type { ProjectField } from '@/store/ItemDetailTypes.js';

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
    undone?: ReadonlyMap<string, string>;
    /** Whether the entry may be moved from one group into another (set the field). */
    canMove?: (entry: ListEntry<ProjectEntry>, from: string, to: string) => boolean;
    /** Where "Show all items" goes when nothing matches the view's filter (K9); `null` where none keeps any out. */
    allItemsTo?: RouteLocationRaw | null;
  }>(),
  {
    allItemsTo: null,
    answeredTerm: null,
    modified: false,
    roadmap: false,
    openedId: null,
    undone: () => new Map(),
    canMove: () => false,
  },
);

const emit = defineEmits<{
  open: [id: string];
  listed: [ids: readonly string[]];
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
  /** "Clear filters here" where nothing matches the view (K9): its filter cleared on this device. */
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
  ...(['status', 'labels', 'milestone', 'people', 'updated'] as const).map(property => ({
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
/** The filter applied: the view's, unless cleared here. */
const filter = computed(() => options.value.filter ?? '');
const filterTerms = computed(() => {
  const applied = filter.value;
  return applied ? (parseProjectFilter(applied) ?? [{ text: applied }]).map(term => term.text) : [];
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
const shownCount = computed(() => {
  const ids = new Set<string>();
  for (const group of props.groups ?? []) {
    for (const row of group.rows) {
      ids.add(row.id);
    }
  }

  return ids.size;
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
    choose: chosen => emit('update:rowFieldId', chosen === NO_ROW_FIELD ? null : chosen),
  };
});
const fieldNames = computed(() => props.project.fields.map(field => `${field.name} (${field.kind})`).join(', '));
const sortSummary = computed(() => {
  const levels = parseProjectSort(props.project, options.value.sort);
  return options.value.sort === MANUAL_SORT || levels.length === 0
    ? t(l.manual)
    : (props.sorts.find(choice => choice.value === options.value.sort)?.label ?? '');
});

function addDraft(title: string, group: string | null) {
  emit('addDraft', title, group);
}
</script>

<template>
  <div :class="css.projectView">
    <ListToolbar
      v-model:options="options"
      :title="project.title"
      :groupings="groupings"
      :sorts="sorts"
      :properties="properties"
      :modified="modified"
      :board-disabled="boardDisabled"
      :extra-options="[rowFieldOption]"
      @reset="emit('reset')"
    >
      <template
        v-if="$slots.menu"
        #titleMenu
      >
        <slot name="menu" />
      </template>
      <template #title>
        <span :class="css.projectView_meta">
          {{ t(l.meta, { owner: project.owner, count: itemCount }) }}
        </span>
      </template>
      <slot
        v-if="checkedIds.length > 0"
        name="selection"
        :ids="checkedIds"
        :span="getSelectionSpan(groups ?? [], checkedIds)"
      />
      <nav
        v-else-if="tabs.length > 0"
        :class="css.projectView_tabs"
        :aria-label="t(l.savedViews)"
      >
        <RouterLink
          v-for="tab in tabs"
          :key="tab.key"
          :to="tab.to"
          :class="[css.projectView_tab, tab.current && css.projectView_tab_current]"
          :aria-current="tab.current ? 'page' : undefined"
        >
          <Cloud
            v-if="tab.answered"
            :class="css.projectView_tabIcon"
            role="img"
            :aria-label="t(l.answeredByGitHub)"
          />
          {{ tab.name }}
          <span
            v-if="tab.modified"
            :class="css.projectView_tabDot"
            role="img"
            :aria-label="t(l.modifiedLocally)"
          />
        </RouterLink>
      </nav>
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
      v-if="view && (filterTerms.length > 0 || roadmap)"
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
      <span :class="css.projectView_spacer" />
      <span :class="css.projectView_sortSummary">{{ t(l.sortedBy, { order: sortSummary }) }}</span>
    </div>

    <!-- K8: nothing in the project at all. -->
    <div
      v-if="itemCount === 0"
      :class="css.projectView_empty"
    >
      <EmptyState
        :icon="SquareKanban"
        :title="t(l.emptyProjectTitle, { project: project.title })"
        :detail="t(l.emptyProjectDetail)"
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
          <div
            v-else
            :class="css.projectView_emptyActions"
          >
            <Button
              variant="secondary"
              :icon="Plus"
              :kbd="APP_KEYS.commandMenu"
              :aria-keyshortcuts="formatAriaKeyShortcuts(APP_KEYS.commandMenu)"
              @click="emit('addItems')"
            >
              {{ t(l.addExistingIssues) }}
            </Button>
            <Button
              variant="secondary"
              :icon="SquarePen"
              :kbd="NEW_ISSUE_KEY"
              :aria-keyshortcuts="NEW_ISSUE_KEY"
              @click="emit('newIssue', null, null)"
            >
              {{ t(l.newIssue) }}
            </Button>
            <Button
              variant="secondary"
              :icon="FilePlus"
              @click="composing = null"
            >
              {{ t(l.newDraft) }}
            </Button>
          </div>
        </template>
      </EmptyState>
    </div>

    <!-- K6: GitHub has not answered the view yet — its items are not the unfiltered ones. -->
    <div
      v-else-if="groups === null"
      :class="css.projectView_empty"
    >
      <EmptyState
        :icon="Loader"
        :title="t(l.askingTitle)"
        :detail="t(l.askingDetail, { term: answeredTerm ?? '' })"
      />
    </div>

    <!-- K9: the view is fine, nothing matches it now. A board keeps its columns, to write a draft into. -->
    <div
      v-else-if="shownCount === 0 && options.layout === 'list'"
      :class="css.projectView_empty"
    >
      <EmptyState
        :icon="CircleCheck"
        tone="good"
        :title="t(l.emptyViewTitle, { view: view?.name ?? project.title })"
        :detail="
          view && filter
            ? t(l.emptyViewDetail, { view: view.name, filter })
            : t(l.emptyViewDetailNoFilter, { view: view?.name ?? project.title })
        "
      >
        <template
          v-if="allItemsTo || filter"
          #action
        >
          <div :class="css.projectView_emptyActions">
            <Button
              v-if="allItemsTo"
              variant="secondary"
              :link="allItemsTo"
            >
              {{ t(l.showAllItems) }}
            </Button>
            <Button
              v-if="filter"
              variant="secondary"
              @click="emit('clearFilter')"
            >
              {{ t(l.clearFilters) }}
            </Button>
          </div>
        </template>
      </EmptyState>
    </div>

    <template v-else>
      <p
        v-if="shownCount === 0"
        :class="css.projectView_nothing"
      >
        {{
          view && filter
            ? t(l.emptyViewDetail, { view: view.name, filter })
            : t(l.emptyViewDetailNoFilter, { view: view?.name ?? project.title })
        }}
      </p>
      <ListView
        v-model:selected-id="selectedId"
        v-model:checked-ids="checkedIds"
        :groups="groups"
        :layout="options.layout"
        :opened-id="openedId"
        :get-url="entry => entry.content?.url ?? null"
        :can-move="canMove"
        @open="emit('open', $event)"
        @listed="emit('listed', $event)"
        @move="emit('move', $event)"
      >
        <template #row="{ entry, parent, checked, halfChecked, stack, stackMarker, nested }">
          <StackRow
            v-if="stack"
            :stack="stack"
            :properties="itemProperties"
            :now="now"
            :checked="checked"
            :half-checked="halfChecked"
            :opened-id="openedId"
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

.projectView_tabs {
  display: flex;
  gap: 2px;
  align-items: center;
  min-width: 0;
  padding-left: $spacing-8;
  overflow-x: auto;
}

.projectView_tab {
  @include focus-ring;

  display: inline-flex;
  flex: none;
  gap: 6px;
  align-items: center;
  height: 26px;
  padding: 0 $spacing-10;
  font-size: $font-size-sm;
  color: $color-fg-2;
  text-decoration: none;
  white-space: nowrap;
  border-radius: $radius-md;

  &:hover {
    color: $color-fg;
    background: $color-bg-2;
  }
}

.projectView_tab_current {
  color: $color-fg;
  background: $color-bg-3;
}

.projectView_tabIcon {
  width: 13px;
  height: 13px;
  color: $color-purple;
}

.projectView_tabDot {
  width: 6px;
  height: 6px;
  background: $color-accent;
  border-radius: 50%;
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

.projectView_spacer {
  flex: 1;
}

.projectView_sortSummary {
  white-space: nowrap;
}

.projectView_empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.projectView_emptyActions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  justify-content: center;
}

.projectView_nothing {
  flex: none;
  padding: $spacing-12 $spacing-16 0;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.projectView_newDraft {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2;
  margin: $spacing-4 $spacing-12 $spacing-8 $spacing-24;
}
</style>
