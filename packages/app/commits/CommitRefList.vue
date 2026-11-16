<!-- A repository's branches and tags, filling what holds them, left of its commit graph (git-client D15, CH3, CH10, CH15–CH17, CH53): the default branch first, then branches and tags, their names nested by `/` into folders at every level (`buildRefTree`), folded until opened, which folders are unfolded kept per repository on this device (`CommitRefFolders`). Each level draws folders first, then refs, in its group's order — newest first or by name, chosen from the group's heading and kept in the synced settings (`TrackingStore.refSort`, CH60), filtering keeping it — its first 20 entries and a "Show N more" row of its own for the next 20, back to 20 when the filter changes. Typing in its filter narrows both groups by name, every folder holding a match unfolded and counting its matches, the matches under their full names and the best one selected, wherever it sits; ↑/↓ move through folders, "Show more" rows and refs; `Enter` or a click folds or unfolds a folder, shows more or chooses a ref; `Esc` clears the filter and leaves. A branch's row shows the pull request and CI of its tip, the pull request a real link, which a click on takes alone and Tab passes; a tag's only its age. The combobox is its own rather than `FilterList`: nothing is selected until the filter is used, each group has its count and its own note, and the field is `SearchField` with its key. It is ARIA's combobox with a grid popup, for an option can't hold a link: the keys stay in the filter and the selection is a row's name cell — a folder's with `aria-expanded` — the whole row looking selected -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ChevronDown, ChevronRight, ChevronsDown, Folder, FolderOpen, GitBranch, Tag } from 'lucide-vue-next';
import { computed, ref, shallowRef, useId, useTemplateRef, watch } from 'vue';

import { findRef } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import Menu from '@/components/Menu.vue';
import MenuRadioGroup from '@/components/MenuRadioGroup.vue';
import MenuRadioItem from '@/components/MenuRadioItem.vue';
import SearchField from '@/components/SearchField.vue';
import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';
import type { ItemReference } from '@/item/itemRoutes.js';
import { formatAge } from '@/utils/formatAge.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';

import { buildRefTree, flattenRefTree } from './buildRefTree.js';
import type { RefTreeFolder, RefTreeGroup, RefTreeOrder, RefTreeRow } from './buildRefTree.js';
import { CommitGraphStore } from './CommitGraphStore.js';
import { CommitRefFolders } from './CommitRefFolders.js';
import * as l from './CommitRefList.loc.js';
import CommitStateMarks from './CommitStateMarks.vue';
import type { CommitParent, CommitRef, KeptCommitRefs } from './CommitTypes.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  refs: KeptCommitRefs;
  /**
   * The refs are a complete read, not a first open's first pages: only then does unfolding a folder forget the kept
   * folders no longer among them.
   */
  refsComplete: boolean;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** A branch or tag chosen: by `Enter` or a click. */
  choose: [ref: CommitRef];
  /** `Esc`: the user is done with the list, its filter cleared. */
  leave: [];
  /** A plain click on a branch's pull request. */
  openPullRequest: [reference: ItemReference];
}>();

/**
 * A row of the list: a folder, a "Show more" or a ref, as the ref tree draws it, with a key unique in the list — a
 * branch and a tag may share a name, a folder and a ref too.
 */
type ListRow =
  | (Exclude<RefTreeRow, { readonly kind: 'ref' }> & { readonly key: string })
  | (Extract<RefTreeRow, { readonly kind: 'ref' }> & { readonly key: string; readonly refKind: RefKind });

/** `default`: the repository's default branch, which shows no pull request. */
type RefKind = 'branch' | 'default' | 'tag';

interface RefGroup {
  readonly key: string;
  /** `null`: the default branch's own group, above the headings, with no heading and no order of its own. */
  readonly title: string | null;
  readonly count: number;
  /** The ref tree's group it draws, whose order its heading picks. */
  readonly group: RefTreeGroup | null;
  readonly rows: readonly ListRow[];
  /** A quiet line under the rows: that none match. */
  readonly note: string | null;
}

