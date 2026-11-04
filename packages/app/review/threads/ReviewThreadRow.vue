<!-- A thread's row in the diff, by where it was placed (D12, D13, D30): under its line on its own half in split, indented to the code in unified (D24); at the file's top with its old code and the commit, closed off before the diff begins; under a collapsed file's or a gone file's header with the code "as it was when commented", which a resolved thread keeps folded with the rest. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { History } from 'lucide-vue-next';
import { computed } from 'vue';

import type { ReviewThreadRow } from '../buildReviewRows.js';
import { parseDiffHunk } from './parseDiffHunk.js';
import ReviewRowInset from './ReviewRowInset.vue';
import ReviewThreadBox from './ReviewThreadBox.vue';
import ReviewThreadCode from './ReviewThreadCode.vue';
import * as l from './ReviewThreadRow.loc.js';

const props = defineProps<{
  row: ReviewThreadRow;
  /** A resolved thread shows whole. */
  open?: boolean;
  focused?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const t = useTranslate();

const thread = computed(() => props.row.placement.thread);
const commit = computed(() => thread.value.comments[0]?.originalCommit?.abbreviatedOid ?? '');
const hunk = computed(() => {
  const { placement } = props.row;
  return 'diffHunk' in placement ? parseDiffHunk(placement.diffHunk) : [];
});
const commentedLine = computed(() => {
  const last = hunk.value.at(-1);
  return last?.newLine ?? last?.oldLine ?? thread.value.originalLine ?? 0;
});
const codeShown = computed(() => hunk.value.length > 0 && (!thread.value.isResolved || props.open));
const lineGone = computed(() => {
  const { placement } = props.row;
  return placement.kind === 'fileTop' && (thread.value.isOutdated || placement.fileDeleted) && codeShown.value;
});
const lineGoneDetail = computed(() => {
  const { placement } = props.row;
  const params = { line: commentedLine.value, commit: commit.value };
  return placement.kind === 'fileTop' && placement.fileDeleted
    ? t(l.lineGoneFromDeleted, params)
    : t(l.lineGoneDetail, params);
});
const outdatedNote = computed(() => {
  const { placement } = props.row;
  switch (placement.kind) {
    case 'onLine':
    case 'hiddenLine':
      return placement.approximate ? t(l.placedAgain) : null;
    case 'fileTop':
      return thread.value.isOutdated ? t(l.atFileTop) : null;
    case 'inCollapsed':
      return thread.value.isOutdated ? t(l.withItsCode) : null;
    // A file that is gone says it itself; all its threads are outdated.
    case 'gone':
      return null;
    default:
      return assertNever(placement);
  }
});
const codeLabel = computed(() => {
  const line = commentedLine.value;
  const { placement } = props.row;
  switch (placement.kind) {
    case 'fileTop':
      return t(l.codeAtCommit, { commit: commit.value });
    case 'gone':
      return t(l.asCommentedAt, { line, commit: commit.value });
    case 'inCollapsed':
      return placement.notLoaded ? t(l.asCommentedNotLoaded, { line }) : t(l.asCommented, { line });
    default:
      return t(l.asCommented, { line });
  }
});
</script>

<template>
  <ReviewRowInset
    :inline="row.inline"
    :class="row.placement.kind === 'fileTop' && css.reviewThreadRow_fileTop"
  >
    <p
      v-if="lineGone"
      :class="css.reviewThreadRow_lineGone"
    >
      <History
        :class="css.reviewThreadRow_lineGoneIcon"
        aria-hidden="true"
      />
      <span :class="css.reviewThreadRow_lineGoneTitle">{{ t(l.lineGone) }}</span>
      {{ lineGoneDetail }}
    </p>
    <ReviewThreadCode
      v-if="codeShown"
      :label="codeLabel"
      :lines="hunk"
    />
    <ReviewThreadBox
      :thread="thread"
      :outdated-note="outdatedNote"
      :open="open"
      :focused="focused"
      @toggle="emit('toggle')"
    />
  </ReviewRowInset>
</template>

<style lang="scss" module="css">
.reviewThreadRow_fileTop {
  border-bottom: 1px solid $color-border;
}

.reviewThreadRow_lineGone {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-6;
  align-items: center;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.reviewThreadRow_lineGoneIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-amber;
}

.reviewThreadRow_lineGoneTitle {
  font-weight: $font-weight-medium;
  color: $color-amber;
}
</style>
