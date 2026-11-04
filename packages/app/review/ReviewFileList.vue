<!-- The review's list of files (CR46): how many and how many are viewed, the filter (D11, CR27, CR28) with its toggle to a regular expression, the eye hiding viewed files from it and from the diff (D9), then the files in GitHub's tree order, those at the root first and each folder's under a quiet label; while a filter is on, flat and each followed by its folder (D27). Each says its open threads, a click on them landing on the first. A click on one jumps to it; ⇧click selects a range and ⌘/Ctrl+click adds one (D10), the bar at the foot acting on what is selected (CR23). A pull request with more files than GitHub lists pins what's missing under the rows (CR66). Esc in the filter clears it and leaves, Enter leaves. It scrolls with the column it sits in (`ReviewView`), its head pinned at the column's top, under the stack's bar when there is one (`--review-file-list-top`, D25), and what's at its foot pinned there. It follows the file the diff is at, keeping its row in view clear of both. Up to 3000 rows, drawn whole: the browser skips laying out those off screen. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { EyeOff, Folder, ListFilter, Regex } from 'lucide-vue-next';
import { computed, nextTick, useTemplateRef, watch } from 'vue';

import Button from '@/components/Button.vue';
import Kbd from '@/components/Kbd.vue';
import SearchField from '@/components/SearchField.vue';
import { isLayerOpen } from '@/utils/isLayerOpen.js';

import type { ReviewFileGroup } from './groupReviewFiles.js';
import * as l from './ReviewFileList.loc.js';
import ReviewFileRow from './ReviewFileRow.vue';
import type { ReviewFile, ReviewFileCollapse, ReviewFileCollapseReason, ReviewFileState } from './ReviewFiles.js';
import ReviewToggle from './ReviewToggle.vue';

const props = defineProps<{
  /** What shows: without the viewed files when those are hidden. */
  groups: readonly ReviewFileGroup[];
  /** All of them, for the counts. */
  files: readonly ReviewFile[];
  getState: (path: string) => ReviewFileState;
  getCollapse: (path: string) => ReviewFileCollapse | null;
  getCollapseReason: (path: string) => ReviewFileCollapseReason | null;
  /** The file the diff is at. */
  currentPath: string | null;
  /** How many files the pull request really has, once known: GitHub lists at most 3000. */
  changedFiles: number | null;
  /** Whether `groups` is all GitHub lists: until then the rest is on its way, not beyond what it lists. */
  listComplete: boolean;
  /** How many files the filter matches; `null` while none is on. The list then goes flat. */
  matched: number | null;
  /** The regular expression doesn't compile: the list stays as it was (CR28). */
  filterInvalid: boolean;
  /** The files selected together. */
  selected: ReadonlySet<string>;
  /** The files GitHub took the viewed mark off since the last visit (D35). */
  lostViewed?: ReadonlySet<string>;
  /** How many of a file's threads are unresolved, by its path. */
  openThreads?: ReadonlyMap<string, number>;
  /** How many threads a file has when all of them are resolved, by its path. */
  resolvedThreads?: ReadonlyMap<string, number>;
}>();

const emit = defineEmits<{
  select: [path: string];
  /** A click on a file's open threads. */
  selectThreads: [path: string];
  /** ⇧click. */
  selectRange: [path: string];
  /** ⌘/Ctrl+click. */
  toggleSelected: [path: string];
  markSelected: [];
  clearSelection: [];
  /** Esc or Enter in the filter: the keys go back to the diff. */
  leaveFilter: [];
}>();

const hideViewed = defineModel<boolean>('hideViewed', { required: true });
const filterPattern = defineModel<string>('filterPattern', { required: true });
const filterRegex = defineModel<boolean>('filterRegex', { required: true });

const t = useTranslate();
const rows = useTemplateRef<HTMLElement>('rows');
const head = useTemplateRef<HTMLElement>('head');
const foot = useTemplateRef<HTMLElement>('foot');
const filterField = useTemplateRef<InstanceType<typeof SearchField>>('filterField');

const listed = computed(() => props.files.length);
const viewed = computed(() => props.files.filter(file => file.viewed === 'VIEWED').length);
const hasMore = computed(() => props.changedFiles !== null && props.changedFiles > listed.value);
const flat = computed(() => props.matched !== null);
const allSelectedViewed = computed(() =>
  props.files.every(file => !props.selected.has(file.path) || file.viewed === 'VIEWED'),
);