/** While filtering, the best match and how far each level on its way must reach to draw it. */
interface BestMatch {
  readonly key: string;
  /** How many entries each level holding it, by path, must draw to reach it. */
  readonly reach: ReadonlyMap<string, number>;
}

/** How many entries of each level are drawn at first, and how many more each "Show more" draws. */
const SHOWN_PER_LEVEL = 20;
/** The orders a group's heading offers, in the menu's order. */
const ORDERS: readonly RefTreeOrder[] = ['newest', 'name'];

const store = useService(CommitGraphStore);
const folders = useService(CommitRefFolders);
const tracking = useService(TrackingStore);
const t = useTranslate();
const gridId = useId();
const nameIdPrefix = useId();

const field = useTemplateRef<InstanceType<typeof SearchField>>('field');
const scroller = useTemplateRef<HTMLElement>('scroller');
const query = ref('');
/** The row ↑/↓ last moved to, a folder toggled or a "Show more" used, until the filter changes. */
const movedKey = ref<string | null>(null);
/** How many entries a level draws, by its path, once "Show more" was used there; until the filter changes. */
const shownCounts = shallowRef<ReadonlyMap<string, number>>(new Map());

const filtering = computed(() => query.value.trim() !== '');
const defaultRef = computed(() => props.refs.branches.find(branch => branch.name === props.refs.defaultBranch) ?? null);
// The default branch sits alone above the branches until a filter narrows the list, then it is a match like any other (CH15).
const branchTree = computed(() =>
  buildRefTree(
    filtering.value ? props.refs.branches : props.refs.branches.filter(branch => branch !== defaultRef.value),
    'branches',
  ),
);
const tagTree = computed(() => buildRefTree(props.refs.tags, 'tags'));
/** The names ready to search, all of them, whatever is drawn. */
const preparedRefs = computed(() =>
  prepareMatchTexts([...props.refs.branches, ...props.refs.tags], item => [item.name]),
);
/** How well each ref matches the filter; every ref while nothing is typed. */
const scores = computed(() => {
  const found = new Map<CommitRef, number>();
  for (const { row, score } of findMatches(query.value, preparedRefs.value)) {
    found.set(row, score);
  }

  return found;
});
const matches = computed(() => (filtering.value ? new Set(scores.value.keys()) : null));
/** While filtering, the best match, the top one of equals, wherever it sits: its levels reach as far as it. */
const bestMatch = computed((): BestMatch | null => {
  const matching = matches.value;
  if (!matching) {
    return null;
  }

  let best: BestMatch | null = null;
  let bestScore = -1;
  for (const [group, tree] of [
    ['branches', branchTree.value],
    ['tags', tagTree.value],
  ] as const) {
    const rows = flattenRefTree(tree, {
      isUnfolded: () => true,
      shownAt: () => Infinity,
      order: tracking.refSort[group],
      matches: matching,
    });
    // The entries drawn so far at each level on the way to the row, the root's first.
    const levels: { path: string; count: number }[] = [{ path: tree.path, count: 0 }];
    for (const row of rows) {
      levels.length = row.depth + 1;
      const level = levels[row.depth];
      if (level) {
        level.count++;
      }

      if (row.kind === 'folder') {
        levels.push({ path: row.path, count: 0 });
      } else if (row.kind === 'ref' && (scores.value.get(row.ref) ?? 0) > bestScore) {
        bestScore = scores.value.get(row.ref) ?? 0;
        best = {
          key: getRefKey(group, row.ref),
          reach: new Map(levels.map(known => [known.path, known.count])),
        };
      }
    }
  }

  return best;
});
const groups = computed((): RefGroup[] => {
  const shown: RefGroup[] = [];
  const onTop = defaultRef.value;
  if (!filtering.value && onTop) {
    shown.push({
      key: 'default',
      title: null,
      count: 1,
      group: null,
      rows: [
        { kind: 'ref', key: getRefKey('branches', onTop), refKind: 'default', ref: onTop, label: onTop.name, depth: 0 },
      ],
      note: null,
    });
  }

  if (props.refs.branches.length > 0) {
    // The default branch counts among them (CH10).
    shown.push(toGroup('branches', branchTree.value, countMatches(props.refs.branches)));
  }

  if (props.refs.tags.length > 0) {
    shown.push(toGroup('tags', tagTree.value, countMatches(props.refs.tags)));
  }

  return shown;
});
const shownRows = computed(() => groups.value.flatMap(group => group.rows));
/** The selected row: the one moved to; else, filtering, the best match; else none. */
const selectedKey = computed(() => {
  const keys = shownRows.value.map(row => row.key);
  if (movedKey.value !== null && keys.includes(movedKey.value)) {
    return movedKey.value;
  }

  const best = bestMatch.value?.key ?? null;
  return best !== null && keys.includes(best) ? best : null;
});
const selectedNameId = computed(() => {
  const index = shownRows.value.findIndex(row => row.key === selectedKey.value);
  return index === -1 ? undefined : `${nameIdPrefix}-${index}`;
});

