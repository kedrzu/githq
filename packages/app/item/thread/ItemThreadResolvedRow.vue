<!-- A resolved thread on an item's thread, folded to one row (`Activity / Resolved threads`, F12): a chevron, a green check, "Resolved", the file — or, where the file is said already, the first line of its first comment — the avatars of who wrote in it, how many comments, and "Show". The whole row is one button: a click or Enter opens the thread. It is a code thread to `J`/`K` (`data-code-thread`, `ItemThread`). -->
<script lang="ts" setup>
import { arrayRemoveDuplicates } from '@nzyme/utils/array/arrayRemoveDuplicates.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronRight, CircleCheck } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';
import { getHtmlFirstLine } from '@/review/utils/getHtmlFirstLine.js';

import * as l from './ItemThreadResolvedRow.loc.js';

const props = defineProps<{
  thread: ReviewThread;
  /** The file is said above it (a code comment's head): the first line of its first comment instead. */
  excerpt?: boolean;
}>();

defineEmits<{
  /** Open the thread. */
  click: [];
}>();

/** Avatars past these say nothing more. */
const MAX_AVATARS = 3;

const t = useTranslate();

/** Who wrote in it, each once, in the order they first did. */
const people = computed(() =>
  arrayRemoveDuplicates(filterNotNull(props.thread.comments.map(comment => comment.author)), author => author.login),
);
const firstLine = computed(() => getHtmlFirstLine(props.thread.comments[0]?.bodyHTML ?? ''));
</script>

<template>
  <button
    type="button"
    :class="css.itemThreadResolvedRow"
    :data-code-thread="thread.id"
    aria-expanded="false"
    @click="$emit('click')"
  >
    <ChevronRight
      :class="css.itemThreadResolvedRow_chevron"
      aria-hidden="true"
    />
    <CircleCheck
      :class="css.itemThreadResolvedRow_check"
      aria-hidden="true"
    />
    <span :class="css.itemThreadResolvedRow_state">{{ t(l.resolved) }}</span>
    <span
      v-if="excerpt"
      :class="css.itemThreadResolvedRow_excerpt"
      >{{ firstLine }}</span
    >
    <span
      v-else
      :class="css.itemThreadResolvedRow_path"
      >{{ thread.path }}</span
    >
    <span :class="css.itemThreadResolvedRow_spacer" />
    <span :class="css.itemThreadResolvedRow_people">
      <Avatar
        v-for="person in people.slice(0, MAX_AVATARS)"
        :key="person.login"
        :class="css.itemThreadResolvedRow_avatar"
        :name="person.login"
        :src="person.avatarUrl"
        size="xs"
      />
    </span>
    <span :class="css.itemThreadResolvedRow_count">{{ t(l.comments, { count: thread.comments.length }) }}</span>
    <span :class="css.itemThreadResolvedRow_show">{{ t(l.show) }}</span>
  </button>
</template>

<style lang="scss" module="css">
.itemThreadResolvedRow {
  @include focus-ring;

  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 0 $spacing-12;
  font: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;

  &:hover {
    background: $color-bg-2;
  }
}

.itemThreadResolvedRow_chevron {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.itemThreadResolvedRow_check {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-green;
}

.itemThreadResolvedRow_state {
  flex: none;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.itemThreadResolvedRow_path,
.itemThreadResolvedRow_excerpt {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-dim;
  text-overflow: ellipsis;
}

.itemThreadResolvedRow_path {
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
}

.itemThreadResolvedRow_excerpt {
  font-size: $font-size-xs;
}

.itemThreadResolvedRow_spacer {
  flex: 1;
}

.itemThreadResolvedRow_people {
  display: flex;
  flex: none;
}

// Overlapping, each ringed in the row's fill.
.itemThreadResolvedRow_avatar {
  box-shadow: 0 0 0 1.5px $color-bg;

  & + & {
    margin-left: -$spacing-4;
  }
}

.itemThreadResolvedRow_count {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.itemThreadResolvedRow_show {
  flex: none;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-accent;
}
</style>
