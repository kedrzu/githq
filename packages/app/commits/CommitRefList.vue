<!-- A repository's branches and tags beside its commit graph (git-client D15, CH3, CH10, CH15–CH17): the default branch first, then branches and tags, each newest first — the newest of each drawn and the rest counted, however many there are. Typing in its filter narrows both groups by name, the best match selected; ↑/↓ move through the matches; `Enter` or a click chooses one; `Esc` clears the filter and leaves. A branch's row shows the pull request and CI of its tip; a tag's only its age. The combobox is its own rather than `FilterList`: nothing is selected until the filter is used, each group has its count and its own note, and the field is `SearchField` with its key -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { GitBranch, Tag } from 'lucide-vue-next';
import { computed, ref, useId, useTemplateRef, watch } from 'vue';

import SearchField from '@/components/SearchField.vue';
import { compareText } from '@/utils/compareText.js';
import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';
import { formatAge } from '@/utils/formatAge.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';

import { CommitGraphStore } from './CommitGraphStore.js';
import * as l from './CommitRefList.loc.js';
import CommitStateMarks from './CommitStateMarks.vue';
import type { CommitRef, KeptCommitRefs } from './CommitTypes.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  refs: KeptCommitRefs;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** A branch or tag chosen: by `Enter` or a click. */
  choose: [ref: CommitRef];
  /** `Esc`: the user is done with the list, its filter cleared. */
  leave: [];
}>();

interface RefRow {
  /** Unique in the list; a branch and a tag may share a name. */
  readonly key: string;
  readonly kind: 'branch' | 'default' | 'tag';
  readonly ref: CommitRef;
}

interface RefGroup {
  readonly key: string;
  /** `null`: the default branch's own group, above the headings. */
  readonly title: string | null;
  readonly count: number;
  readonly newestFirst: boolean;
  readonly rows: readonly RefRow[];
  /** A quiet line under the rows: how many more there are, or that none match. */
  readonly note: string | null;
}

interface RefGroupParams {
  readonly key: 'branches' | 'tags';
  readonly title: string;
  /** Its rows past the filter, newest first. */
  readonly matching: readonly RefRow[];
  readonly count: number;
  /** What it says when a filter leaves it none. */
  readonly noMatch: string;
}

/** How many rows of each group are drawn: a repository can have hundreds, and typing finds the rest. */
const SHOWN_PER_GROUP = 20;
/** From how many matches the order is worth saying (CH15, CH17). */
const NEWEST_FIRST_MATCHES = 3;

const store = useService(CommitGraphStore);
const t = useTranslate();
const listId = useId();
const rowIdPrefix = useId();

const field = useTemplateRef<InstanceType<typeof SearchField>>('field');
const scroller = useTemplateRef<HTMLElement>('scroller');
const query = ref('');
/** The row ↑/↓ last moved to, until the filter changes. */
const movedKey = ref<string | null>(null);

const branchRows = computed((): RefRow[] => {
  const { branches, defaultBranch } = props.refs;
  return [
    ...branches.filter(branch => branch.name === defaultBranch).map(branch => toRow('default', branch)),
    ...getNewestFirst(branches.filter(branch => branch.name !== defaultBranch)).map(branch => toRow('branch', branch)),
  ];
});
const tagRows = computed(() => getNewestFirst(props.refs.tags).map(tag => toRow('tag', tag)));
/** The names ready to search, all of them, whatever is drawn. */
const preparedRows = computed(() => prepareMatchTexts([...branchRows.value, ...tagRows.value], row => [row.ref.name]));
const filtering = computed(() => query.value.trim() !== '');
/** How well each row matches the filter; every row while nothing is typed. */
const scores = computed(() => {
  const found = new Map<RefRow, number>();
  for (const { row, score } of findMatches(query.value, preparedRows.value)) {
    found.set(row, score);
  }

  return found;
});
const groups = computed((): RefGroup[] => {
  const matchingBranches = branchRows.value.filter(row => scores.value.has(row));
  const matchingTags = tagRows.value.filter(row => scores.value.has(row));
  const shown: RefGroup[] = [];
  const defaultRow = branchRows.value.find(row => row.kind === 'default');
  if (!filtering.value && defaultRow) {
    shown.push({
      key: 'default',
      title: null,
      count: 1,
      newestFirst: false,
      rows: [defaultRow],
      note: null,
    });
  }

  if (branchRows.value.length > 0) {
    shown.push(
      toGroup({
        key: 'branches',
        title: t(l.branches),
        // The default branch counts among them (CH10), and sits above them until a filter narrows the list (CH15).
        matching: filtering.value ? matchingBranches : matchingBranches.filter(row => row.kind !== 'default'),
        count: matchingBranches.length,
        noMatch: t(l.noBranchMatches, { query: query.value.trim() }),
      }),
    );
  }

  if (tagRows.value.length > 0) {
    shown.push(
      toGroup({
        key: 'tags',
        title: t(l.tags),
        matching: matchingTags,
        count: matchingTags.length,
        noMatch: t(l.noTagMatches, { query: query.value.trim() }),
      }),
    );
  }

  return shown;
});
const shownRows = computed(() => groups.value.flatMap(group => group.rows));
/** The selected row: the one moved to; else, filtering, the best match and the top one of equals; else none. */
const selectedKey = computed(() => {
  const rows = shownRows.value;
  if (rows.some(row => row.key === movedKey.value)) {
    return movedKey.value;
  }

  if (filtering.value) {
    let best: RefRow | null = null;
    for (const row of rows) {
      if (best === null || (scores.value.get(row) ?? 0) > (scores.value.get(best) ?? 0)) {
        best = row;
      }
    }

    return best?.key ?? null;
  }

  return null;
});
const selectedRowId = computed(() => {
  const index = shownRows.value.findIndex(row => row.key === selectedKey.value);
  return index === -1 ? undefined : `${rowIdPrefix}-${index}`;
});