watch(query, () => {
  movedKey.value = null;
  shownCounts.value = new Map();
});

// The selection stays in view.
watch(
  selectedKey,
  () => {
    scroller.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  },
  { flush: 'post' },
);

// The tips of the branch rows drawn ask for their pull request and CI state: a few dozen at most, so all of them. A
// branch in a folded folder is not drawn, so it does not ask.
const tips = computed(() => {
  const found: CommitParent[] = [];
  for (const row of shownRows.value) {
    if (row.kind === 'ref' && row.refKind !== 'tag') {
      found.push({ oid: row.ref.oid, id: row.ref.commitId });
    }
  }

  return found;
});
watch(
  () => tips.value.map(tip => tip.oid).join(' '),
  () => {
    if (tips.value.length > 0) {
      store.ensureStates(props.nameWithOwner, tips.value);
    }
  },
  { immediate: true },
);

defineExpose({
  /** Puts the cursor in the filter. */
  focusFilter: () => field.value?.focus(),
  leave,
});

function onKeydown(event: KeyboardEvent) {
  // A key a control took — a heading's sort button opening its menu by Enter, Space or ↓ — is not the list's.
  if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return;
  }

  // Handled keys are marked so, and the graph's and the screen's leave them.
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      move(1);
      return;
    case 'ArrowUp':
      event.preventDefault();
      move(-1);
      return;
    case 'Enter': {
      event.preventDefault();
      const selected = shownRows.value.find(row => row.key === selectedKey.value);
      if (selected) {
        activate(selected);
      }
      return;
    }
    case 'Escape':
      // A layer open over it (a tooltip, a menu) takes the Escape; the filter under it stays.
      if (isLayerOpen()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      leave();
  }
}

function move(by: 1 | -1) {
  const rows = shownRows.value;
  const index = rows.findIndex(row => row.key === selectedKey.value);
  const next = index === -1 ? 0 : Math.max(0, Math.min(rows.length - 1, index + by));
  movedKey.value = rows[next]?.key ?? null;
}

/** `Enter` or a click: a folder folds or unfolds, a "Show more" shows more, a ref is chosen. */
function activate(row: ListRow) {
  switch (row.kind) {
    case 'folder':
      toggleFolder(row.path);
      return;
    case 'more':
      showMore(row.path);
      return;
    case 'ref':
      movedKey.value = row.key;
      emit('choose', row.ref);
      return;
    default:
      assertNever(row);
  }
}

/**
 * Folds or unfolds the folder, the selection staying on it. While filtering every folder holding a match is unfolded
 * whatever is kept, so it does nothing then.
 */
function toggleFolder(path: string) {
  movedKey.value = `folder:${path}`;
  if (filtering.value) {
    return;
  }

  const present = props.refsComplete ? [...getFolderPaths(branchTree.value), ...getFolderPaths(tagTree.value)] : null;
  folders.toggle(props.nameWithOwner, path, present);
}