watch(
  () => props.currentPath,
  async () => {
    await nextTick();
    const row = rows.value?.querySelector<HTMLElement>('[aria-current="true"]');
    if (row) {
      // What's pinned covers the rows scrolled under it: a row there isn't in view.
      row.style.scrollMarginTop = `calc(var(--review-file-list-top, 0px) + ${head.value?.offsetHeight ?? 0}px)`;
      row.style.scrollMarginBottom = `${foot.value?.offsetHeight ?? 0}px`;
      row.scrollIntoView({ block: 'nearest' });
    }
  },
  { immediate: true },
);

defineExpose({
  /** Puts the cursor in the filter. */
  focusFilter: () => filterField.value?.focus(),
});

/** One still undecided shows as open, spinner and all, until `.gitattributes` says (D35). */
function isCollapsed(path: string) {
  const collapse = props.getCollapse(path);
  return collapse !== null && collapse !== 'undecided';
}

function onRowClick(path: string, event: MouseEvent) {
  if (event.shiftKey) {
    emit('selectRange', path);
  } else if (event.metaKey || event.ctrlKey) {
    emit('toggleSelected', path);
  } else {
    emit('select', path);
  }
}

function onFilterKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }

  switch (event.key) {
    case 'Escape':
      // A layer open over it (a tooltip, a menu) takes the Escape; the filter under it stays.
      if (isLayerOpen()) {
        return;
      }

      filterPattern.value = '';
      break;
    case 'Enter':
      break;
    default:
      return;
  }

  event.preventDefault();
  event.stopPropagation();
  emit('leaveFilter');
}
</script>

<template>
  <section
    :class="css.reviewFileList"
    :aria-label="t(l.files)"
  >
    <header
      ref="head"
      :class="css.reviewFileList_head"
    >
      <h2 :class="css.reviewFileList_title">{{ t(l.files) }}</h2>
      <span :class="css.reviewFileList_count">{{
        hasMore ? t(l.moreThanListed, { listed: numbers.format(listed) }) : numbers.format(listed)
      }}</span>
      <span :class="css.reviewFileList_spacer" />
      <span
        v-if="listed > 0 || matched !== null"
        :class="css.reviewFileList_count"
        >{{
          matched === null
            ? t(l.viewed, { viewed: numbers.format(viewed), total: numbers.format(listed) })
            : t(l.matching, { matched: numbers.format(matched), total: numbers.format(listed) })
        }}</span
      >
      <div :class="css.reviewFileList_tools">
        <SearchField
          ref="filterField"
          v-model="filterPattern"
          size="sm"
          :class="[css.reviewFileList_filter, filterInvalid && css.reviewFileList_filter_invalid]"
          :icon="ListFilter"
          :label="t(l.filter)"
          :placeholder="t(l.filterPlaceholder)"
          @keydown="onFilterKeydown"
        >
          <template #end>
            <ReviewToggle
              :icon="Regex"
              :label="t(l.useRegex)"
              :pressed="filterRegex"
              quiet
              @click="filterRegex = !filterRegex"
            />
          </template>
        </SearchField>
        <ReviewToggle
          :icon="EyeOff"
          :label="t(l.hideViewed)"
          :pressed="hideViewed"
          @click="hideViewed = !hideViewed"
        />
      </div>
      <p
        v-if="filterInvalid"
        :class="css.reviewFileList_problem"
        role="status"
      >
        {{ t(l.invalidRegex) }}
      </p>
    </header>
    <div
      ref="rows"
      :class="css.reviewFileList_rows"
    >
      <p
        v-if="flat && groups.length === 0"
        :class="css.reviewFileList_foot"
      >
        {{ t(l.noMatch) }}
      </p>
      <ul :class="css.reviewFileList_groups">
        <li
          v-for="group in groups"
          :key="group.folder ?? ''"
        >
          <div
            v-if="group.folder !== null"
            :class="css.reviewFileList_folder"
          >
            <Folder
              :class="css.reviewFileList_folderIcon"
              aria-hidden="true"
            />
            <span :class="css.reviewFileList_folderPath">{{ group.folder }}</span>
          </div>
          <ul :class="css.reviewFileList_files">
            <li
              v-for="file in group.files"
              :key="file.path"
              :class="css.reviewFileList_file"
            >
              <ReviewFileRow
                :file="file"
                :state="getState(file.path)"
                :collapsed="isCollapsed(file.path)"
                :collapse-reason="getCollapseReason(file.path)"
                :current="file.path === currentPath"
                :indented="group.folder !== null"
                :selected="selected.has(file.path)"
                :show-folder="flat"
                :changed-since="lostViewed?.has(file.path)"
                :open-threads="openThreads?.get(file.path)"
                :resolved-threads="resolvedThreads?.get(file.path)"
                @select="onRowClick(file.path, $event)"
                @select-threads="emit('selectThreads', file.path)"
              />
            </li>
          </ul>
        </li>
      </ul>
    </div>
    <div
      ref="foot"
      :class="css.reviewFileList_pinnedFoot"
    >
      <footer
        v-if="hasMore && listComplete"
        :class="css.reviewFileList_capped"
      >
        <p :class="css.reviewFileList_cappedTitle">{{ t(l.listedOnly, { listed: numbers.format(listed) }) }}</p>
        <p :class="css.reviewFileList_cappedDetail">
          {{
            t(l.listedOnlyDetail, {
              listed: numbers.format(listed),
              total: numbers.format(changedFiles ?? 0),
              rest: numbers.format((changedFiles ?? 0) - listed),
            })
          }}
        </p>
      </footer>
      <footer
        v-if="selected.size > 0"
        :class="css.reviewFileList_selection"
      >
        <span :class="css.reviewFileList_selected">{{
          t(l.filesSelected, { count: selected.size, formatted: numbers.format(selected.size) })
        }}</span>
        <span :class="css.reviewFileList_spacer" />
        <Button
          variant="light"
          size="sm"
          kbd="V"
          aria-keyshortcuts="V"
          @click="emit('markSelected')"
        >
          {{ allSelectedViewed ? t(l.markNotViewed) : t(l.markViewed) }}
        </Button>
        <button
          type="button"
          :class="css.reviewFileList_clear"
          :aria-label="t(l.clearSelection)"
          aria-keyshortcuts="Escape"
          @click="emit('clearSelection')"
        >
          <Kbd keys="Escape" />
        </button>
      </footer>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.reviewFileList {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
}

