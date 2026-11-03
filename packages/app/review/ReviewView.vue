<!-- A pull request's review (D24): the toolbar, the list of files on the left and the diff filling the rest, every file one after another under its pinned header. Files arrive and diffs are computed while it shows, none of it moving what is being read (D7): a jump (a click in the list, `[` `]`) lands its file's header exactly at the top and holds it there through files arriving above, the layout and the whitespace setting; a line being read stays on screen through them too. A file that fails, is too large or binary says so in place and the others go on (D35). Lock files, generated and very large files start as a header, nothing of them fetched until opened; Space or a click on the header opens the file or collapses it (D8). `V` or the header's button sets the file's viewed mark, GitHub's own (D9), which collapses the file to its header in place, or with viewed files hidden the next file takes its place, and with all of them viewed the diff says so. Files selected in the list (x, { }, ⇧click, ⌘click, D10) take `V` together, in one request. `/` filters (D11): files filtered away leave the diff too, the reader moving on to the next one left. A gap's Show 20 and Show all hold the line under it where it is, the lines coming above it (D6, D7). ⌘B hides the file list (D26). GitHub's allowance running out pauses the missing files, which carry on by themselves at its reset, and the status bar says so; files GitHub took the viewed mark off since the last visit are named in a line that goes once the first of them has been read (D35). -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CircleAlert,
  CircleCheck,
  Equal,
  Eye,
  FileSearch,
  FoldVertical,
  ListChecks,
  ListFilter,
  PanelLeft,
  Pause,
  UnfoldVertical,
} from 'lucide-vue-next';
import { computed, nextTick, onScopeDispose, shallowRef, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import { formatItemReference, getItemPagePath } from '@/item/itemRoutes.js';
import type { ItemReference } from '@/item/itemRoutes.js';
import { useOpenedItem } from '@/item/useOpenedItem.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { formatTime } from '@/utils/formatTime.js';
import { goBack } from '@/utils/goBack.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';

import AnchoredList from './AnchoredList.vue';
import type { AnchoredListExposed } from './AnchoredList.vue';
import {
  estimateReviewRowHeight,
  findReplacementRow,
  getGapLinesToShow,
  getReviewHeaderKey,
  getReviewRowPath,
} from './buildReviewRows.js';
import type { ReviewGapRow, ReviewRow } from './buildReviewRows.js';
import { groupReviewFiles } from './groupReviewFiles.js';
import ReviewDiffRow from './ReviewDiffRow.vue';
import ReviewFileList from './ReviewFileList.vue';
import ReviewLostViewedBar from './ReviewLostViewedBar.vue';
import { ReviewFiles } from './ReviewFiles.js';
import { ReviewScreenFreshness } from './ReviewScreenFreshness.js';
import type { PullRequestFiles, ReviewFileState } from './ReviewFiles.js';
import ReviewToolbar from './ReviewToolbar.vue';
import * as l from './ReviewView.loc.js';
import { useReviewRows } from './useReviewRows.js';
import { createFileFilter } from './utils/createFileFilter.js';
import type { FileFilter, FileFilterInput } from './utils/createFileFilter.js';
import { getFailureText } from './utils/getFailureText.js';
import { getReviewFreshness } from './utils/getReviewFreshness.js';

const props = defineProps<{
  reference: ItemReference;
}>();

const WAITING: ReviewFileState = { kind: 'waiting' };
const NO_FILTER: FileFilterInput = { pattern: '', regex: false };
const NO_FILES: ReadonlySet<string> = new Set();

const t = useTranslate();
const accounts = useService(AccountSession);
const reviewFiles = useService(ReviewFiles);
const preferences = useService(LocalPreferences);
const screenFreshness = useService(ReviewScreenFreshness);
const router = useRouter();

const opened = useOpenedItem({ reference: () => props.reference });
const files = shallowRef<PullRequestFiles | null>(reviewFiles.open(props.reference));
const list = useTemplateRef<AnchoredListExposed>('list');
const fileList = useTemplateRef<InstanceType<typeof ReviewFileList>>('fileList');
const layout = preferences.reviewLayout;
const hideWhitespace = preferences.reviewHideWhitespace;
const fileListHidden = preferences.reviewFileListHidden;
const selected = shallowRef<ReadonlySet<string>>(new Set());

const hideViewed = computed({
  get: () => files.value?.hideViewed ?? false,
  set: hide => files.value?.setHideViewed(hide),
});
const allFiles = computed(() => files.value?.files ?? []);
const filterInput = computed(() => files.value?.filter ?? NO_FILTER);
const typedFilter = computed(() => createFileFilter(filterInput.value));
// A regular expression that doesn't compile, often just not finished, leaves the list as it was (CR28).
const filter = computed<FileFilter>(previous =>
  typedFilter.value.kind === 'invalid' ? (previous ?? { kind: 'off' }) : typedFilter.value,
);
const matchedFiles = computed(() => {
  const current = filter.value;
  return current.kind === 'on' ? allFiles.value.filter(file => current.matches(file.path)) : allFiles.value;
});
const groups = computed(() =>
  groupReviewFiles(hideViewed.value ? matchedFiles.value.filter(file => file.viewed !== 'VIEWED') : matchedFiles.value),
);
const ordered = computed(() => groups.value.flatMap(group => group.files));
const filterOn = computed(() => filter.value.kind === 'on');
// While a filter is on the list is flat, each file followed by its folder (D27).
const listGroups = computed(() =>
  filterOn.value && ordered.value.length > 0 ? [{ folder: null, files: ordered.value }] : groups.value,
);
const allPaths = computed(() => groupReviewFiles(allFiles.value).flatMap(group => group.files.map(file => file.path)));
const filterPattern = computed({
  get: () => filterInput.value.pattern,
  set: pattern => files.value?.setFilter({ pattern, regex: filterInput.value.regex }),
});
const filterRegex = computed({
  get: () => filterInput.value.regex,
  set: regex => files.value?.setFilter({ pattern: filterInput.value.pattern, regex }),
});
const currentPath = computed(() => {
  const anchor = list.value?.anchor;
  return anchor ? getReviewRowPath(anchor.key) : (ordered.value[0]?.path ?? null);
});
const { rows } = useReviewRows({ files, ordered, layout, hideWhitespace, currentPath });
const githubUrl = computed(() => {
  const { owner, name, number } = props.reference;
  return `https://github.com/${owner}/${name}/pull/${number}/files`;
});
const currentFile = computed(() => ordered.value.find(file => file.path === currentPath.value) ?? null);
const branches = computed(() => (opened.item?.kind === 'pullRequest' ? opened.item : null));
const lostViewed = computed(() => files.value?.lostViewed ?? NO_FILES);
/** What the line about a push names, in the list's order. */
const lostViewedPaths = computed(() =>
  files.value?.lostViewedNotice ? allPaths.value.filter(path => lostViewed.value.has(path)) : [],
);

const openedAt = performance.now();
let firstRowMeasured = false;
/** Where ⇧click selects from: the file last selected on its own. */
let selectionStart: string | null = null;
/** The row under a gap being expanded, at where it is on screen: it stays there once the lines are in. */
let heldUnderGap: { key: string; offset: number } | null = null;

// Once, when the diff first shows: PageDown, Space and the arrows then scroll it at once. By then the user may be in a
// field, like the command palette's, which nothing here takes them out of.
const stopFocusing = watch(
  list,
  exposed => {
    if (exposed) {
      stopFocusing();
      if (!document.activeElement || document.activeElement === document.body) {
        exposed.focus();
      }
    }
  },
  { flush: 'post' },
);

// Signed in again as someone else, this is their read of the pull request.
watch(
  () => accounts.current,
  () => {
    files.value = reviewFiles.open(props.reference);
  },
);

// The address of an issue's number: the item's own page, as GitHub redirects.
watch(
  () => opened.item?.kind,
  kind => {
    if (kind === 'issue') {
      void router.replace(getItemPagePath(props.reference, 'issue'));
    }
  },
  { immediate: true },
);

// What's in view is fetched next, however the user got there (D35). Moving on from a file that lost its viewed mark has
// read the first of them, and the line naming them has done its work.
watch(currentPath, (path, previous) => {
  if (path !== null) {
    files.value?.prioritize(path);
  }

  if (previous !== null && lostViewed.value.has(previous)) {
    files.value?.dismissLostViewedNotice();
  }
});

onScopeDispose(
  screenFreshness.show(() => {
    if (selected.value.size > 0) {
      return { kind: 'filesSelected' };
    }

    return files.value ? getReviewFreshness(files.value) : { kind: 'partial' };
  }),
);

// Runs before the list gets the rows, when `anchor` is still the row being read: if that row goes with them, its
// counterpart takes its place once they are in.
watch(rows, (next, previous) => {
  const held = heldUnderGap;
  if (held) {
    heldUnderGap = null;
    void nextTick(() => list.value?.jumpTo(held.key, held.offset));
    return;
  }

  const anchor = list.value?.anchor;
  const replacement = anchor
    ? findReplacementRow({ key: anchor.key, offset: anchor.offset, previous, next, order: allPaths.value })
    : null;
  if (replacement) {
    void nextTick(() => list.value?.jumpTo(replacement.row.key, replacement.offset));
  }
});

// What can't be seen isn't acted on: a file hidden or filtered away leaves the selection.
watch(ordered, shown => {
  if (selected.value.size > 0) {
    const paths = new Set(shown.map(file => file.path));
    const kept = [...selected.value].filter(path => paths.has(path));
    if (kept.length < selected.value.size) {
      selected.value = new Set(kept);
    }
  }
});

watch(fileListHidden, hidden => {
  if (hidden) {
    selected.value = new Set();
    returnKeysToDiff();
  }
});

watch(
  () => files.value?.list.kind,
  kind => {
    if (kind === 'ready') {
      performance.measure('review:list', { start: openedAt, end: performance.now() });
    }
  },
  { immediate: true },
);

watch(rows, next => {
  if (!firstRowMeasured && next.some(row => row.kind === 'line')) {
    firstRowMeasured = true;
    requestAnimationFrame(() => {
      performance.measure('review:first-row', { start: openedAt, end: performance.now() });
    });
  }
});

useCommands(() => [
  {
    id: 'review.previousFile',
    title: t(l.previousFile),
    section: 'view',
    key: '[',
    icon: ArrowUpToLine,
    when: () => ordered.value.length > 0,
    run: () => stepFile(-1),
  },
  {
    id: 'review.nextFile',
    title: t(l.nextFile),
    section: 'view',
    key: ']',
    icon: ArrowDownToLine,
    when: () => ordered.value.length > 0,
    run: () => stepFile(1),
  },
  {
    id: 'review.toggleViewed',
    title: (selected.value.size > 0 ? isSelectionViewed() : currentFile.value?.viewed === 'VIEWED')
      ? t(l.markNotViewed)
      : t(l.markViewed),
    section: 'view',
    key: 'V',
    icon: Eye,
    when: () => currentFile.value !== null || selected.value.size > 0,
    run: () => {
      if (selected.value.size > 0) {
        markSelected();
      } else if (currentFile.value) {
        toggleViewed(currentFile.value.path);
      }
    },
  },
  {
    id: 'review.toggleSelected',
    title: t(l.toggleSelected),
    section: 'view',
    key: 'X',
    icon: ListChecks,
    when: () => canSelect(),
    run: () => {
      if (currentPath.value !== null) {
        toggleSelected(currentPath.value);
      }
    },
  },
  {
    id: 'review.selectNext',
    title: t(l.selectNext),
    section: 'view',
    key: '}',
    when: () => canSelect(),
    run: () => extendSelection(1),
  },
  {
    id: 'review.selectPrevious',
    title: t(l.selectPrevious),
    section: 'view',
    key: '{',
    when: () => canSelect(),
    run: () => extendSelection(-1),
  },
  {
    id: 'review.clearSelection',
    title: t(l.clearSelection),
    section: 'view',
    key: 'Escape',
    menu: false,
    when: () => selected.value.size > 0 && !isLayerOpen(),
    run: clearSelection,
  },
  {
    id: 'review.clearFilter',
    title: t(l.clearFilter),
    section: 'view',
    key: 'Escape',
    menu: false,
    when: () => filterPattern.value !== '' && !isLayerOpen(),
    run: () => {
      filterPattern.value = '';
    },
  },
  {
    id: 'review.focusFilter',
    title: t(l.focusFilter),
    section: 'view',
    key: '/',
    icon: ListFilter,
    run: focusFilter,
  },
  {
    id: 'review.toggleFileList',
    title: fileListHidden.value ? t(l.showFileList) : t(l.hideFileList),
    section: 'view',
    key: 'Mod+B',
    icon: PanelLeft,
    run: () => {
      fileListHidden.value = !fileListHidden.value;
    },
  },
  {
    id: 'review.toggleCollapsed',
    title: isCurrentCollapsed() ? t(l.expandFile) : t(l.collapseFile),
    section: 'view',
    key: 'Space',
    icon: isCurrentCollapsed() ? UnfoldVertical : FoldVertical,
    // Space on a focused button is that button's, wherever else the key goes.
    when: () => currentFile.value !== null && document.activeElement?.closest('button, a') == null,
    run: () => {
      if (currentFile.value) {
        toggleCollapsed(currentFile.value.path);
      }
    },
  },
]);

function stepFile(delta: 1 | -1) {
  const index = ordered.value.findIndex(file => file.path === currentPath.value);
  const target = ordered.value[index + delta];
  if (target) {
    jumpToFile(target.path);
  }
}

function canSelect() {
  return currentFile.value !== null && !fileListHidden.value;
}

function isSelectionViewed() {
  return allFiles.value.every(file => !selected.value.has(file.path) || file.viewed === 'VIEWED');
}

function toggleSelected(path: string) {
  const next = new Set(selected.value);
  if (!next.delete(path)) {
    next.add(path);
  }

  selected.value = next;
  selectionStart = path;
}

/** ⇧click: from where the selection started up to the file, in place of what was selected. */
function selectRange(path: string) {
  const paths = ordered.value.map(file => file.path);
  const start = paths.indexOf(selectionStart ?? currentPath.value ?? path);
  const end = paths.indexOf(path);
  selected.value = new Set(start === -1 ? [path] : paths.slice(Math.min(start, end), Math.max(start, end) + 1));
  selectionStart = paths[start] ?? path;
}

/** Adds the file in view and the one `delta` away, and goes there, as a list's ⇧J and ⇧K do. */
function extendSelection(delta: 1 | -1) {
  const from = currentPath.value;
  stepFile(delta);
  selected.value = new Set([...selected.value, from, currentPath.value].filter(path => path !== null));
  selectionStart = from;
}

function clearSelection() {
  selected.value = new Set();
  selectionStart = null;
}

/** All of them viewed, or all not viewed again; the selection stays, for what went wrong to be put back. */
function markSelected() {
  files.value?.setViewed([...selected.value], !isSelectionViewed());
  returnKeysToDiff();
}

async function focusFilter() {
  fileListHidden.value = false;
  await nextTick();
  fileList.value?.focusFilter();
}

/** Shows lines of a gap, the row under it staying where it is on screen: it's what is being read. */
function expandGap(gap: ReviewGapRow, count: number) {
  const below = gap.atFileEnd ? null : rows.value[rows.value.indexOf(gap) + 1];
  const offset = below ? (list.value?.getRowOffset(below.key) ?? null) : null;
  heldUnderGap = below && offset !== null ? { key: below.key, offset } : null;
  files.value?.expandLines(getReviewRowPath(gap.key), getGapLinesToShow(gap, count));
  returnKeysToDiff();
}

function jumpToFile(path: string) {
  files.value?.prioritize(path);
  list.value?.jumpTo(getReviewHeaderKey(path), 0);
}

/** A plain click: on its own, or `V` would go on marking the files selected before. */
function selectFile(path: string) {
  selected.value = new Set();
  selectionStart = path;
  jumpToFile(path);
  list.value?.focus();
}

function getState(path: string) {
  return files.value?.getState(path) ?? WAITING;
}

function getCollapse(path: string) {
  return files.value?.getCollapse(path) ?? null;
}

function isCurrentCollapsed() {
  return currentFile.value !== null && getCollapse(currentFile.value.path) !== null;
}

function toggleCollapsed(path: string) {
  files.value?.setCollapsed(path, getCollapse(path) === null);
  returnKeysToDiff();
}

function toggleViewed(path: string) {
  const file = allFiles.value.find(other => other.path === path);
  const viewed = file?.viewed !== 'VIEWED';
  files.value?.setViewed([path], viewed);
  // Opened again in front of the reader: what's in view is fetched next (D35), not after every other file.
  if (!viewed && path === currentPath.value) {
    files.value?.prioritize(path);
  }

  returnKeysToDiff();
}

/** After the header's button, which may be gone by now: the keys go on acting on the diff. */
function returnKeysToDiff() {
  void nextTick(() => list.value?.focus());
}

/** "Show only these": through the filter, which says what is on and which Esc clears. */
function showOnlyLostViewed() {
  const paths = lostViewedPaths.value;
  files.value?.setFilter({ pattern: paths.join(', '), regex: false, paths });
  fileListHidden.value = false;
}

function isPinned(row: ReviewRow) {
  return row.kind === 'header';
}

function back() {
  goBack(router, getItemPagePath(props.reference, 'pullRequest'));
}

function readAgain() {
  files.value = reviewFiles.open(props.reference);
}
</script>

<template>
  <div :class="css.reviewView">
    <ReviewToolbar
      v-model:layout="layout"
      v-model:hide-whitespace="hideWhitespace"
      v-model:file-list-hidden="fileListHidden"
      :reference="reference"
      :item="opened.item"
      :github-url="githubUrl"
      @back="back"
    />
    <ReviewLostViewedBar
      v-if="lostViewedPaths.length > 0"
      :paths="lostViewedPaths"
      @show-only="showOnlyLostViewed"
      @dismiss="files?.dismissLostViewedNotice()"
    />
    <div :class="css.reviewView_body">
      <div
        v-if="!fileListHidden"
        :class="css.reviewView_files"
      >
        <ReviewFileList
          ref="fileList"
          v-model:hide-viewed="hideViewed"
          v-model:filter-pattern="filterPattern"
          v-model:filter-regex="filterRegex"
          :groups="listGroups"
          :files="allFiles"
          :get-state="getState"
          :get-collapse="getCollapse"
          :get-collapse-reason="path => files?.getCollapseReason(path) ?? null"
          :current-path="currentPath"
          :changed-files="files?.changedFiles ?? null"
          :list-complete="files?.listComplete ?? false"
          :matched="filterOn ? matchedFiles.length : null"
          :filter-invalid="typedFilter.kind === 'invalid'"
          :selected="selected"
          :lost-viewed="lostViewed"
          @select="selectFile"
          @select-range="selectRange"
          @toggle-selected="toggleSelected"
          @mark-selected="markSelected"
          @clear-selection="clearSelection"
          @leave-filter="list?.focus()"
        />
      </div>
      <div :class="css.reviewView_diff">
        <AnchoredList
          v-if="files?.list.kind === 'ready' && (ordered.length > 0 || filterOn)"
          ref="list"
          :rows="rows"
          :estimate-height="estimateReviewRowHeight"
          :is-pinned="isPinned"
          :label="t(l.diff)"
        >
          <template #default="{ row }">
            <ReviewDiffRow
              :row="row"
              :github-url="githubUrl"
              :changed-since="row.kind === 'header' && lostViewed.has(row.file.path)"
              @expand="expandGap"
              @retry="path => files?.retry(path)"
              @toggle-collapsed="toggleCollapsed"
              @toggle-viewed="toggleViewed"
            />
          </template>
        </AnchoredList>
        <!-- Over the list, not instead of it: a pattern passing through no match keeps the place being read (D7). -->
        <div
          v-if="ordered.length === 0 || files?.list.kind !== 'ready'"
          :class="css.reviewView_state"
        >
          <EmptyState
            v-if="files?.list.kind === 'failed' || files?.list.kind === 'gone'"
            :icon="CircleAlert"
            :title="files.list.kind === 'gone' ? t(l.gone) : t(l.listFailed)"
            :detail="files.list.kind === 'gone' ? t(l.goneDetail) : getFailureText(files.list.error)"
          >
            <template #action>
              <div :class="css.reviewView_actions">
                <Button
                  size="sm"
                  @click="readAgain"
                >
                  {{ t(l.tryAgain) }}
                </Button>
                <Button
                  size="sm"
                  :link="githubUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ t(l.openOnGitHub) }}
                </Button>
              </div>
            </template>
          </EmptyState>
          <EmptyState
            v-else-if="files?.list.kind === 'paused'"
            :icon="Pause"
            :title="t(l.paused)"
            :detail="t(l.pausedDetail, { time: formatTime(files.list.until) })"
          >
            <template #action>
              <Button
                size="sm"
                :link="githubUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t(l.openOnGitHub) }}
              </Button>
            </template>
          </EmptyState>
          <EmptyState
            v-else-if="files?.list.kind === 'ready' && filterOn"
            :icon="FileSearch"
            :title="t(l.noMatch)"
            :detail="hideViewed && matchedFiles.length > 0 ? t(l.noMatchViewedHidden) : undefined"
          >
            <template #action>
              <Button
                size="sm"
                @click="filterPattern = ''"
              >
                {{ t(l.clearFilter) }}
              </Button>
            </template>
          </EmptyState>
          <EmptyState
            v-else-if="files?.list.kind === 'ready' && allFiles.length > 0"
            :icon="CircleCheck"
            :title="t(l.allViewed, { total: numbers.format(allFiles.length) })"
            :detail="t(l.allViewedDetail)"
          >
            <template #action>
              <Button
                size="sm"
                @click="hideViewed = false"
              >
                {{ t(l.showViewed) }}
              </Button>
            </template>
          </EmptyState>
          <EmptyState
            v-else-if="files?.list.kind === 'ready'"
            :icon="Equal"
            :title="t(l.noChanges)"
            :detail="
              branches
                ? t(l.noChangesDetail, { head: branches.headRefName, base: branches.baseRefName })
                : t(l.noChangesPlain)
            "
          >
            <template #action>
              <Button
                size="sm"
                :link="githubUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t(l.openOnGitHub) }}
              </Button>
            </template>
          </EmptyState>
          <EmptyState
            v-else
            :icon="FileSearch"
            :title="t(l.reading, { reference: formatItemReference(reference) })"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  background: $color-bg;
}

.reviewView_body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.reviewView_files {
  flex: none;
  width: $review-file-list-width;
  min-height: 0;
  border-right: 1px solid $color-border;
}

.reviewView_diff {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.reviewView_state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg;
}

.reviewView_actions {
  display: flex;
  gap: $spacing-8;
}
</style>