/** The level draws 20 more; when it then draws all, the selection goes to the first of them. */
function showMore(path: string) {
  const key = `more:${path}`;
  const index = shownRows.value.findIndex(row => row.key === key);
  shownCounts.value = new Map(shownCounts.value).set(path, getShownAt(path) + SHOWN_PER_LEVEL);
  movedKey.value = shownRows.value.some(row => row.key === key) ? key : (shownRows.value[index]?.key ?? null);
}

function leave() {
  query.value = '';
  movedKey.value = null;
  emit('leave');
}

function toGroup(group: RefTreeGroup, tree: RefTreeFolder, count: number): RefGroup {
  const rows = flattenRefTree(tree, {
    isUnfolded: path => folders.isUnfolded(props.nameWithOwner, path),
    shownAt: getShownAt,
    order: tracking.refSort[group],
    matches: matches.value,
  }).map(row => toListRow(group, row));
  const noMatch =
    group === 'tags'
      ? t(l.noTagMatches, { query: query.value.trim() })
      : t(l.noBranchMatches, { query: query.value.trim() });
  return {
    key: group,
    title: group === 'tags' ? t(l.tags) : t(l.branches),
    count,
    group,
    rows,
    note: filtering.value && count === 0 ? noMatch : null,
  };
}

function toListRow(group: RefTreeGroup, row: RefTreeRow): ListRow {
  switch (row.kind) {
    case 'folder':
      return { ...row, key: `folder:${row.path}` };
    case 'more':
      return { ...row, key: `more:${row.path}` };
    case 'ref':
      return { ...row, key: getRefKey(group, row.ref), refKind: getRefKind(group, row.ref) };
    default:
      return assertNever(row);
  }
}

function getRefKind(group: RefTreeGroup, commitRef: CommitRef): RefKind {
  if (group === 'tags') {
    return 'tag';
  }

  return commitRef === defaultRef.value ? 'default' : 'branch';
}

function getRefKey(group: RefTreeGroup, commitRef: CommitRef) {
  return `${group === 'tags' ? 'tag' : 'branch'}:${commitRef.name}`;
}

/** How many entries the level at `path` draws: 20 and 20 more per "Show more", and while filtering up to the best match. */
function getShownAt(path: string) {
  return Math.max(shownCounts.value.get(path) ?? SHOWN_PER_LEVEL, bestMatch.value?.reach.get(path) ?? 0);
}

function countMatches(refs: readonly CommitRef[]) {
  return filtering.value ? refs.filter(item => scores.value.has(item)).length : refs.length;
}

/** Every folder path of the tree, at every level: what pruning the kept folders checks them against. */
function getFolderPaths(tree: RefTreeFolder): string[] {
  return tree.folders.flatMap(folder => [folder.path, ...getFolderPaths(folder)]);
}

function getOrderLabel(order: RefTreeOrder) {
  switch (order) {
    case 'newest':
      return t(l.newestFirst);
    case 'name':
      return t(l.byName);
    default:
      return assertNever(order);
  }
}

/** The sort button's name: which group it sorts, then the order its text says. */
function getSortLabel(group: RefTreeGroup) {
  const order = getOrderLabel(tracking.refSort[group]);
  return group === 'tags' ? t(l.sortTags, { order }) : t(l.sortBranches, { order });
}

function setOrder(group: RefTreeGroup, order: string) {
  const chosen = ORDERS.find(known => known === order);
  if (chosen) {
    tracking.setRefSort(group, chosen);
  }
}

function getNameId(row: ListRow) {
  return `${nameIdPrefix}-${shownRows.value.indexOf(row)}`;
}
</script>

