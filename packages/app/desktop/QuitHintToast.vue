<!-- ⌘W in the Mac's desktop app (`QuitHint.ts`): a brief toast saying that ⌘Q quits, as ⌘W no longer closes the one window. Each press shows it again from the start, never a second copy. Only presses made while it is mounted count: one pressed signed out is not told later. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { Power } from 'lucide-vue-next';
import { shallowRef, watch } from 'vue';

import Toast from '@/components/Toast.vue';

import { QuitHint } from './QuitHint.js';
import * as l from './QuitHintToast.loc.js';

const hint = useService(QuitHint);
const t = useTranslate();

/** The press the toast shows for, as its key: a new press shows it anew. `null` while hidden. */
const shown = shallowRef<number | null>(null);

watch(
  () => hint.presses,
  presses => {
    shown.value = presses;
  },
);

function onOpenChange(open: boolean) {
  if (!open) {
    shown.value = null;
  }
}
</script>

<template>
  <Toast
    v-if="shown !== null"
    :key="shown"
    :title="t(l.title)"
    tone="neutral"
    :icon="Power"
    lasts="brief"
    @update:open="onOpenChange"
  >
    {{ t(l.detail) }}
  </Toast>
</template>
