<!-- A thread's row in the diff, by where it was placed (D12, D13, D30): under its line on its own half in split, indented to the code in unified (D24); at the file's top with its old code and the commit, closed off before the diff begins; under a collapsed file's or a gone file's header with the code "as it was when commented", which a resolved thread keeps folded with the rest. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { History } from 'lucide-vue-next';
import { computed } from 'vue';

import type { ReviewThreadRow } from '../buildReviewRows.js';
import { parseDiffHunk } from './parseDiffHunk.js';
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
const lineGone = computed(() => props.row.placement.kind === 'fileTop' && thread.value.isOutdated && codeShown.value);
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
  switch (props.row.placement.kind) {
    case 'fileTop':
      return t(l.codeAtCommit, { commit: commit.value });
    case 'gone':
      return t(l.asCommentedAt, { line, commit: commit.value });
    default:
      return t(l.asCommented, { line });
  }
});
</script>

<template>
  <div
    :class="[
      css.reviewThreadRow,
      row.inline && css[`reviewThreadRow_${row.inline}`],
      row.placement.kind === 'fileTop' && css.reviewThreadRow_fileTop,
    ]"
  >
    <div :class="css.reviewThreadRow_content">
      <p
        v-if="lineGone"
        :class="css.reviewThreadRow_lineGone"
      >
        <History
          :class="css.reviewThreadRow_lineGoneIcon"
          aria-hidden="true"
        />
        <span :class="css.reviewThreadRow_lineGoneTitle">{{ t(l.lineGone) }}</span>
        {{ t(l.lineGoneDetail, { line: commentedLine, commit }) }}
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
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewThreadRow {
  padding: $spacing-8 $spacing-14;
  background: $color-bg;
}

.reviewThreadRow_fileTop {
  border-bottom: 1px solid $color-border;
}

.reviewThreadRow_content {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

// On its own half, the line between the halves going on beside it.
.reviewThreadRow_left {
  width: 50%;
  padding-right: $spacing-6;
  padding-left: $spacing-6;
}

.reviewThreadRow_right {
  padding-right: $spacing-6;
  padding-left: calc(50% + #{$spacing-6});
  background:
    linear-gradient($color-border, $color-border) 50% 0 / 1px 100% no-repeat,
    $color-bg;
}

// Indented to the code: two numbers and the sign.
.reviewThreadRow_unified {
  padding-right: $spacing-14;
  padding-left: 108px;

  .reviewThreadRow_content {
    max-width: 760px;
  }
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
