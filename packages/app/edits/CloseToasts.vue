<!-- The toasts of what the user just closed, for a `Toaster` (D29): what closed and Undo (⌘Z, on the newest toast), which reopens it and asks the cursor back to it (`ItemNavigation`). A close GitHub refuses leaves only its failure's toast (`EditToasts`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleCheckBig, Undo2 } from 'lucide-vue-next';

import type { Command } from '@/commands/CommandTypes.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import { ItemNavigation } from '@/item/ItemNavigation.js';

import * as l from './CloseToasts.loc.js';
import { ItemEditor } from './ItemEditor.js';
import type { UndoableClose } from './ItemEditor.js';

/** The key of "Undo", while a toast shows. */
const UNDO_KEY = 'Mod+Z';

const editor = useService(ItemEditor);
const navigation = useService(ItemNavigation);
const t = useTranslate();

function getCommands(close: UndoableClose): Command[] {
  return [
    {
      id: 'edits.undoClose',
      title: t(l.undoCommand),
      section: 'app',
      key: UNDO_KEY,
      icon: Undo2,
      menu: false,
      run: () => undo(close),
    },
  ];
}

function undo({ id, targets }: UndoableClose) {
  navigation.requestReturn({ ids: targets.map(target => target.itemId), settled: editor.undoClose(id) });
}

function getTitle({ targets }: UndoableClose) {
  const [first] = targets;
  return first && targets.length === 1
    ? t(l.closedOne, { reference: first.reference })
    : t(l.closedMany, { count: targets.length });
}

function onOpenChange(close: UndoableClose, open: boolean) {
  if (!open) {
    editor.forgetClose(close.id);
  }
}
</script>

<template>
  <Toast
    v-for="close in editor.closes"
    :key="close.id"
    :title="getTitle(close)"
    tone="neutral"
    :icon="CircleCheckBig"
    lasts="long"
    :commands="getCommands(close)"
    @update:open="onOpenChange(close, $event)"
  >
    <template #actions="{ active }">
      <Button
        variant="secondary"
        size="sm"
        :kbd="active ? UNDO_KEY : undefined"
        :keyshortcuts="active ? formatAriaKeyShortcuts(UNDO_KEY) : undefined"
        @click="undo(close)"
      >
        {{ t(l.undo) }}
      </Button>
    </template>
  </Toast>
</template>
