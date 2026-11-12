<!-- The code a thread on an item's thread was written on (`Activity / Code excerpt`), from its first comment's `diffHunk`: a head with the file — its folder dim, its name, a link to the thread in the pull request's review, underlined under the pointer — the lines it is on and, once the code moved on, "Outdated"; then the hunk's last few lines, ending on the commented one, with their numbers and diff colours. The lines keep their width and scroll sideways in the frame, which the keyboard can scroll too. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { FileCode, History } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { getReviewCommentPath } from '@/item/itemRoutes.js';
import { parseDiffHunk } from '@/review/threads/parseDiffHunk.js';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';
import { getFileFolder } from '@/review/utils/getFileFolder.js';
import { getFileName } from '@/review/utils/getFileName.js';

import * as l from './ItemThreadExcerpt.loc.js';

const props = defineProps<{
  thread: ReviewThread;
}>();

/** A hunk can run from far above the comment. */
const MAX_LINES = 4;

const t = useTranslate();

const folder = computed(() => getFileFolder(props.thread.path));
const name = computed(() => getFileName(props.thread.path));
/** The thread in the review; none for one GitHub has no anchor for yet. */
const reviewPath = computed(() => getReviewCommentPath(props.thread.comments[0]?.url ?? ''));
const lines = computed(() => parseDiffHunk(props.thread.comments[0]?.diffHunk ?? '').slice(-MAX_LINES));
/** Where it is on the code it was written on: an outdated thread's lines now are of no use. */
const range = computed(() => {
  const { thread } = props;
  if (thread.subjectType === 'FILE') {
    return null;
  }

  const end = thread.isOutdated ? thread.originalLine : thread.line;
  const start = (thread.isOutdated ? thread.originalStartLine : thread.startLine) ?? end;
  if (end === null || start === null) {
    return null;
  }

  return start === end ? t(l.line, { line: end }) : t(l.lines, { start, end });
});
</script>

<template>
  <figure :class="css.itemThreadExcerpt">
    <figcaption :class="css.itemThreadExcerpt_head">
      <FileCode
        :class="css.itemThreadExcerpt_icon"
        aria-hidden="true"
      />
      <component
        :is="reviewPath ? RouterLink : 'span'"
        :to="reviewPath ?? undefined"
        :class="[css.itemThreadExcerpt_path, reviewPath && css.itemThreadExcerpt_path_link]"
      >
        <span
          v-if="folder !== null"
          :class="css.itemThreadExcerpt_folder"
          >{{ folder }}/</span
        ><span :class="css.itemThreadExcerpt_name">{{ name }}</span>
      </component>
      <span
        v-if="range !== null"
        :class="css.itemThreadExcerpt_lines"
        >{{ range }}</span
      >
      <span :class="css.itemThreadExcerpt_spacer" />
      <span
        v-if="thread.isOutdated"
        :class="css.itemThreadExcerpt_outdated"
      >
        <History
          :class="css.itemThreadExcerpt_outdatedIcon"
          aria-hidden="true"
        />
        {{ t(l.outdated) }}
      </span>
    </figcaption>
    <!-- Focusable: a line wider than the frame is read by scrolling it, from the keyboard too. -->
    <div
      v-if="lines.length > 0"
      :class="css.itemThreadExcerpt_code"
      role="region"
      :aria-label="t(l.code, { path: thread.path })"
      tabindex="0"
    >
      <div :class="css.itemThreadExcerpt_rows">
        <div
          v-for="(line, index) in lines"
          :key="index"
          :class="[
            css.itemThreadExcerpt_line,
            line.sign === '+' && css.itemThreadExcerpt_line_added,
            line.sign === '-' && css.itemThreadExcerpt_line_deleted,
          ]"
        >
          <span :class="css.itemThreadExcerpt_old">{{ line.oldLine }}</span>
          <span :class="css.itemThreadExcerpt_new">{{ line.newLine }}</span>
          <span :class="css.itemThreadExcerpt_sign">{{ line.sign }}</span>
          <code :class="css.itemThreadExcerpt_text">{{ line.text }}</code>
        </div>
      </div>
    </div>
  </figure>
</template>

<style lang="scss" module="css">
.itemThreadExcerpt {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.itemThreadExcerpt_head {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  height: 30px;
  padding: 0 $spacing-10;
  white-space: nowrap;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;

  &:last-child {
    border-bottom: 0;
  }
}

.itemThreadExcerpt_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.itemThreadExcerpt_path {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  text-overflow: ellipsis;
}

.itemThreadExcerpt_path_link {
  @include focus-ring;

  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.itemThreadExcerpt_folder {
  color: $color-fg-dim;
}

.itemThreadExcerpt_name {
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.itemThreadExcerpt_lines {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-3xs;
  color: $color-fg-dim;
}

.itemThreadExcerpt_spacer {
  flex: 1;
}

.itemThreadExcerpt_outdated {
  display: flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  font-size: $font-size-2xs;
  color: $color-amber;
}

.itemThreadExcerpt_outdatedIcon {
  width: 12px;
  height: 12px;
}

.itemThreadExcerpt_code {
  @include focus-ring;

  overflow-x: auto;
}

// As wide as its widest line: every row's colour reaches the end of the scroll.
.itemThreadExcerpt_rows {
  min-width: max-content;
}

.itemThreadExcerpt_line {
  display: flex;
  height: 20px;
  padding-right: $spacing-10;
  font-family: $font-family-mono;
  line-height: 20px;
  color: $color-fg;
}

.itemThreadExcerpt_line_added {
  background: $color-diff-bg-added;

  .itemThreadExcerpt_old,
  .itemThreadExcerpt_new,
  .itemThreadExcerpt_sign {
    color: $color-green;
  }
}

.itemThreadExcerpt_line_deleted {
  background: $color-diff-bg-deleted;

  .itemThreadExcerpt_old,
  .itemThreadExcerpt_new,
  .itemThreadExcerpt_sign {
    color: $color-red;
  }
}

.itemThreadExcerpt_old,
.itemThreadExcerpt_new {
  flex: none;
  font-size: $font-size-3xs;
  color: $color-fg-dim;
  text-align: right;
  user-select: none;
}

.itemThreadExcerpt_old {
  width: 36px;
}

.itemThreadExcerpt_new {
  width: 44px;
}

.itemThreadExcerpt_sign {
  flex: none;
  width: 28px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-align: center;
  white-space: pre;
  user-select: none;
}

.itemThreadExcerpt_text {
  font-family: inherit;
  font-size: $font-size-xs;
  font-variant-ligatures: none;
  tab-size: 4;
  white-space: pre;
}
</style>
