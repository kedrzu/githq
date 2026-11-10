<!-- One card on an item's thread (`ItemThread`): the writer's avatar in the rail's gutter, level with the card's head — who, "commented" and when, "· edited" once changed, an "Author" chip on the description, its ⋯ — and what they wrote below. Its menu (`menu`) opens from the ⋯ and from a right click on the card. A comment on its way says "Sending…" for its time; one GitHub did not take says "Not sent", in red like its border, with why below it (`footer`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Ellipsis } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import IconButton from '@/components/IconButton.vue';
import Menu from '@/components/Menu.vue';
import type { ItemUser } from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';

import * as l from './ItemThreadCard.loc.js';

const props = defineProps<{
  /** `null` for a deleted account. */
  author: ItemUser | null;
  /** Not given for a comment GitHub did not take (`failed`). */
  createdAt?: string;
  /** Epoch ms the age is counted to. */
  now: number;
  /** The item's description: the "Author" chip, and the age in words ("commented 2 days ago"). */
  description?: boolean;
  edited?: boolean;
  /** On its way to GitHub. */
  sending?: boolean;
  /** GitHub did not take it. */
  failed?: boolean;
}>();

const emit = defineEmits<{
  /** Its menu closed, about to give the focus back; `preventDefault()` keeps it where an entry moved it. */
  menuClose: [event: Event];
}>();

defineSlots<{
  /** What was written. */
  default(): unknown;
  /** The entries of the card's menu, from its ⋯ at the end of its head or a right click on the card. */
  menu?(): unknown;
  /** A band at the bottom of the card, under what was written. */
  footer?(): unknown;
}>();

const t = useTranslate();

const login = computed(() => props.author?.login ?? t(l.deletedUser));
const when = computed(() => {
  if (props.createdAt === undefined) {
    return '';
  }

  const formatWhen = props.description ? formatTimeAgo : formatAge;
  return t(l.commented, { when: formatWhen(Date.parse(props.createdAt), props.now) });
});
</script>

<template>
  <ContextMenu
    :disabled="!$slots.menu"
    @close-auto-focus="emit('menuClose', $event)"
  >
    <div :class="css.itemThreadCard">
      <div :class="css.itemThreadCard_gutter">
        <Avatar
          :name="login"
          :src="author?.avatarUrl"
          size="lg"
          decorative
        />
      </div>
      <div :class="[css.itemThreadCard_card, failed && css.itemThreadCard_failed]">
        <p :class="css.itemThreadCard_head">
          <span :class="css.itemThreadCard_author">{{ login }}</span>
          <span
            v-if="failed"
            :class="[css.itemThreadCard_when, css.itemThreadCard_notSent]"
            >{{ t(l.notSent) }}</span
          >
          <span
            v-else-if="sending"
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
          <Menu
            v-if="$slots.menu"
            align="end"
            @close-auto-focus="emit('menuClose', $event)"
          >
            <template #trigger>
              <IconButton
                :icon="Ellipsis"
                :label="description ? t(l.descriptionMenu) : t(l.commentMenu)"
              />
            </template>
            <slot name="menu" />
          </Menu>
        </p>
        <div :class="css.itemThreadCard_body">
          <slot />
        </div>
        <slot name="footer" />
      </div>
    </div>
    <template #content>
      <slot name="menu" />
    </template>
  </ContextMenu>
</template>

<style lang="scss" module="css">
// Avatars in the thread's gutter, beside the card.
.itemThreadCard {
  display: flex;
  gap: $item-thread-gutter-gap;
}

.itemThreadCard_gutter {
  display: flex;
  flex: none;
  align-items: center;
  width: $item-thread-gutter-width;
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

.itemThreadCard_failed {
  border-color: $color-border-danger-strong;
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

.itemThreadCard_notSent {
  color: $color-red;
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
