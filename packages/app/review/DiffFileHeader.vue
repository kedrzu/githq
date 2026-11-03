<!-- A file's head in the diff (D24), pinned while the file is in view: how it changed, its folder and name, where a renamed file came from, why it starts collapsed, that GitHub took its viewed mark off since the last visit (D35), its threads (CR2), its size, if it has lines to count, and its viewed mark (`V`). One gone from the diff (D30) has only a file-x, a struck name that says so, and its threads. A click anywhere on it, or Space, collapses the file or opens it (D8); the chevron is that for the keyboard and for screen readers. Its own edge closes the block when nothing shows under it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, ChevronRight, FileX, MessageSquare, Square, SquareCheckBig } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import PullRequestSize from '@/lists/PullRequestSize.vue';

import * as l from './DiffFileHeader.loc.js';
import { getFileFolder } from './utils/getFileFolder.js';
import { getFileName } from './utils/getFileName.js';
import ReviewChange from './ReviewChange.vue';
import type { ReviewFile, ReviewFileCollapseReason } from './ReviewFiles.js';
import type { ThreadCounts } from './threads/countThreads.js';

const props = defineProps<{
  file: ReviewFile;
  /** Only the header shows. */
  collapsed: boolean;
  /** Why it starts collapsed, also once opened. */
  collapseReason: ReviewFileCollapseReason | null;
  /** GitHub took its viewed mark off since the last visit. */
  changedSince?: boolean;
  /** Its threads under it: it closes the block only without them. */
  threadsUnder?: boolean;
  threads?: ThreadCounts | null;
}>();

const emit = defineEmits<{
  toggleCollapsed: [];
  toggleViewed: [];
}>();

const t = useTranslate();

const folder = computed(() => getFileFolder(props.file.path));
const viewed = computed(() => props.file.viewed === 'VIEWED');
const threadsText = computed(() => {
  const { threads } = props;
  if (!threads) {
    return null;
  }

  const said = [
    threads.open > 0 && t(l.threadsOpen, { count: threads.open }),
    threads.outdated > 0 && t(l.threadsOutdated, { count: threads.outdated }),
    threads.lineGone > 0 && t(l.threadsLineGone, { count: threads.lineGone }),
    threads.resolved > 0 && t(l.threadsResolved, { count: threads.resolved }),
  ];
  return said.filter(Boolean).join(' · ');
});

const goneText = computed(() => {
  const { gone } = props.file;
  switch (gone?.kind) {
    case 'deletedAgain':
      return t(l.deletedAgain, { added: gone.added, deleted: gone.deleted });
    case 'notListed':
      return t(l.notListed);
    default:
      return t(l.notInDiff);
  }
});

function onClick(event: MouseEvent) {
  // The buttons say for themselves.
  if (!props.file.gone && !(event.target instanceof Element && event.target.closest('button'))) {
    emit('toggleCollapsed');
  }
}
</script>

<template>
  <div
    :class="[
      css.diffFileHeader,
      collapsed && !threadsUnder && css.diffFileHeader_collapsed,
      file.gone && css.diffFileHeader_gone,
    ]"
    @click="onClick"
  >
    <FileX
      v-if="file.gone"
      :class="css.diffFileHeader_goneIcon"
      aria-hidden="true"
    />
    <IconButton
      v-if="!file.gone"
      :icon="collapsed ? ChevronRight : ChevronDown"
      :label="collapsed ? t(l.expand) : t(l.collapse)"
      kbd="Space"
      aria-keyshortcuts="Space"
      @click="emit('toggleCollapsed')"
    />
    <ReviewChange
      v-if="!file.gone"
      :change="file.changeType"
    />
    <h3 :class="css.diffFileHeader_path">
      <span
        v-if="folder !== null"
        :class="css.diffFileHeader_folder"
        >{{ folder }}/</span
      ><span
        :class="[
          css.diffFileHeader_name,
          viewed && css.diffFileHeader_name_viewed,
          file.gone && css.diffFileHeader_name_gone,
        ]"
        >{{ getFileName(file.path) }}</span
      >
    </h3>
    <span
      v-if="file.gone"
      :class="css.diffFileHeader_from"
      >{{ goneText }}</span
    >
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
    <span
      v-if="threadsText"
      :class="css.diffFileHeader_threads"
    >
      <MessageSquare
        :class="css.diffFileHeader_threadsIcon"
        aria-hidden="true"
      />{{ threadsText }}
    </span>
    <PullRequestSize
      v-if="file.additions + file.deletions > 0"
      :class="css.diffFileHeader_size"
      :additions="file.additions"
      :deletions="file.deletions"
    />
    <Button
      v-if="!file.gone"
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

.diffFileHeader_gone {
  cursor: default;
}

.diffFileHeader_goneIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
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

.diffFileHeader_name_gone {
  color: $color-fg-2;
  text-decoration: line-through;
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

.diffFileHeader_threads {
  display: inline-flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  font-size: 11.5px;
  color: $color-amber;
  white-space: nowrap;
}

.diffFileHeader_threadsIcon {
  width: 12px;
  height: 12px;
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
