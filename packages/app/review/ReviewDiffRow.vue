<!-- One row of the review's diff, of whichever kind: a file's header, a line split or unified, the lines left out with what shows them (D29) and what they are in, quiet bars while the file is on its way, or what the file says in place of a diff (D35): binary, too large or empty with a link to github.com, failed with GitHub's words and Try again, which touches no other file. Rows of a file are drawn as one block with an edge along both sides. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, FileDiff, UnfoldVertical } from 'lucide-vue-next';

import Button from '@/components/Button.vue';

import { getPlaceholderHeight } from './buildReviewRows.js';
import type { ReviewGapRow, ReviewRow } from './buildReviewRows.js';
import DiffFileHeader from './DiffFileHeader.vue';
import DiffRowSplit from './DiffRowSplit.vue';
import DiffRowUnified from './DiffRowUnified.vue';
import * as l from './ReviewDiffRow.loc.js';

defineProps<{
  row: ReviewRow;
  /** Where the pull request's files are on github.com. */
  githubUrl: string;
}>();

const emit = defineEmits<{
  /** Shows that many lines of the gap. */
  expand: [gap: ReviewGapRow, count: number];
  retry: [path: string];
  toggleCollapsed: [path: string];
  toggleViewed: [path: string];
}>();

const t = useTranslate();

/** What "Show 20" shows; with no more than that hidden, "Show all" says the same. */
const EXPAND_STEP = 20;
</script>

<template>
  <div
    v-if="row.kind === 'tail'"
    :class="css.reviewDiffRow_tail"
  />
  <div
    v-else
    :class="css.reviewDiffRow"
  >
    <DiffFileHeader
      v-if="row.kind === 'header'"
      :file="row.file"
      :collapsed="row.collapsed"
      :collapse-reason="row.collapseReason"
      @toggle-collapsed="emit('toggleCollapsed', row.file.path)"
      @toggle-viewed="emit('toggleViewed', row.file.path)"
    />
    <div
      v-else-if="row.kind === 'end'"
      :class="row.collapsed ? css.reviewDiffRow_endCollapsed : css.reviewDiffRow_end"
    />
    <div
      v-else
      :class="css.reviewDiffRow_block"
    >
      <template v-if="row.kind === 'line'">
        <DiffRowSplit
          v-if="row.line.layout === 'split'"
          :line="row.line"
          :diff="row.diff"
        />
        <DiffRowUnified
          v-else
          :line="row.line"
          :diff="row.diff"
        />
      </template>
      <div
        v-else-if="row.kind === 'gap'"
        :class="css.reviewDiffRow_gap"
      >
        <UnfoldVertical
          :class="css.reviewDiffRow_gapIcon"
          aria-hidden="true"
        />
        {{ t(l.hiddenLines, { count: row.hidden, formatted: numbers.format(row.hidden) }) }}
        <button
          v-if="row.hidden > EXPAND_STEP"
          type="button"
          :class="css.reviewDiffRow_gapAction"
          @click="emit('expand', row, EXPAND_STEP)"
        >
          {{ t(l.showSome, { count: EXPAND_STEP }) }}
        </button>
        <button
          type="button"
          :class="css.reviewDiffRow_gapAction"
          @click="emit('expand', row, row.hidden)"
        >
          {{ t(l.showAll) }}
        </button>
        <span
          v-if="row.enclosing"
          :class="css.reviewDiffRow_gapEnclosing"
          >{{ row.enclosing }}</span
        >
      </div>
      <div
        v-else-if="row.kind === 'placeholder'"
        :class="css.reviewDiffRow_placeholder"
        :style="{ height: `${getPlaceholderHeight(row.file)}px` }"
      />
      <div
        v-else-if="row.kind === 'notice'"
        :class="css.reviewDiffRow_notice"
      >
        <FileDiff
          :class="css.reviewDiffRow_noticeIcon"
          aria-hidden="true"
        />
        <div :class="css.reviewDiffRow_noticeText">
          <p :class="css.reviewDiffRow_noticeTitle">{{ t(l[row.notice]) }}</p>
          <p
            v-if="row.notice === 'tooLarge'"
            :class="css.reviewDiffRow_noticeDetail"
          >
            {{ t(l.tooLargeDetail) }}
          </p>
        </div>
        <Button
          v-if="row.notice !== 'empty'"
          size="sm"
          variant="outline"
          :link="githubUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t(l.openOnGitHub) }}
        </Button>
      </div>
      <div
        v-else
        :class="css.reviewDiffRow_notice"
      >
        <CircleAlert
          :class="[css.reviewDiffRow_noticeIcon, css.reviewDiffRow_noticeIcon_failed]"
          aria-hidden="true"
        />
        <div :class="css.reviewDiffRow_noticeText">
          <p :class="[css.reviewDiffRow_noticeTitle, css.reviewDiffRow_noticeTitle_failed]">{{ t(l.failed) }}</p>
          <p :class="css.reviewDiffRow_noticeDetail">{{ row.error.message }}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          @click="emit('retry', row.file.path)"
        >
          {{ t(l.tryAgain) }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          :link="githubUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t(l.openOnGitHub) }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewDiffRow {
  padding: 0 $spacing-12;
  background: $color-bg;
}

.reviewDiffRow_block {
  border-right: 1px solid $color-border;
  border-left: 1px solid $color-border;
}

.reviewDiffRow_end {
  height: 4px;
  margin-bottom: $spacing-12;
  border: 1px solid $color-border;
  border-top: 0;
  border-radius: 0 0 $radius-lg $radius-lg;
}

.reviewDiffRow_endCollapsed {
  height: $spacing-12;
}

// Under the last file, enough for its header alone to reach the top: the viewport (the screen without the toolbar and
// the status bar) less the header and its end.
.reviewDiffRow_tail {
  height: calc(100vh - #{$status-bar-height} - #{$list-header-height} - 54px);
}

.reviewDiffRow_gap {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  height: 28px;
  padding: 0 $spacing-12;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  background: $color-bg-2;
  border-top: 1px solid $color-border;
  border-bottom: 1px solid $color-border;
}

.reviewDiffRow_gapIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.reviewDiffRow_gapAction {
  @include focus-ring;

  flex: none;
  padding: 0;
  font: inherit;
  color: $color-fg-2;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 3px;

  &:hover {
    color: $color-fg;
  }
}

.reviewDiffRow_gapEnclosing {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Quiet bars, one per line the file will about take.
.reviewDiffRow_placeholder {
  background-image: linear-gradient($color-bg-3, $color-bg-3);
  background-repeat: repeat-y;
  background-position: 48px 6px;
  background-size: 40% 20px;
  mask-image: repeating-linear-gradient(to bottom, #000 0, #000 8px, transparent 8px, transparent 20px);
  mask-position: 0 6px;
}

.reviewDiffRow_notice {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  min-height: 56px;
  padding: $spacing-8 $spacing-12;
  background: $color-bg-2;
}

.reviewDiffRow_noticeIcon {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-fg-2;
}

.reviewDiffRow_noticeIcon_failed {
  color: $color-red;
}

.reviewDiffRow_noticeText {
  flex: 1;
  min-width: 0;
}

.reviewDiffRow_noticeTitle,
.reviewDiffRow_noticeDetail {
  margin: 0;
  overflow-wrap: anywhere;
}

.reviewDiffRow_noticeTitle {
  font-size: $font-size-sm;
  color: $color-fg;
}

.reviewDiffRow_noticeTitle_failed {
  color: $color-red;
}

.reviewDiffRow_noticeDetail {
  font-size: $font-size-xs;
  color: $color-fg-2;
}
</style>
