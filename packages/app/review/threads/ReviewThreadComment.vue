<!-- A comment of a review thread (`Review / Comment`): the avatar, who, how long ago, a link to it on GitHub, and its body as GitHub rendered and sanitized it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import GitHubHtml from '@/item/GitHubHtml.vue';
import { useNow } from '@/services/useNow.js';
import { formatAge } from '@/utils/formatAge.js';

import * as l from './ReviewThreadComment.loc.js';
import type { ReviewThreadComment } from './ReviewThread.js';

const props = defineProps<{
  comment: ReviewThreadComment;
}>();

/** How often "12m" moves on. */
const TICK_MS = 60_000;

const t = useTranslate();
const now = useNow(TICK_MS);
const age = computed(() => formatAge(Date.parse(props.comment.createdAt), now.value));
</script>

<template>
  <div :class="css.reviewThreadComment">
    <Avatar
      :name="comment.author?.login ?? t(l.ghost)"
      :src="comment.author?.avatarUrl"
      decorative
    />
    <div :class="css.reviewThreadComment_body">
      <p :class="css.reviewThreadComment_meta">
        <span :class="css.reviewThreadComment_author">{{ comment.author?.login ?? t(l.ghost) }}</span>
        <a
          :class="css.reviewThreadComment_age"
          :href="comment.url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t(l.openOnGitHub, { age })"
          :title="t(l.openOnGitHub, { age })"
          ><time :datetime="comment.createdAt">{{ age }}</time></a
        >
      </p>
      <GitHubHtml :html="comment.bodyHTML" />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewThreadComment {
  display: flex;
  gap: $spacing-10;
}

.reviewThreadComment_body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.reviewThreadComment_meta {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  margin: 0;
}

.reviewThreadComment_author {
  font-size: 12.5px;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.reviewThreadComment_age {
  @include focus-ring;

  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-decoration: none;
  border-radius: 3px;

  &:hover {
    color: $color-fg-2;
    text-decoration: underline;
  }
}
</style>
