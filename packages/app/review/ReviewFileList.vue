<!-- The review's list of files (CR46): how many and how many are viewed, then the files in GitHub's tree order, those at the root first and each folder's under a quiet label, a click on one jumping to it. It follows the file the diff is at, keeping its row in view. Up to 3000 rows, drawn whole: the browser skips laying out those off screen. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Folder } from 'lucide-vue-next';
import { computed, nextTick, useTemplateRef, watch } from 'vue';

import type { ReviewFileGroup } from './groupReviewFiles.js';
import * as l from './ReviewFileList.loc.js';
import ReviewFileRow from './ReviewFileRow.vue';
import type { ReviewFileState } from './ReviewFiles.js';

const props = defineProps<{
  groups: readonly ReviewFileGroup[];
  getState: (path: string) => ReviewFileState;
  /** The file the diff is at. */
  currentPath: string | null;
  /** How many files the pull request really has, once known: GitHub lists at most 3000. */
  changedFiles: number | null;
  /** Whether `groups` is all GitHub lists: until then the rest is on its way, not beyond what it lists. */
  listComplete: boolean;
}>();

const emit = defineEmits<{
  select: [path: string];
}>();

const t = useTranslate();
const scroller = useTemplateRef<HTMLElement>('scroller');

const files = computed(() => props.groups.flatMap(group => group.files));
const listed = computed(() => files.value.length);
const viewed = computed(() => files.value.filter(file => file.viewed === 'VIEWED').length);
const hasMore = computed(() => props.changedFiles !== null && props.changedFiles > listed.value);

watch(
  () => props.currentPath,
  async () => {
    await nextTick();
    scroller.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  },
  { immediate: true },
);
</script>

<template>
  <section
    :class="css.reviewFileList"
    :aria-label="t(l.files)"
  >
    <header :class="css.reviewFileList_head">
      <h2 :class="css.reviewFileList_title">{{ t(l.files) }}</h2>
      <span :class="css.reviewFileList_count">{{
        hasMore ? t(l.moreThanListed, { listed: numbers.format(listed) }) : numbers.format(listed)
      }}</span>
      <span :class="css.reviewFileList_spacer" />
      <span :class="css.reviewFileList_count">{{
        t(l.viewed, { viewed: numbers.format(viewed), total: numbers.format(listed) })
      }}</span>
    </header>
    <div
      ref="scroller"
      :class="css.reviewFileList_scroll"
    >
      <ul :class="css.reviewFileList_groups">
        <li
          v-for="group in groups"
          :key="group.folder ?? ''"
        >
          <div
            v-if="group.folder !== null"
            :class="css.reviewFileList_folder"
          >
            <Folder
              :class="css.reviewFileList_folderIcon"
              aria-hidden="true"
            />
            <span :class="css.reviewFileList_folderPath">{{ group.folder }}</span>
          </div>
          <ul :class="css.reviewFileList_files">
            <li
              v-for="file in group.files"
              :key="file.path"
              :class="css.reviewFileList_file"
            >
              <ReviewFileRow
                :file="file"
                :state="getState(file.path)"
                :current="file.path === currentPath"
                :indented="group.folder !== null"
                @select="emit('select', file.path)"
              />
            </li>
          </ul>
        </li>
      </ul>
      <p
        v-if="hasMore && listComplete"
        :class="css.reviewFileList_foot"
      >
        {{ t(l.listedOnly, { listed: numbers.format(listed), total: numbers.format(changedFiles ?? 0) }) }}
      </p>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.reviewFileList {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.reviewFileList_head {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: baseline;
  padding: $spacing-10 $spacing-12 $spacing-8;
  border-bottom: 1px solid $color-border;
}

.reviewFileList_title {
  margin: 0;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.reviewFileList_count {
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
}

.reviewFileList_spacer {
  flex: 1;
}

.reviewFileList_scroll {
  flex: 1;
  min-height: 0;
  padding: $spacing-6;
  overflow-y: auto;
}

.reviewFileList_groups,
.reviewFileList_files {
  padding: 0;
  margin: 0;
  list-style: none;
}

.reviewFileList_files {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

// 3000 rows are laid out only when near the screen.
.reviewFileList_file {
  content-visibility: auto;
  contain-intrinsic-size: auto 26px;
}

.reviewFileList_folder {
  display: flex;
  gap: $spacing-6;
  align-items: flex-end;
  height: 24px;
  padding: 0 $spacing-8 3px;
}

.reviewFileList_folderIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.reviewFileList_folderPath {
  overflow: hidden;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewFileList_foot {
  padding: $spacing-8;
  margin: 0;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
