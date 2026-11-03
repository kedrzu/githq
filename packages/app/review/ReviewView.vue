<!-- A pull request's review (D24): the toolbar, the list of files on the left and the diff filling the rest, every file one after another under its pinned header. Files arrive and diffs are computed while it shows, none of it moving what is being read (D7): a jump (a click in the list, `[` `]`) lands its file's header exactly at the top and holds it there through files arriving above, the layout and the whitespace setting; a line being read stays on screen through them too. A file that fails, is too large or binary says so in place and the others go on (D35). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowDownToLine, ArrowUpToLine, CircleAlert, FileCheck, FileSearch } from 'lucide-vue-next';
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import { formatItemReference, getItemPagePath } from '@/item/itemRoutes.js';
import type { ItemReference } from '@/item/itemRoutes.js';
import { useOpenedItem } from '@/item/useOpenedItem.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { goBack } from '@/utils/goBack.js';

import AnchoredList from './AnchoredList.vue';
import type { AnchoredListExposed } from './AnchoredList.vue';
import {
  estimateReviewRowHeight,
  findReplacementRow,
  getReviewHeaderKey,
  getReviewRowPath,
} from './buildReviewRows.js';
import type { ReviewRow } from './buildReviewRows.js';
import { groupReviewFiles } from './groupReviewFiles.js';
import ReviewDiffRow from './ReviewDiffRow.vue';
import ReviewFileList from './ReviewFileList.vue';
import { ReviewFiles } from './ReviewFiles.js';
import type { PullRequestFiles, ReviewFileState } from './ReviewFiles.js';
import ReviewToolbar from './ReviewToolbar.vue';
import * as l from './ReviewView.loc.js';
import { useReviewRows } from './useReviewRows.js';

const props = defineProps<{
  reference: ItemReference;
}>();

const WAITING: ReviewFileState = { kind: 'waiting' };

const t = useTranslate();
const accounts = useService(AccountSession);
const reviewFiles = useService(ReviewFiles);
const preferences = useService(LocalPreferences);
const router = useRouter();

const opened = useOpenedItem({ reference: () => props.reference });
const files = shallowRef<PullRequestFiles | null>(reviewFiles.open(props.reference));
const list = useTemplateRef<AnchoredListExposed>('list');
const layout = preferences.reviewLayout;
const hideWhitespace = preferences.reviewHideWhitespace;

const groups = computed(() => groupReviewFiles(files.value?.files ?? []));
const ordered = computed(() => groups.value.flatMap(group => group.files));
const currentPath = computed(() => {
  const anchor = list.value?.anchor;
  return anchor ? getReviewRowPath(anchor.key) : (ordered.value[0]?.path ?? null);
});
const rows = useReviewRows({ files, ordered, layout, hideWhitespace, currentPath });
const githubUrl = computed(() => {
  const { owner, name, number } = props.reference;
  return `https://github.com/${owner}/${name}/pull/${number}/files`;
});
const branches = computed(() => (opened.item?.kind === 'pullRequest' ? opened.item : null));

const openedAt = performance.now();
let firstRowMeasured = false;

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

// What's in view is fetched next, however the user got there (D35).
watch(currentPath, path => {
  if (path !== null) {
    files.value?.prioritize(path);
  }
});

// Runs before the list gets the rows, when `anchor` is still the row being read: if that row goes with them, its
// counterpart takes its place once they are in.
watch(rows, (next, previous) => {
  const anchor = list.value?.anchor;
  const replacement = anchor ? findReplacementRow({ key: anchor.key, offset: anchor.offset, previous, next }) : null;
  if (replacement) {
    void nextTick(() => list.value?.jumpTo(replacement.row.key, replacement.offset));
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
]);

function stepFile(delta: 1 | -1) {
  const index = ordered.value.findIndex(file => file.path === currentPath.value);
  const target = ordered.value[index + delta];
  if (target) {
    jumpToFile(target.path);
  }
}

function jumpToFile(path: string) {
  files.value?.prioritize(path);
  list.value?.jumpTo(getReviewHeaderKey(path), 0);
}

function getState(path: string) {
  return files.value?.getState(path) ?? WAITING;
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
      :reference="reference"
      :item="opened.item"
      :github-url="githubUrl"
      @back="back"
    />
    <div :class="css.reviewView_body">
      <div :class="css.reviewView_files">
        <ReviewFileList
          :groups="groups"
          :get-state="getState"
          :current-path="currentPath"
          :changed-files="files?.changedFiles ?? null"
          :list-complete="files?.listComplete ?? false"
          @select="jumpToFile"
        />
      </div>
      <div :class="css.reviewView_diff">
        <AnchoredList
          v-if="files?.list.kind === 'ready' && ordered.length > 0"
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
              @retry="path => files?.retry(path)"
            />
          </template>
        </AnchoredList>
        <div
          v-else
          :class="css.reviewView_state"
        >
          <EmptyState
            v-if="files?.list.kind === 'failed' || files?.list.kind === 'gone'"
            :icon="CircleAlert"
            :title="files.list.kind === 'gone' ? t(l.gone) : t(l.listFailed)"
            :detail="files.list.kind === 'gone' ? t(l.goneDetail) : files.list.error.message"
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
            v-else-if="files?.list.kind === 'ready'"
            :icon="FileCheck"
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
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.reviewView_state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.reviewView_actions {
  display: flex;
  gap: $spacing-8;
}
</style>
