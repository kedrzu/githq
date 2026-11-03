<!-- What a comment and a review summary share: the avatar, who, how long ago with a link to it on GitHub, room for a verdict between them and for a note after, and whatever it says under that. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import { useNow } from '@/services/useNow.js';
import type { ItemUser } from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import * as l from './ReviewCommentFrame.loc.js';

const props = defineProps<{
  /** `null` for an account that no longer exists. */
  author: ItemUser | null;
  url: string;
  createdAt: string;
  /** A little more room under the head, as a review summary has. */
  spaced?: boolean;
}>();

/** How often "12m" moves on. */
const TICK_MS = 60_000;

const t = useTranslate();
const now = useNow(TICK_MS);
const age = computed(() => formatAge(Date.parse(props.createdAt), now.value));
</script>

<template>
  <div :class="css.reviewCommentFrame">
    <Avatar
      :name="author?.login ?? t(l.ghost)"
      :src="author?.avatarUrl"
      decorative
    />
    <div :class="[css.reviewCommentFrame_body, spaced && css.reviewCommentFrame_body_spaced]">
      <p :class="css.reviewCommentFrame_meta">
        <span :class="css.reviewCommentFrame_author">{{ author?.login ?? t(l.ghost) }}</span>
        <slot name="verdict" />
        <a
          :class="css.reviewCommentFrame_age"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t(l.openOnGitHub, { age })"
          :title="t(l.openOnGitHub, { age })"
          ><time :datetime="createdAt">{{ age }}</time></a
        >
        <slot name="note" />
      </p>
      <slot />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewCommentFrame {
  display: flex;
  gap: $spacing-10;
}

.reviewCommentFrame_body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.reviewCommentFrame_body_spaced {
  gap: $spacing-4;
}

.reviewCommentFrame_meta {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  margin: 0;
}

.reviewCommentFrame_author {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.reviewCommentFrame_age {
  @include focus-ring;

  flex: none;
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