.reviewFileList_head {
  position: sticky;
  top: var(--review-file-list-top, 0);
  z-index: 1;
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: $spacing-6;
  align-items: baseline;
  padding: $spacing-10 $spacing-12 $spacing-8;
  background: $color-bg;
  border-bottom: 1px solid $color-border;
}

.reviewFileList_title {
  margin: 0;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.reviewFileList_count {
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
}

.reviewFileList_spacer {
  flex: 1;
}

// A row of its own: the filter and the eye.
.reviewFileList_tools {
  display: flex;
  flex-basis: 100%;
  gap: $spacing-6;
  align-items: center;
  margin-top: $spacing-2;
}

.reviewFileList_filter {
  flex: 1;
  // The toggle sits at the end, and the field stays as tall as the eye.
  padding-right: $spacing-2;
}

.reviewFileList_filter_invalid {
  --search-field-color: #{$color-red};
}

.reviewFileList_problem {
  flex-basis: 100%;
  margin: 0;
  font-size: $font-size-2xs;
  color: $color-red;
}

.reviewFileList_rows {
  flex: 1 0 auto;
  padding: $spacing-6;
}

.reviewFileList_pinnedFoot {
  position: sticky;
  bottom: 0;
  z-index: 1;
  background: $color-bg;
}

.reviewFileList_groups,
.reviewFileList_files {
  padding: 0;
  margin: 0;
  list-style: none;
}

.reviewFileList_files {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

// 3000 rows are laid out only when near the screen.
.reviewFileList_file {
  content-visibility: auto;
  contain-intrinsic-size: auto 26px;
}

.reviewFileList_folder {
  display: flex;
  gap: $spacing-6;
  align-items: flex-end;
  height: 24px;
  padding: 0 $spacing-8 3px;
}

.reviewFileList_folderIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.reviewFileList_folderPath {
  overflow: hidden;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewFileList_foot {
  padding: $spacing-8;
  margin: 0;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.reviewFileList_capped {
  flex: none;
  padding: $spacing-10 $spacing-12;
  border-top: 1px solid $color-border;
}

.reviewFileList_cappedTitle,
.reviewFileList_cappedDetail {
  margin: 0;
}

.reviewFileList_cappedTitle {
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-amber;
}

.reviewFileList_cappedDetail {
  margin-top: $spacing-4;
  font-size: $font-size-2xs;
  color: $color-fg-2;
}

.reviewFileList_selection {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  height: 44px;
  padding: 0 $spacing-8 0 $spacing-12;
  background: $color-bg-2;
  border-top: 1px solid $color-border-2;
}

.reviewFileList_selected {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
  white-space: nowrap;
}

.reviewFileList_clear {
  @include focus-ring;

  display: inline-flex;
  padding: 0;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 4px;
}
</style>
