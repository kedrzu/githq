<!-- Deleting a comment asks once (F15): GitHub keeps no copy of it. Focus starts on Cancel, and only the red button or ⌘↵ deletes. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import DialogFrame from '@/components/DialogFrame.vue';

import * as l from './ItemThreadDeleteDialog.loc.js';

const emit = defineEmits<{
  delete: [];
}>();

const open = defineModel<boolean>('open', { default: false });

const DELETE_KEY = 'Mod+Enter';
const t = useTranslate();

function onKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, DELETE_KEY)) {
    event.preventDefault();
    emit('delete');
  }
}
</script>

<template>
  <DialogFrame
    v-model:open="open"
    :title="t(l.title)"
    :width="440"
    initial-focus="[data-cancel]"
    @keydown="onKeydown"
  >
    <p :class="css.itemThreadDeleteDialog_detail">{{ t(l.detail) }}</p>
    <template #footer>
      <Button
        size="sm"
        kbd="Escape"
        keyshortcuts="Escape"
        data-cancel
        @click="open = false"
      >
        {{ t(l.cancel) }}
      </Button>
      <Button
        size="sm"
        variant="danger"
        :kbd="DELETE_KEY"
        :keyshortcuts="formatAriaKeyShortcuts(DELETE_KEY)"
        @click="emit('delete')"
      >
        {{ t(l.delete) }}
      </Button>
    </template>
  </DialogFrame>
</template>

<style lang="scss" module="css">
.itemThreadDeleteDialog_detail {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-2;
}
</style>
