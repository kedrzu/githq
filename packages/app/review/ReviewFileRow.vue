<!-- A file in the review's list (CR46): how it changed, its name, an eye once viewed (the name dimmed), a tag for why it starts collapsed (the name dimmed too), its size, and how its content is getting on: a spinner until it is here, a red mark when it failed, an amber pause while it waits for GitHub's allowance, a tag for what has no diff, with a binary file's sizes in place of its lines. A file GitHub took the viewed mark off since the last visit is tagged (D35). While a filter is on its folder follows its name (D27). Selected together with others it is tinted (D10). A click jumps to it, or with a modifier selects; only the current row is a Tab stop, as 3000 others would make Tab useless and `[` `]` walk them. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, Eye, LoaderCircle, Pause } from 'lucide-vue-next';

import PullRequestSize from '@/lists/PullRequestSize.vue';

import { getFileFolder } from './utils/getFileFolder.js';
import { getFileName } from './utils/getFileName.js';
import ReviewChange from './ReviewChange.vue';
import type { ReviewFile, ReviewFileCollapseReason, ReviewFileState } from './ReviewFiles.js';
import * as l from './ReviewFileRow.loc.js';
import { formatFileSizes } from './utils/formatFileSizes.js';

defineProps<{
  file: ReviewFile;
  state: ReviewFileState;
  /** The diff shows only its header. */
  collapsed: boolean;
  /** Why it starts collapsed. */
  collapseReason: ReviewFileCollapseReason | null;
  /** The file the diff is at. */
  current?: boolean;
  /** Under a folder's label. */
  indented?: boolean;
  /** Among the files selected together. */
  selected?: boolean;
  /** Its folder follows its name, there being no label for it. */
  showFolder?: boolean;
  /** GitHub took its viewed mark off since the last visit. */
  changedSince?: boolean;
}>();

const emit = defineEmits<{
  select: [event: MouseEvent];
}>();

const t = useTranslate();
</script>

<template>
  <button
    type="button"
    :class="[
      css.reviewFileRow,
      selected && css.reviewFileRow_selected,
      current && css.reviewFileRow_current,
      indented && css.reviewFileRow_indented,
    ]"
    :title="file.path"
    :tabindex="current ? 0 : -1"
    :aria-current="current ? 'true' : undefined"
    :aria-pressed="selected ? 'true' : undefined"
    @click="emit('select', $event)"
  >
    <ReviewChange :change="file.changeType" />
    <span :class="[css.reviewFileRow_name, (file.viewed === 'VIEWED' || collapsed) && css.reviewFileRow_name_dim]">{{
      getFileName(file.path)
    }}</span>
    <Eye
      v-if="file.viewed === 'VIEWED'"
      :class="css.reviewFileRow_viewed"
      role="img"
      :aria-label="t(l.viewed)"
    />
    <span
      v-if="showFolder"
      :class="css.reviewFileRow_folder"
      >{{ getFileFolder(file.path) }}</span
    >
    <span
      v-if="changedSince"
      :class="[css.reviewFileRow_tag, css.reviewFileRow_tag_changed]"
      >{{ t(l.changedSince) }}</span
    >
    <span
      v-if="collapsed && collapseReason"
      :class="css.reviewFileRow_tag"
      >{{ t(l[collapseReason]) }}</span
    >
    <span
      v-if="state.kind === 'binary'"
      :class="css.reviewFileRow_tag"
      >{{ t(l.binary) }}</span
    >
    <span
      v-else-if="state.kind === 'tooLarge'"
      :class="css.reviewFileRow_tag"
      >{{ t(l.tooLarge) }}</span
    >
    <span :class="css.reviewFileRow_spacer" />
    <span
      v-if="state.kind === 'binary'"
      :class="css.reviewFileRow_size"
      >{{ formatFileSizes(state) }}</span
    >
    <PullRequestSize
      v-else
      :class="css.reviewFileRow_size"
      :additions="file.additions"
      :deletions="file.deletions"
    />
    <LoaderCircle
      v-if="state.kind === 'loading' || (state.kind === 'waiting' && !collapsed)"
      :class="[css.reviewFileRow_status, css.reviewFileRow_status_loading]"
      role="img"
      :aria-label="t(l.loading)"
    />
    <CircleAlert
      v-else-if="state.kind === 'failed'"
      :class="[css.reviewFileRow_status, css.reviewFileRow_status_failed]"
      role="img"
      :aria-label="t(l.failed)"
    />
    <Pause
      v-else-if="state.kind === 'paused'"
      :class="[css.reviewFileRow_status, css.reviewFileRow_status_paused]"
      role="img"
      :aria-label="t(l.paused)"
    />
  </button>
</template>

<style lang="scss" module="css">
.reviewFileRow {
  @include focus-ring;

  display: flex;
  gap: $spacing-7;
  align-items: center;
  width: 100%;
  height: 26px;
  padding: 0 $spacing-8;
  color: $color-fg;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 5px;

  &:hover {
    background: $color-bg-2;
  }

  &:focus-visible {
    outline-offset: -2px;
  }
}

.reviewFileRow_current,
.reviewFileRow_current:hover {
  background: $color-bg-3;
}

.reviewFileRow_selected,
.reviewFileRow_selected:hover {
  background: $color-sel;
}

.reviewFileRow_indented {
  padding-left: $spacing-8 + $spacing-10;
}

.reviewFileRow_name {
  overflow: hidden;
  font-size: $font-size-sm;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewFileRow_name_dim {
  color: $color-fg-2;
}

.reviewFileRow_folder {
  overflow: hidden;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewFileRow_viewed,
.reviewFileRow_status {
  flex: none;
  width: 12px;
  height: 12px;
}

.reviewFileRow_viewed {
  color: $color-fg-3;
}

.reviewFileRow_tag {
  flex: none;
  font-family: $font-family-mono;
  font-size: 10px;
  color: $color-fg-dim;
}

.reviewFileRow_tag_changed {
  color: $color-accent;
}

.reviewFileRow_spacer {
  flex: 1;
}

.reviewFileRow_size {
  flex: none;
  font-family: $font-family-mono;
  font-size: 10.5px;
  color: $color-fg-dim;
  white-space: nowrap;
}

.reviewFileRow_status_loading {
  color: $color-fg-3;
  animation: spin 1s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.reviewFileRow_status_failed {
  color: $color-red;
}

.reviewFileRow_status_paused {
  color: $color-amber;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
