<!-- One row of the review's diff, of whichever kind: a file's header, a line split or unified, the lines left out with what shows them (D29) and what they are in, quiet bars while the file is on its way (one fetched ahead of the rest says so), or what the file says in place of a diff (D35): binary with its sizes, too large with its size or empty, each with a link to the file on github.com, failed with GitHub's words and Try again, which touches no other file, waiting for GitHub's allowance with when it comes. Rows of a file are drawn as one block with an edge along both sides. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, FileDiff, LoaderCircle, Pause, UnfoldVertical } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';

import Button from '@/components/Button.vue';
import { formatBytes } from '@/utils/formatBytes.js';
import { formatTime } from '@/utils/formatTime.js';

import { getPlaceholderHeight } from './buildReviewRows.js';
import type { ReviewGapRow, ReviewRow } from './buildReviewRows.js';
import DiffFileHeader from './DiffFileHeader.vue';
import DiffRowSplit from './DiffRowSplit.vue';
import DiffRowUnified from './DiffRowUnified.vue';
import * as l from './ReviewDiffRow.loc.js';
import type { ReviewFileSizes } from './ReviewFiles.js';
import { formatFileSizes } from './utils/formatFileSizes.js';
import { getFailureText } from './utils/getFailureText.js';
import { getGitHubFileUrl } from './utils/getGitHubFileUrl.js';

const props = defineProps<{
  row: ReviewRow;
  /** Where the pull request's files are on github.com. */
  githubUrl: string;
  /** GitHub took the file's viewed mark off since the last visit (D35). */
  changedSince?: boolean;
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

/** The file a row links to, on the rows that offer the link. */
const linkedPath = computed(() => {
  const { row } = props;
  return row.kind === 'failed' || row.kind === 'paused' || (row.kind === 'notice' && row.notice !== 'empty')
    ? row.file.path
    : null;
});
const fileUrl = shallowRef(props.githubUrl);

watch(
  [linkedPath, () => props.githubUrl],
  async ([path, filesUrl]) => {
    fileUrl.value = filesUrl;
    if (path !== null) {
      const url = await getGitHubFileUrl(filesUrl, path);
      if (linkedPath.value === path) {
        fileUrl.value = url;
      }
    }
  },
  { immediate: true },
);

function getBinaryText(sizes: ReviewFileSizes, changeType: string) {
  const size = formatFileSizes(sizes);
  if (size === null) {
    return t(l.binary);
  }

  switch (changeType) {
    case 'ADDED':
      return t(l.binaryNew, { size });
    case 'DELETED':
      return t(l.binaryDeleted, { size });
    default:
      return t(l.binarySized, { size });
  }
}
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
      :changed-since="changedSince"
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
          :syntax="row.syntax"
        />
        <DiffRowUnified
          v-else
          :line="row.line"
          :diff="row.diff"
          :syntax="row.syntax"
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
      <template v-else-if="row.kind === 'placeholder'">
        <div
          v-if="row.first"
          :class="css.reviewDiffRow_first"
        >
          <LoaderCircle
            :class="css.reviewDiffRow_firstIcon"
            aria-hidden="true"
          />
          {{ t(l.fetchingFirst, { path: row.file.path }) }}
        </div>
        <div
          :class="css.reviewDiffRow_placeholder"
          :style="{ height: `${getPlaceholderHeight(row.file)}px` }"
        />
      </template>
      <div
        v-else-if="row.kind === 'notice'"
        :class="css.reviewDiffRow_notice"
      >
        <FileDiff
          :class="css.reviewDiffRow_noticeIcon"
          aria-hidden="true"
        />
        <div :class="css.reviewDiffRow_noticeText">
          <p :class="css.reviewDiffRow_noticeTitle">
            {{ row.notice === 'binary' ? getBinaryText(row.sizes, row.file.changeType) : t(l[row.notice]) }}
          </p>
          <p
            v-if="row.notice === 'tooLarge'"
            :class="css.reviewDiffRow_noticeDetail"
          >
            {{ t(l.tooLargeDetail, { size: formatBytes(Math.max(row.sizes.before ?? 0, row.sizes.after ?? 0)) }) }}
          </p>
        </div>
        <Button
          v-if="row.notice !== 'empty'"
          size="sm"
          variant="outline"
          :link="fileUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t(l.openOnGitHub) }}
        </Button>
      </div>
      <div
        v-else-if="row.kind === 'paused'"
        :class="css.reviewDiffRow_notice"
      >
        <Pause
          :class="[css.reviewDiffRow_noticeIcon, css.reviewDiffRow_noticeIcon_paused]"
          aria-hidden="true"
        />
        <div :class="css.reviewDiffRow_noticeText">
          <p :class="[css.reviewDiffRow_noticeTitle, css.reviewDiffRow_noticeTitle_paused]">{{ t(l.paused) }}</p>
          <p
            v-if="row.others !== null"
            :class="css.reviewDiffRow_noticeDetail"
          >
            {{
              t(l.pausedDetail, {
                count: row.others,
                formatted: numbers.format(row.others),
                time: formatTime(row.until),
              })
            }}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          :link="fileUrl"
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
          <p :class="css.reviewDiffRow_noticeDetail">{{ getFailureText(row.error) }}</p>
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
          :link="fileUrl"
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

.reviewDiffRow_first {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  height: 40px;
  padding: 0 $spacing-14;
  font-size: 12.5px;
  color: $color-fg-2;
}

.reviewDiffRow_firstIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

// Quiet bars of six lengths over and over, as tall as the file will about take.
.reviewDiffRow_placeholder {
  $bar: linear-gradient(to bottom, $color-bg-3 8px, transparent 8px);

  background-image: $bar, $bar, $bar, $bar, $bar, $bar;
  background-repeat: repeat-y;
  background-position:
    60px 12px,
    60px 29px,
    60px 46px,
    60px 63px,
    60px 80px,
    60px 97px;
  background-size:
    420px 102px,
    300px 102px,
    520px 102px,
    8px 102px,
    360px 102px,
    460px 102px;
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

.reviewDiffRow_noticeIcon_paused {
  color: $color-amber;
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

.reviewDiffRow_noticeTitle_paused {
  color: $color-amber;
}

.reviewDiffRow_noticeDetail {
  font-size: $font-size-xs;
  color: $color-fg-2;
}
</style>