watch(query, () => {
  movedKey.value = null;
});

// The selection stays in view.
watch(
  selectedKey,
  () => {
    scroller.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  },
  { flush: 'post' },
);

// The tips of the branch rows drawn ask for their pull request and CI state: a few dozen at most, so all of them.
const tipOids = computed(() => [...new Set(shownRows.value.filter(row => row.kind !== 'tag').map(row => row.ref.oid))]);
watch(
  () => tipOids.value.join(' '),
  () => {
    if (tipOids.value.length > 0) {
      store.ensureStates(props.nameWithOwner, tipOids.value);
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
  if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
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
        choose(selected);
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

function choose(row: RefRow) {
  movedKey.value = row.key;
  emit('choose', row.ref);
}

function leave() {
  query.value = '';
  movedKey.value = null;
  emit('leave');
}

function getNewestFirst(refs: readonly CommitRef[]) {
  return refs.toSorted((a, b) => compareText(b.committedDate, a.committedDate) || compareText(a.name, b.name));
}

function toRow(kind: RefRow['kind'], commitRef: CommitRef): RefRow {
  return { key: `${kind === 'tag' ? 'tag' : 'branch'}:${commitRef.name}`, kind, ref: commitRef };
}

function toGroup(group: RefGroupParams): RefGroup {
  const rows = getShownRows(group.matching);
  const more = group.matching.length - rows.length;
  return {
    key: group.key,
    title: group.title,
    count: group.count,
    newestFirst: !filtering.value || group.count >= NEWEST_FIRST_MATCHES,
    rows,
    note: getNote(group, more),
  };
}

/** The best matches of a group, the newest among equals, in the list's order: typing an old tag's name finds it. */
function getShownRows(matching: readonly RefRow[]) {
  const best = new Set(
    matching.toSorted((a, b) => (scores.value.get(b) ?? 0) - (scores.value.get(a) ?? 0)).slice(0, SHOWN_PER_GROUP),
  );
  return matching.filter(row => best.has(row));
}

function getNote(group: RefGroupParams, more: number) {
  if (filtering.value && group.count === 0) {
    return group.noMatch;
  }

  if (more === 0) {
    return null;
  }

  if (filtering.value) {
    return t(l.moreMatches, { count: more });
  }

  return group.key === 'tags' ? t(l.moreTags, { count: more }) : t(l.moreBranches, { count: more });
}

function getRowId(row: RefRow) {
  return `${rowIdPrefix}-${shownRows.value.indexOf(row)}`;
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
        kbd="B"
        :listbox="{ id: listId, activeId: selectedRowId }"
      />
    </div>
    <div
      :id="listId"
      ref="scroller"
      :class="css.commitRefList_rows"
      role="listbox"
      :aria-label="t(l.title)"
    >
      <div
        v-for="group in groups"
        :key="group.key"
        role="group"
        :aria-label="group.title ?? t(l.defaultGroup)"
      >
        <div
          v-if="group.title"
          :class="css.commitRefList_head"
        >
          <span>{{ group.title }}</span>
          <span :class="css.commitRefList_count">{{ group.count }}</span>
          <span
            v-if="group.newestFirst"
            :class="css.commitRefList_order"
            >{{ t(l.newestFirst) }}</span
          >
        </div>
        <!-- `mousedown.prevent`: a click leaves the focus where it was, so the graph's keys go on working after it. -->
        <div
          v-for="row in group.rows"
          :id="getRowId(row)"
          :key="row.key"
          :class="[css.commitRefList_row, row.key === selectedKey && css.commitRefList_row_selected]"
          role="option"
          :aria-selected="row.key === selectedKey"
          @mousedown.prevent
          @click="choose(row)"
        >
          <component
            :is="row.kind === 'tag' ? Tag : GitBranch"
            :class="css.commitRefList_icon"
            aria-hidden="true"
          />
          <span
            :class="css.commitRefList_name"
            :title="row.ref.name"
            >{{ row.ref.name }}</span
          >
          <span
            v-if="row.kind === 'default'"
            :class="css.commitRefList_badge"
            >{{ t(l.defaultBadge) }}</span
          >
          <CommitStateMarks
            v-if="row.kind !== 'tag'"
            :state="store.getState(nameWithOwner, row.ref.oid)"
            :with-pull-request="row.kind !== 'default'"
          />
          <time
            :class="css.commitRefList_age"
            :datetime="row.ref.committedDate"
            >{{ formatAge(Date.parse(row.ref.committedDate), now) }}</time
          >
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
  flex: none;
  flex-direction: column;
  width: 280px;
  min-height: 0;
  border-left: 1px solid $color-border;
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
}

.commitRefList_order {
  margin-left: auto;
}

.commitRefList_row {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-5 $spacing-10;
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
