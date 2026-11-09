<!-- One card on an item's thread (`ItemThread`): the writer's avatar in the rail's gutter, level with the card's head — who, "commented" and when, "· edited" once changed, an "Author" chip on the description — and what they wrote below. A comment on its way says "Sending…" for its time. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import type { ItemUser } from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';

import * as l from './ItemThreadCard.loc.js';

const props = defineProps<{
  /** `null` for a deleted account. */
  author: ItemUser | null;
  createdAt: string;
  /** Epoch ms the age is counted to. */
  now: number;
  /** The item's description: the "Author" chip, and the age in words ("commented 2 days ago"). */
  description?: boolean;
  edited?: boolean;
  /** On its way to GitHub. */
  sending?: boolean;
}>();

defineSlots<{
  /** What was written. */
  default(): unknown;
  /** The card's ⋯ at the end of its head. */
  menu?(): unknown;
}>();

const t = useTranslate();

const login = computed(() => props.author?.login ?? t(l.deletedUser));
const when = computed(() => {
  const formatWhen = props.description ? formatTimeAgo : formatAge;
  return t(l.commented, { when: formatWhen(Date.parse(props.createdAt), props.now) });
});
</script>

<template>
  <div :class="css.itemThreadCard">
    <div :class="css.itemThreadCard_gutter">
      <Avatar
        :name="login"
        :src="author?.avatarUrl"
        size="lg"
        decorative
      />
    </div>
    <div :class="css.itemThreadCard_card">
      <p :class="css.itemThreadCard_head">
        <span :class="css.itemThreadCard_author">{{ login }}</span>
        <span
          v-if="sending"
          :class="css.itemThreadCard_when"
          >{{ t(l.sending) }}</span
        >
        <time
          v-else
          :class="css.itemThreadCard_when"
          :datetime="createdAt"
          >{{ when }}</time
        >
        <span
          v-if="edited"
          :class="css.itemThreadCard_when"
          >{{ t(l.edited) }}</span
        >
        <span :class="css.itemThreadCard_spacer" />
        <span
          v-if="description"
          :class="css.itemThreadCard_chip"
          >{{ t(l.authorChip) }}</span
        >
        <slot name="menu" />
      </p>
      <div :class="css.itemThreadCard_body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
// The thread's gap: avatars in a 28px column, 12px from the card.
.itemThreadCard {
  display: flex;
  gap: $spacing-12;
}

.itemThreadCard_gutter {
  display: flex;
  flex: none;
  align-items: center;
  height: 36px;
}

// Its fill hides the rail running behind it.
.itemThreadCard_card {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.itemThreadCard_head {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-10 0 $spacing-14;
  margin: 0;
  white-space: nowrap;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;
}

.itemThreadCard_author {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.itemThreadCard_when {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.itemThreadCard_spacer {
  flex: 1;
}

.itemThreadCard_chip {
  padding: 1px 7px;
  font-size: $font-size-3xs;
  color: $color-fg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-xl;
}

.itemThreadCard_body {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-14 $spacing-16 $spacing-16;
}
</style>
