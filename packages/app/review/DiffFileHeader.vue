<!-- A file's head in the diff (D24), pinned while the file is in view: how it changed, its folder and name, where a renamed file came from, why it starts collapsed, that GitHub took its viewed mark off since the last visit (D35), its size, if it has lines to count, and its viewed mark (`V`). A click anywhere on it, or Space, collapses the file or opens it (D8); the chevron is that for the keyboard and for screen readers. Its own edge closes the block when nothing shows under it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, ChevronRight, Square, SquareCheckBig } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import PullRequestSize from '@/lists/PullRequestSize.vue';

import * as l from './DiffFileHeader.loc.js';
import { getFileFolder } from './utils/getFileFolder.js';
import { getFileName } from './utils/getFileName.js';
import ReviewChange from './ReviewChange.vue';
import type { ReviewFile, ReviewFileCollapseReason } from './ReviewFiles.js';

const props = defineProps<{
  file: ReviewFile;
  /** Only the header shows. */
  collapsed: boolean;
  /** Why it starts collapsed, also once opened. */
  collapseReason: ReviewFileCollapseReason | null;
  /** GitHub took its viewed mark off since the last visit. */
  changedSince?: boolean;
}>();

const emit = defineEmits<{
  toggleCollapsed: [];
  toggleViewed: [];
}>();

const t = useTranslate();

const folder = computed(() => getFileFolder(props.file.path));
const viewed = computed(() => props.file.viewed === 'VIEWED');

function onClick(event: MouseEvent) {
  // The buttons say for themselves.
  if (!(event.target instanceof Element && event.target.closest('button'))) {
    emit('toggleCollapsed');
  }
}
</script>

<template>
  <div
    :class="[css.diffFileHeader, collapsed && css.diffFileHeader_collapsed]"
    @click="onClick"
  >
    <IconButton
      :icon="collapsed ? ChevronRight : ChevronDown"
      :label="collapsed ? t(l.expand) : t(l.collapse)"
      kbd="Space"
      aria-keyshortcuts="Space"
      @click="emit('toggleCollapsed')"
    />
    <ReviewChange :change="file.changeType" />
    <h3 :class="css.diffFileHeader_path">
      <span
        v-if="folder !== null"
        :class="css.diffFileHeader_folder"
        >{{ folder }}/</span
      ><span :class="[css.diffFileHeader_name, viewed && css.diffFileHeader_name_viewed]">{{
        getFileName(file.path)
      }}</span>
    </h3>
    <span
      v-if="file.previousPath !== null"
      :class="css.diffFileHeader_from"
      >{{ t(l.renamedFrom, { path: file.previousPath }) }}</span
    >
    <span
      v-if="collapseReason"
      :class="css.diffFileHeader_why"
      >{{ t(l[collapseReason]) }}</span
    >
    <span
      v-if="changedSince"
      :class="[css.diffFileHeader_why, css.diffFileHeader_why_changed]"
      >{{ t(l.changedSince) }}</span
    >
    <span :class="css.diffFileHeader_spacer" />
    <PullRequestSize
      v-if="file.additions + file.deletions > 0"
      :class="css.diffFileHeader_size"
      :additions="file.additions"
      :deletions="file.deletions"
    />
    <Button
      :class="[css.diffFileHeader_viewed, viewed && css.diffFileHeader_viewed_on]"
      variant="outline"
      size="sm"
      :icon="viewed ? SquareCheckBig : Square"
      kbd="V"
      aria-keyshortcuts="V"
      :aria-pressed="viewed"
      @click="emit('toggleViewed')"
    >
      {{ t(l.viewed) }}
    </Button>
  </div>
</template>

<style lang="scss" module="css">
.diffFileHeader {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  height: 38px;
  padding: 0 $spacing-10 0 $spacing-12;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-lg $radius-lg 0 0;
  cursor: pointer;
}

.diffFileHeader_collapsed {
  border-radius: $radius-lg;
}

.diffFileHeader_path {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: $font-size-sm;
  font-weight: $font-weight-normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diffFileHeader_folder {
  color: $color-fg-dim;
}

.diffFileHeader_name {
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.diffFileHeader_name_viewed {
  color: $color-fg-2;
}

.diffFileHeader_why {
  flex: none;
  padding: 1px $spacing-6;
  font-size: 11px;
  color: $color-fg-2;
  white-space: nowrap;
  border: 1px solid $color-border-2;
  border-radius: 4px;
}

.diffFileHeader_why_changed {
  color: $color-accent;
}

.diffFileHeader_from {
  flex-shrink: 2;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diffFileHeader_spacer {
  flex: 1;
}

.diffFileHeader_size {
  font-size: 11px;
}

.diffFileHeader_viewed {
  flex: none;
}

.diffFileHeader_viewed_on {
  color: $color-fg;
  background: color-mix(in srgb, #{$color-accent} 12%, transparent);
  border-color: color-mix(in srgb, #{$color-accent} 40%, transparent);

  svg:first-of-type {
    color: $color-accent;
  }
}
</style>
