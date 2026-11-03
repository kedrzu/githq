<!-- A file in the review's list (CR46): how it changed, its name, an eye once viewed (the name dimmed), a tag for why it starts collapsed (the name dimmed too), its size, and how its content is getting on: a spinner while it loads, a red mark when it failed, a tag for what has no diff. A click jumps to it; only the current row is a Tab stop, as 3000 others would make Tab useless and `[` `]` walk them. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, Eye, LoaderCircle } from 'lucide-vue-next';

import { getFileName } from './utils/getFileName.js';
import ReviewChange from './ReviewChange.vue';
import type { ReviewFile, ReviewFileCollapseReason, ReviewFileState } from './ReviewFiles.js';
import * as l from './ReviewFileRow.loc.js';

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
}>();

const emit = defineEmits<{
  select: [];
}>();

const t = useTranslate();
</script>

<template>
  <button
    type="button"
    :class="[css.reviewFileRow, current && css.reviewFileRow_current, indented && css.reviewFileRow_indented]"
    :title="file.path"
    :tabindex="current ? 0 : -1"
    :aria-current="current ? 'true' : undefined"
    @click="emit('select')"
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
      v-if="state.kind !== 'binary'"
      :class="css.reviewFileRow_size"
    >
      <template v-if="file.additions > 0 || file.deletions === 0">+{{ numbers.format(file.additions) }}</template>
      <template v-if="file.additions > 0 && file.deletions > 0">&nbsp;</template>
      <template v-if="file.deletions > 0">−{{ numbers.format(file.deletions) }}</template>
    </span>
    <LoaderCircle
      v-if="state.kind === 'loading'"
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
