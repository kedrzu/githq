<!-- The toast after an issue is created (mobile D44, MB215), on the computer and the phone alike: "Created in owner/name", the issue's title with "number on its way" until GitHub gives its number, then "#123 · title", a countdown, and two real buttons — Create another (left out while the form is open already, after ⌘Enter) and Open, which waits for the number when pressed before it. Its buttons carry no keys and Escape stays the screen's; only × dismisses it. On a phone the buttons are `md`, as every toast's (`Toast`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Plus } from 'lucide-vue-next';

import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';

import * as l from './IssueCreatedToast.loc.js';

defineProps<{
  /** `owner/name`. */
  repository: string;
  title: string;
  /** GitHub's number; `null` until it answered. */
  number: number | null;
  /** Open was pressed before the number came: it opens the issue once it does. */
  opening?: boolean;
  /** Whether Create another is offered: not while the form is open already. */
  offerAnother?: boolean;
}>();

const emit = defineEmits<{
  createAnother: [];
  open: [];
}>();

const open = defineModel<boolean>('open', { default: true });
const t = useTranslate();
</script>

<template>
  <Toast
    v-model:open="open"
    :title="t(l.title, { repository })"
    tone="success"
    lasts="long"
    :dismiss-on-escape="false"
    :dismiss-button="false"
  >
    {{ number === null ? t(l.numberOnItsWay, { title }) : t(l.numbered, { number, title }) }}
    <template #actions="{ size }">
      <Button
        v-if="offerAnother"
        variant="secondary"
        :size="size"
        :icon="Plus"
        @click="emit('createAnother')"
        >{{ t(l.createAnother) }}</Button
      >
      <Button
        variant="secondary"
        :size="size"
        :busy="opening"
        @click="emit('open')"
        >{{ t(l.open) }}</Button
      >
    </template>
  </Toast>
</template>
