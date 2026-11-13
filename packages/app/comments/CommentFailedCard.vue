<!-- A comment of the user's GitHub did not take, wherever comments are listed (`Activity / Comment · failed`): its card as typed, "Not sent" in red like its border, and a band at its foot saying why, with Discard and Retry — Retry only while the user may comment. It stays until it is posted or discarded. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, RotateCw } from 'lucide-vue-next';

import Button from '@/components/Button.vue';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import { useEditTexts } from '@/edits/useEditTexts.js';
import type { ItemUser } from '@/store/ItemTypes.js';

import CommentCard from './CommentCard.vue';
import * as l from './CommentFailedCard.loc.js';

defineProps<{
  /** Who wrote it: the user signed in. */
  author: ItemUser | null;
  /** Epoch ms the ages are counted to. */
  now: number;
  /** As typed. */
  body: string;
  reason: EditFailureReason;
  /** The user may comment: it can be sent again. */
  canRetry?: boolean;
}>();

const emit = defineEmits<{
  discard: [];
  retry: [];
}>();

const t = useTranslate();
const editTexts = useEditTexts();
</script>

<template>
  <CommentCard
    :author="author"
    :now="now"
    failed
  >
    <p
      :class="css.commentFailedCard_typed"
      v-text="body"
    />
    <template #footer>
      <div :class="css.commentFailedCard_band">
        <CircleAlert
          :class="css.commentFailedCard_icon"
          aria-hidden="true"
        />
        <span
          :class="css.commentFailedCard_text"
          role="alert"
          >{{ editTexts.notSent(reason) }}</span
        >
        <span :class="css.commentFailedCard_buttons">
          <Button
            size="compact"
            @click="emit('discard')"
          >
            {{ t(l.discard) }}
          </Button>
          <Button
            v-if="canRetry"
            size="compact"
            :icon="RotateCw"
            @click="emit('retry')"
          >
            {{ t(l.retry) }}
          </Button>
        </span>
      </div>
    </template>
  </CommentCard>
</template>

<style lang="scss" module="css">
// As typed: GitHub has not rendered it.
.commentFailedCard_typed {
  margin: 0;
  font-size: $font-size-reading;
  line-height: $line-height-reading;
  color: $color-fg;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

// Why it wasn't sent, at the bottom of the card: Primer's danger, muted.
.commentFailedCard_band {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-10 $spacing-8 $spacing-14;
  background: $color-bg-danger;
  border-top: 1px solid $color-border-danger;
}

.commentFailedCard_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-red;
}

// Why wraps to more lines in a narrow card; the buttons keep their size.
.commentFailedCard_text {
  flex: 1;
  min-width: 0;
  font-size: $font-size-sm;
  line-height: 1.45;
  color: $color-fg;
}

.commentFailedCard_buttons {
  display: flex;
  flex: none;
  gap: $spacing-8;
}
</style>
