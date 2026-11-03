<!-- A file's head in the diff (D24), pinned while the file is in view: how it changed, its folder and name, where a renamed file came from, and its size, if it has lines to count. The chevron is drawn for what collapsing will do; it does nothing yet. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown } from 'lucide-vue-next';
import { computed } from 'vue';

import * as l from './DiffFileHeader.loc.js';
import { getFileFolder, getFileName } from './groupReviewFiles.js';
import ReviewChange from './ReviewChange.vue';
import type { ReviewFile } from './ReviewFiles.js';

const props = defineProps<{
  file: ReviewFile;
}>();

const t = useTranslate();

const folder = computed(() => getFileFolder(props.file.path));
</script>

<template>
  <div :class="css.diffFileHeader">
    <ChevronDown
      :class="css.diffFileHeader_chevron"
      aria-hidden="true"
    />
    <ReviewChange :change="file.changeType" />
    <h3 :class="css.diffFileHeader_path">
      <span
        v-if="folder !== null"
        :class="css.diffFileHeader_folder"
        >{{ folder }}/</span
      ><span :class="css.diffFileHeader_name">{{ getFileName(file.path) }}</span>
    </h3>
    <span
      v-if="file.previousPath !== null"
      :class="css.diffFileHeader_from"
      >{{ t(l.renamedFrom, { path: file.previousPath }) }}</span
    >
    <span :class="css.diffFileHeader_spacer" />
    <template v-if="file.additions + file.deletions > 0">
      <span :class="css.diffFileHeader_added">+{{ numbers.format(file.additions) }}</span>
      <span :class="css.diffFileHeader_deleted">−{{ numbers.format(file.deletions) }}</span>
    </template>
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
}

.diffFileHeader_chevron {
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

.diffFileHeader_added,
.diffFileHeader_deleted {
  flex: none;
  font-family: $font-family-mono;
  font-size: 11px;
}

.diffFileHeader_added {
  color: $color-green;
}

.diffFileHeader_deleted {
  color: $color-red;
}
</style>
