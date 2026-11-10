<!-- A comment on the code posted on its own, without a review (`Activity / Code comment`, F5, F12): the writer's avatar in the gutter, "dkim commented on src/store/schema.ts 2d" level with it, and the thread under it (`ItemThreadCodeThread`) — resolved, folded to its row with the first line of its first comment (`ItemThreadResolvedRow`) until opened, Hide folding it again. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, ref } from 'vue';

import Avatar from '@/components/Avatar.vue';
import type { ItemUser } from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import type { ThreadCodeComment } from './buildThread.js';
import type { CodeThreadReplies } from './CodeThreadReplies.js';
import * as l from './ItemThreadCodeComment.loc.js';
import ItemThreadCodeThread from './ItemThreadCodeThread.vue';
import ItemThreadResolvedRow from './ItemThreadResolvedRow.vue';

const props = defineProps<{
  entry: ThreadCodeComment;
  /** Epoch ms the age is counted to. */
  now: number;
  /** Who is signed in: the reply band's avatar. */
  viewer?: ItemUser | null;
  /** The viewer's replies in the thread; resolved, being replied to, it shows opened. */
  replies?: CodeThreadReplies | null;
}>();

const emit = defineEmits<{
  /** "Reply…" was clicked. */
  reply: [];
  /** Resolve thread, or Unresolve. */
  setResolved: [resolved: boolean];
  /** Hide folded the resolved thread again: its row is drawn in its place. */
  hidden: [];
}>();

const t = useTranslate();
/** The user opened it, resolved. */
const opened = ref(false);

const first = computed(() => props.entry.thread.comments[0] ?? null);
const login = computed(() => first.value?.author?.login ?? t(l.ghost));
const age = computed(() => (first.value ? formatAge(Date.parse(first.value.createdAt), props.now) : ''));

function hide() {
  opened.value = false;
  emit('hidden');
}
</script>

<template>
  <div :class="css.itemThreadCodeComment">
    <div :class="css.itemThreadCodeComment_gutter">
      <Avatar
        :name="login"
        :src="first?.author?.avatarUrl"
        size="lg"
        decorative
      />
    </div>
    <div :class="css.itemThreadCodeComment_content">
      <p :class="css.itemThreadCodeComment_head">
        <span :class="css.itemThreadCodeComment_author">{{ login }}</span>
        <span :class="css.itemThreadCodeComment_what">{{ t(l.commentedOn) }}</span>
        <span :class="css.itemThreadCodeComment_path">{{ entry.thread.path }}</span>
        <time
          :class="css.itemThreadCodeComment_when"
          :datetime="first?.createdAt"
          >{{ age }}</time
        >
      </p>
      <ItemThreadResolvedRow
        v-if="entry.thread.isResolved && !opened && !replies?.get(entry.thread.id)"
        :thread="entry.thread"
        excerpt
        @click="opened = true"
      />
      <ItemThreadCodeThread
        v-else
        :thread="entry.thread"
        :viewer="viewer"
        :replies="replies"
        @hide="hide"
        @reply="emit('reply')"
        @set-resolved="emit('setResolved', $event)"
      />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.itemThreadCodeComment {
  @include item-thread-row;
}

.itemThreadCodeComment_gutter {
  @include item-thread-gutter(36px);
}

.itemThreadCodeComment_content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
}

.itemThreadCodeComment_head {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  height: 36px;
  margin: 0;
  white-space: nowrap;
}

.itemThreadCodeComment_author {
  flex: none;
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.itemThreadCodeComment_what {
  flex: none;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.itemThreadCodeComment_path {
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
}

.itemThreadCodeComment_when {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
