<!-- Over the threads kept when every file is viewed and those hidden (CR63, `All viewed`): that all of them are, what is left to answer, and the ways on: Submit review… (⇧S) and the next pull request (J). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleCheck } from 'lucide-vue-next';
import { computed } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';

import * as l from './ReviewAllViewed.loc.js';
import { REVIEW_KEYS } from './useReviewKeySheet.js';

const props = defineProps<{
  /** How many files all are. */
  total: number;
  /** The threads still open, and on how many files. */
  threadCount: number;
  threadFileCount: number;
  /** The number of the pull request `J` goes to; `null` for none. */
  nextNumber: number | null;
  /** A finish of the review is on its way. */
  sending?: boolean;
}>();

const emit = defineEmits<{
  submit: [];
  next: [];
}>();

const t = useTranslate();

const note = computed(() => {
  const { threadCount, threadFileCount, nextNumber } = props;
  if (threadCount === 0) {
    return nextNumber === null ? t(l.submitOnly) : t(l.submitOrNext, { number: nextNumber });
  }

  const open = t(l.stillOpen, {
    threads: t(l.threads, { count: threadCount }),
    files: t(l.files, { count: threadFileCount }),
  });
  return `${open} ${nextNumber === null ? t(l.thenSubmit) : t(l.thenNext, { number: nextNumber })}`;
});
</script>

<template>
  <div :class="css.reviewAllViewed">
    <div :class="css.reviewAllViewed_box">
      <p :class="css.reviewAllViewed_title">
        <CircleCheck
          :class="css.reviewAllViewed_icon"
          aria-hidden="true"
        />
        {{ t(l.title, { total }) }}
      </p>
      <p :class="css.reviewAllViewed_note">{{ note }}</p>
      <div :class="css.reviewAllViewed_actions">
        <Button
          size="sm"
          variant="light"
          :kbd="REVIEW_KEYS.submit"
          :keyshortcuts="formatAriaKeyShortcuts(REVIEW_KEYS.submit)"
          :busy="sending"
          @click="emit('submit')"
        >
          {{ t(l.submit) }}
        </Button>
        <Button
          v-if="nextNumber !== null"
          size="sm"
          :kbd="REVIEW_KEYS.nextPullRequest"
          :keyshortcuts="formatAriaKeyShortcuts(REVIEW_KEYS.nextPullRequest)"
          @click="emit('next')"
        >
          {{ t(l.next, { number: nextNumber }) }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewAllViewed {
  padding: $spacing-16 $spacing-16 $spacing-12;
}

.reviewAllViewed_box {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  padding: 28px $spacing-24;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}

.reviewAllViewed_title {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  margin: 0;
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.reviewAllViewed_icon {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-green;
}

.reviewAllViewed_note {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.reviewAllViewed_actions {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}
</style>
