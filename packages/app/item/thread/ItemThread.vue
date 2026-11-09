<!-- An opened item's whole history as one thread on a rail: the description as its first card, then every comment read so far, oldest first, then the composer — there while the rest is read too. When GitHub has older comments than were read, a fold before them reads the rest. Every text is GitHub's own rendering (`GitHubHtml`); the user's own comment on its way shows at once as the text typed — GitHub renders it once it has it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import type { ItemDetail } from '@/store/ItemDetailTypes.js';
import type { Item } from '@/store/ItemTypes.js';

import GitHubHtml from '../GitHubHtml.vue';
import * as l from './ItemThread.loc.js';
import ItemThreadCard from './ItemThreadCard.vue';
import ItemThreadFold from './ItemThreadFold.vue';

const props = defineProps<{
  item: Item;
  /** `null` while being read. */
  detail: ItemDetail | null;
  /** Epoch ms the ages are counted to. */
  now: number;
  /** Reads the comments not read yet; resolves once all are in. */
  loadAll: () => Promise<void>;
}>();

defineSlots<{
  /** The thread's last entry, on the rail: the composer. */
  composer?(): unknown;
}>();

const t = useTranslate();

const folded = computed(() =>
  props.detail ? props.detail.comments.totalCount - props.detail.comments.nodes.length : 0,
);
</script>

<template>
  <div :class="[css.itemThread, !detail && css.itemThread_loading]">
    <p
      v-if="!detail"
      :class="css.itemThread_note"
    >
      {{ t(l.loading) }}
    </p>
    <template v-else>
      <ItemThreadCard
        :author="item.author"
        :created-at="item.createdAt"
        :now="now"
        description
      >
        <GitHubHtml
          v-if="detail.bodyHtml"
          :class="css.itemThread_text"
          :html="detail.bodyHtml"
        />
        <p
          v-else
          :class="css.itemThread_note"
        >
          {{ t(l.noDescription) }}
        </p>
      </ItemThreadCard>
      <ItemThreadFold
        v-if="folded > 0"
        :comments="folded"
        @click="loadAll"
      />
      <ol
        v-if="detail.comments.nodes.length > 0"
        :class="css.itemThread_comments"
      >
        <li
          v-for="comment in detail.comments.nodes"
          :key="comment.id"
        >
          <ItemThreadCard
            :author="comment.author"
            :created-at="comment.createdAt"
            :now="now"
            :edited="comment.lastEditedAt !== null"
            :sending="comment.pendingBody !== undefined"
          >
            <!-- `v-text`: text only, without the template's whitespace around it, which `pre-wrap` would show. -->
            <p
              v-if="comment.pendingBody !== undefined"
              :class="[css.itemThread_text, css.itemThread_pending]"
              v-text="comment.pendingBody"
            />
            <GitHubHtml
              v-else
              :class="css.itemThread_text"
              :html="comment.bodyHtml"
            />
          </ItemThreadCard>
        </li>
      </ol>
    </template>
    <slot name="composer" />
  </div>
</template>

<style lang="scss" module="css">
// The rail: a line behind the cards, from the description down to the end, at the centre of the folds' breaks. Its own
// stacking context keeps the line over the view's background and under the cards.
.itemThread {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: $spacing-16;

  &::before {
    position: absolute;
    inset: 0 auto 0 55px;
    z-index: -1;
    width: 2px;
    content: '';
    background: $color-border;
  }
}

// Nothing on a rail yet: the composer under the note.
.itemThread_loading::before {
  content: none;
}

.itemThread_comments {
  display: flex;
  flex-direction: column;
  gap: $spacing-20;
  padding: 0;
  margin: 0;
  list-style: none;
}

// Doubled: over `GitHubHtml`'s own size and colour, whichever stylesheet comes last.
.itemThread_text.itemThread_text {
  font-size: $font-size-reading;
  line-height: $line-height-reading;
  color: $color-fg;
}

// As typed, dimmed (not faded: it stays readable): GitHub's rendering replaces it once GitHub has it.
.itemThread_pending.itemThread_pending {
  margin: 0;
  color: $color-fg-dim;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.itemThread_note {
  margin: 0;
  font-size: $font-size-md;
  color: $color-fg-dim;
}
</style>
