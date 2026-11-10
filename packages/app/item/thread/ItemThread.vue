<!-- An opened item's whole history as one thread on a rail: the description as its first card, then every comment read so far, oldest first, then the composer — there while the rest is read too. When GitHub has older comments than were read, a fold before them reads the rest. Every text is GitHub's own rendering (`GitHubHtml`); the user's own comment on its way shows at once as the text typed — GitHub renders it once it has it. A comment GitHub did not take stays after the comments read, as typed, with why and Discard and Retry (Retry only while the user may comment) — until it is posted or discarded. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, RotateCw } from 'lucide-vue-next';
import { computed, nextTick, ref, useTemplateRef } from 'vue';

import Button from '@/components/Button.vue';
import type { FailedComment } from '@/edits/CommentDrafts.js';
import { useEditTexts } from '@/edits/useEditTexts.js';
import type { ItemDetail } from '@/store/ItemDetailTypes.js';
import type { Item, ItemUser } from '@/store/ItemTypes.js';

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
  /** The user's comments GitHub did not take, in the order they were written. */
  failedComments?: readonly FailedComment[];
  /** Who wrote them: the user signed in. */
  viewer?: ItemUser | null;
  /** The user may comment: a failed comment can be sent again. */
  canRetry?: boolean;
}>();

const emit = defineEmits<{
  /** Send the failed comment again. */
  retry: [id: number];
  /** Drop the failed comment. */
  discard: [id: number];
}>();

defineSlots<{
  /** The thread's last entry, on the rail: the composer. */
  composer?(): unknown;
}>();

const t = useTranslate();
const editTexts = useEditTexts();
const commentsRef = useTemplateRef('comments');
/** The first comment the fold revealed: focusable, so the keyboard picks up where the fold was. */
const revealedId = ref<string | null>(null);

const folded = computed(() =>
  props.detail ? props.detail.comments.totalCount - props.detail.comments.nodes.length : 0,
);

// The fold goes with what it hid; focus moves to the first comment it revealed instead of falling to the page.
async function showEarlier() {
  await props.loadAll();
  revealedId.value = props.detail?.comments.nodes[0]?.id ?? null;
  await nextTick();
  commentsRef.value?.querySelector<HTMLElement>(':scope > [tabindex="-1"]')?.focus();
}
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
        @click="showEarlier"
      />
      <ol
        v-if="detail.comments.nodes.length > 0 || (failedComments?.length ?? 0) > 0"
        ref="comments"
        :class="css.itemThread_comments"
      >
        <li
          v-for="comment in detail.comments.nodes"
          :key="comment.id"
          :tabindex="comment.id === revealedId ? -1 : undefined"
          :class="css.itemThread_comment"
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
              :class="[css.itemThread_typed, css.itemThread_pending]"
              v-text="comment.pendingBody"
            />
            <GitHubHtml
              v-else
              :class="css.itemThread_text"
              :html="comment.bodyHtml"
            />
          </ItemThreadCard>
        </li>
        <li
          v-for="comment in failedComments"
          :key="`failed:${comment.id}`"
        >
          <ItemThreadCard
            :author="viewer ?? null"
            :now="now"
            failed
          >
            <p
              :class="css.itemThread_typed"
              v-text="comment.body"
            />
            <template #footer>
              <div :class="css.itemThread_failed">
                <CircleAlert
                  :class="css.itemThread_failedIcon"
                  aria-hidden="true"
                />
                <span
                  :class="css.itemThread_failedText"
                  role="alert"
                  >{{ editTexts.notSent(comment.reason, item.repository.nameWithOwner) }}</span
                >
                <Button
                  size="compact"
                  @click="emit('discard', comment.id)"
                >
                  {{ t(l.discard) }}
                </Button>
                <Button
                  v-if="canRetry"
                  size="compact"
                  :icon="RotateCw"
                  @click="emit('retry', comment.id)"
                >
                  {{ t(l.retry) }}
                </Button>
              </div>
            </template>
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
    inset: 0 auto 0 $item-thread-rail-offset;
    z-index: -1;
    width: $item-thread-rail-width;
    content: '';
    background: $color-border;
  }
}

// Nothing on a rail yet: the composer under the note.
.itemThread_loading::before {
  content: none;
}

// 8 between the items, as the design's feed (`Activity / Thread · short`).
.itemThread_comments {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: 0;
  margin: 0;
  list-style: none;
}

// The first comment the fold revealed, once it has the focus.
.itemThread_comment {
  @include focus-ring;
}

// A body or comment GitHub rendered, at the thread's reading size.
.itemThread_text {
  --github-html-font-size: #{$font-size-reading};
  --github-html-line-height: #{$line-height-reading};
  --github-html-color: #{$color-fg};
}

// As typed: GitHub has not rendered it. As GitHub's rendering of it will read.
.itemThread_typed {
  margin: 0;
  font-size: $font-size-reading;
  line-height: $line-height-reading;
  color: $color-fg;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

// On its way, dimmed (not faded: it stays readable): GitHub's rendering replaces it once GitHub has it.
.itemThread_pending {
  color: $color-fg-dim;
}

// Why it wasn't sent, at the bottom of the card: Primer's danger, muted.
.itemThread_failed {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-10 $spacing-8 $spacing-14;
  background: $color-bg-danger;
  border-top: 1px solid $color-border-danger;
}

.itemThread_failedIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-red;
}

.itemThread_failedText {
  flex: 1;
  min-width: 0;
  font-size: $font-size-sm;
  line-height: 1.45;
  color: $color-fg;
}

.itemThread_note {
  margin: 0;
  font-size: $font-size-md;
  color: $color-fg-dim;
}
</style>
