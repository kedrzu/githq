<!-- One card on an item's thread (`ItemThread`): the writer's avatar in the rail's gutter, level with the card's head — who, "commented" and when (or a review's verdict and when, `verdict`), "· edited" once changed, an "Author" chip on the description, what the head says at its end (`aside`), its ⋯ — and what they wrote below, when anything. The viewer's draft review has an amber border (`pending`), the comment the address links to an accent one (`linked`). Its menu (`menu`) opens from the ⋯ and from a right click on the card — not on GitHub's rendering of what was written, which keeps the browser's own menu, or a githq link's (`GitHubLinks`). A comment on its way says "Sending…" for its time; one GitHub did not take says "Not sent", in red like its border, with why below it (`footer`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Ellipsis } from 'lucide-vue-next';
import { computed, useTemplateRef, watchPostEffect } from 'vue';

import Avatar from '@/components/Avatar.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import IconButton from '@/components/IconButton.vue';
import Menu from '@/components/Menu.vue';
import type { ItemUser } from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';

import * as l from './CommentCard.loc.js';

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
  /** The viewer's draft review: the amber border (`Activity / Review · pending`). */
  pending?: boolean;
  /** The comment the address's fragment names: the accent border (`Activity / Comment · linked`). */
  linked?: boolean;
  /** Said instead of the login: "Your review". */
  name?: string;
  /**
   * Its ⋯ takes the focus: the keyboard goes on from the card after its edit was cancelled or its deletion was not
   * confirmed, rather than from the page — the editor and the dialog are gone with what had it.
   */
  menuFocused?: boolean;
}>();

const emit = defineEmits<{
  /** Its menu closed, about to give the focus back; `preventDefault()` keeps it where an entry moved it. */
  menuClose: [event: Event];
}>();

defineSlots<{
  /** What was written; none, no body (a dismissed review folded). */
  default?(): unknown;
  /** Instead of "commented": a review's verdict, the age after it. */
  verdict?(): unknown;
  /** At the end of the head: a review's threads, "Show review". */
  aside?(): unknown;
  /** The entries of the card's menu, from its ⋯ at the end of its head or a right click on the card. */
  menu?(): unknown;
  /** A band at the bottom of the card, under what was written. */
  footer?(): unknown;
}>();

const t = useTranslate();
const headRef = useTemplateRef<HTMLElement>('head');

const login = computed(() => props.author?.login ?? t(l.deletedUser));
const age = computed(() => {
  if (props.createdAt === undefined) {
    return '';
  }

  const formatWhen = props.description ? formatTimeAgo : formatAge;
  return formatWhen(Date.parse(props.createdAt), props.now);
});

// The ⋯ is the head's only button.
watchPostEffect(() => {
  if (props.menuFocused) {
    headRef.value?.querySelector('button')?.focus();
  }
});
</script>

<template>
  <ContextMenu
    :disabled="!$slots.menu"
    @close-auto-focus="emit('menuClose', $event)"
  >
    <div :class="css.commentCard">
      <div :class="css.commentCard_gutter">
        <Avatar
          :name="login"
          :src="author?.avatarUrl"
          size="lg"
          decorative
        />
      </div>
      <div
        :class="[
          css.commentCard_card,
          failed && css.commentCard_failed,
          pending && css.commentCard_pending,
          linked && css.commentCard_linked,
        ]"
      >
        <p
          ref="head"
          :class="css.commentCard_head"
        >
          <span :class="css.commentCard_author">{{ name ?? login }}</span>
          <slot name="verdict" />
          <span
            v-if="failed"
            :class="[css.commentCard_when, css.commentCard_notSent]"
            >{{ t(l.notSent) }}</span
          >
          <span
            v-else-if="sending"
            :class="css.commentCard_when"
            >{{ t(l.sending) }}</span
          >
          <time
            v-else
            :class="css.commentCard_when"
            :datetime="createdAt"
            >{{ $slots.verdict || age === '' ? age : t(l.commented, { when: age }) }}</time
          >
          <span
            v-if="edited"
            :class="css.commentCard_when"
            >{{ t(l.edited) }}</span
          >
          <span :class="css.commentCard_spacer" />
          <slot name="aside" />
          <span
            v-if="description"
            :class="css.commentCard_chip"
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
        <div
          v-if="$slots.default"
          :class="css.commentCard_body"
        >
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
.commentCard {
  @include item-thread-row;
}

.commentCard_gutter {
  @include item-thread-gutter(36px);
}

// Its fill hides the rail running behind it.
.commentCard_card {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.commentCard_failed {
  border-color: $color-border-danger-strong;
}

.commentCard_pending {
  border-color: rgba($color-amber, 0.5);
}

// The card has a border already: only its colour changes, so nothing moves.
.commentCard_linked {
  border-color: $color-accent;
}

.commentCard_head {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-10 0 $spacing-14;
  margin: 0;
  white-space: nowrap;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;

  // Nothing under it: the card's own border closes it.
  &:last-child {
    border-bottom: 0;
  }
}

.commentCard_author {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.commentCard_when {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commentCard_notSent {
  color: $color-red;
}

.commentCard_spacer {
  flex: 1;
}

.commentCard_chip {
  padding: 1px 7px;
  font-size: $font-size-3xs;
  color: $color-fg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-xl;
}

.commentCard_body {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-14 $spacing-16 $spacing-16;
}
</style>