<template>
  <section
    :class="css.commitRefList"
    :aria-label="t(l.title)"
    @keydown="onKeydown"
  >
    <div :class="css.commitRefList_filter">
      <SearchField
        ref="field"
        v-model="query"
        size="sm"
        :class="css.commitRefList_field"
        :label="t(l.filterLabel)"
        :placeholder="t(l.filterPlaceholder)"
        :kbd="keyOf(findRef)"
        :grid="{ id: gridId, activeId: selectedNameId }"
      />
    </div>
    <div
      :id="gridId"
      ref="scroller"
      :class="css.commitRefList_rows"
      role="grid"
      :aria-label="t(l.title)"
    >
      <div
        v-for="group in groups"
        :key="group.key"
        role="rowgroup"
        :aria-label="group.title ?? t(l.defaultGroup)"
      >
        <!-- A row of its own: a group with none left under the filter still holds one, as a rowgroup must. -->
        <div
          v-if="group.title"
          role="row"
        >
          <div
            :class="css.commitRefList_head"
            role="columnheader"
            aria-colspan="3"
          >
            <span>{{ group.title }}</span>
            <span :class="css.commitRefList_count">{{ group.count }}</span>
            <Menu
              v-if="group.group"
              align="end"
            >
              <template #trigger>
                <button
                  type="button"
                  :class="css.commitRefList_sort"
                  :aria-label="getSortLabel(group.group)"
                >
                  {{ getOrderLabel(tracking.refSort[group.group]) }}
                  <ChevronDown
                    :class="css.commitRefList_sortChevron"
                    aria-hidden="true"
                  />
                </button>
              </template>
              <MenuRadioGroup
                :model-value="tracking.refSort[group.group]"
                @update:model-value="setOrder(group.group, $event)"
              >
                <MenuRadioItem
                  v-for="order in ORDERS"
                  :key="order"
                  :value="order"
                >
                  {{ getOrderLabel(order) }}
                </MenuRadioItem>
              </MenuRadioGroup>
            </Menu>
          </div>
        </div>
        <!-- `mousedown.prevent`: a click leaves the focus where it was, so the graph's keys go on working after it. -->
        <div
          v-for="row in group.rows"
          :key="row.key"
          :class="[css.commitRefList_row, row.key === selectedKey && css.commitRefList_row_selected]"
          :style="{ '--commit-ref-list-depth': row.depth }"
          role="row"
          @mousedown.prevent
          @click="activate(row)"
        >
          <span
            :class="[css.commitRefList_iconCell, row.kind === 'folder' && css.commitRefList_iconCell_folder]"
            role="gridcell"
          >
            <template v-if="row.kind === 'folder'">
              <component
                :is="row.unfolded ? ChevronDown : ChevronRight"
                :class="css.commitRefList_chevron"
                aria-hidden="true"
              />
              <component
                :is="row.unfolded ? FolderOpen : Folder"
                :class="css.commitRefList_icon"
                aria-hidden="true"
              />
            </template>
            <ChevronsDown
              v-else-if="row.kind === 'more'"
              :class="css.commitRefList_icon"
              aria-hidden="true"
            />
            <component
              :is="row.refKind === 'tag' ? Tag : GitBranch"
              v-else
              :class="css.commitRefList_icon"
              aria-hidden="true"
            />
          </span>
          <span
            v-if="row.kind === 'folder'"
            :id="getNameId(row)"
            :class="[css.commitRefList_name, css.commitRefList_name_folder]"
            role="gridcell"
            aria-colspan="2"
            :aria-selected="row.key === selectedKey"
            :aria-expanded="row.unfolded"
          >
            <!-- The spaces between are what a screen reader hears between the words: "release 3 refs". -->
            <span :class="css.commitRefList_folderName">{{ row.name }}</span> <span :class="css.commitRefList_count">{{
              row.count
            }}</span> <span :class="css.commitRefList_hidden">{{
              t(filtering ? l.folderMatches : l.folderRefs, { count: row.count })
            }}</span>
          </span>
          <span
            v-else-if="row.kind === 'more'"
            :id="getNameId(row)"
            :class="[css.commitRefList_name, css.commitRefList_more]"
            role="gridcell"
            aria-colspan="2"
            :aria-selected="row.key === selectedKey"
            >{{ t(l.showMore, { count: row.hidden }) }}</span
          >
          <template v-else>
            <span
              :id="getNameId(row)"
              :class="css.commitRefList_name"
              :title="row.ref.name"
              role="gridcell"
              :aria-selected="row.key === selectedKey"
              >{{ row.label }}</span
            >
            <span
              :class="css.commitRefList_about"
              role="gridcell"
            >
              <span
                v-if="row.refKind === 'default'"
                :class="css.commitRefList_badge"
                >{{ t(l.defaultBadge) }}</span
              >
              <CommitStateMarks
                v-if="row.refKind !== 'tag'"
                :state="store.getState(nameWithOwner, row.ref.oid)"
                :with-pull-request="row.refKind !== 'default'"
                linked
                link-out-of-tab-order
                @open-pull-request="emit('openPullRequest', $event)"
              />
              <time
                :class="css.commitRefList_age"
                :datetime="row.ref.committedDate"
                >{{ formatAge(Date.parse(row.ref.committedDate), now) }}</time
              >
            </span>
          </template>
        </div>
        <p
          v-if="group.note"
          :class="css.commitRefList_note"
        >
          {{ group.note }}
        </p>
      </div>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.commitRefList {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.commitRefList_filter {
  flex: none;
  padding: $spacing-10 $spacing-10 $spacing-6;
}

.commitRefList_field {
  --search-field-background: #{$color-bg-2};
}

.commitRefList_rows {
  flex: 1;
  min-height: 0;
  padding-bottom: $spacing-8;
  overflow-y: auto;

  // Browsers let a scrolled area take the focus by Tab.
  @include focus-ring;
}

.commitRefList_head {
  display: flex;
  gap: $spacing-8;
  align-items: baseline;
  padding: $spacing-12 $spacing-10 $spacing-4;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.commitRefList_count {
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.commitRefList_sort {
  display: inline-flex;
  gap: $spacing-2;
  align-items: center;
  // Lower than the heading's line, so the row is no taller for it (CH60).
  padding: 0 $spacing-4 0 $spacing-6;
  margin-left: auto;
  font: inherit;
  font-size: $font-size-2xs;
  line-height: $line-height-tight;
  color: $color-fg-2;
  cursor: pointer;
  background: none;
  border: 1px solid $color-border;
  border-radius: $radius-sm;

  &:hover,
  &[data-state='open'] {
    color: $color-fg;
    border-color: $color-border-2;
  }

  @include focus-ring;
}

.commitRefList_sortChevron {
  flex: none;
  width: 12px;
  height: 12px;
}

.commitRefList_row {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-5 $spacing-10;
  // A level deeper sits a chevron and its gap further in: a folder's refs have their icon under the folder's icon.
  padding-left: calc(#{$spacing-10} + var(--commit-ref-list-depth, 0) * #{$spacing-16});
  margin: 0 $spacing-4;
  cursor: default;
  border-radius: $radius-md;

  &:hover {
    background: $color-bg-2;
  }
}

.commitRefList_row_selected,
.commitRefList_row_selected:hover {
  background: $color-sel;
}

.commitRefList_iconCell,
.commitRefList_about {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
}

.commitRefList_iconCell_folder {
  gap: $spacing-4;
}

.commitRefList_chevron {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.commitRefList_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.commitRefList_name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  line-height: 16px;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commitRefList_name_folder {
  display: flex;
  gap: $spacing-6;
  align-items: baseline;
}

.commitRefList_folderName {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.commitRefList_hidden {
  @include visually-hidden;
}

.commitRefList_more {
  font-family: inherit;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.commitRefList_badge {
  flex: none;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.commitRefList_age {
  flex: none;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.commitRefList_note {
  padding: $spacing-5 $spacing-10;
  margin: 0;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
