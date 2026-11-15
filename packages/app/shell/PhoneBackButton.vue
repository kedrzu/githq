<!-- Back in a phone's top bar (`PhoneTopBar`'s start, mobile D20): ‹ and the name of where it returns to — the list an item was opened from, or its repository — cut to the room the bar leaves, its accessible name "Back to …". -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronLeft } from 'lucide-vue-next';

import Button from '@/components/Button.vue';

import * as l from './PhoneBackButton.loc.js';

defineProps<{
  /** Where back returns to; "Back" alone without one. */
  place?: string | null;
}>();

const emit = defineEmits<{
  click: [];
}>();

const t = useTranslate();
</script>

<template>
  <Button
    variant="ghost"
    :icon="ChevronLeft"
    :class="css.phoneBackButton"
    :aria-label="place ? t(l.backTo, { place }) : t(l.back)"
    @click="emit('click')"
  >
    {{ place || t(l.back) }}
  </Button>
</template>

<style lang="scss" module="css">
.phoneBackButton {
  min-width: 0;
  max-width: 100%;
  margin-left: -$spacing-6;
  font-size: $font-size-xl;
}
</style>
