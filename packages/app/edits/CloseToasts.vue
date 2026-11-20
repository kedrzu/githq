<!-- The toasts of what the user just closed, for a `Toaster` (D29): what closed and Undo (⌘Z, on the newest toast), which reopens it and asks the cursor back to it (`ItemNavigation`). A close GitHub refuses leaves only its failure's toast (`EditToasts`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleCheckBig } from 'lucide-vue-next';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { undo } from '@/commands/definitions/index.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { keyOf } from '@/commands/keyOf.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import { ItemNavigation } from '@/item/ItemNavigation.js';

import * as l from './CloseToasts.loc.js';
import { ItemEditor } from './ItemEditor.js';
import type { UndoableClose } from './ItemEditor.js';

const editor = useService(ItemEditor);
const navigation = useService(ItemNavigation);
const t = useTranslate();

function getCommands(close: UndoableClose): BoundCommand[] {
  return [
    bindCommand(
      undo,
      { place: 'app', title: t(l.undoCommand), section: 'app', menu: false, run: () => undoClose(close) },
      t,
    ),
  ];
}

function undoClose({ id, targets }: UndoableClose) {
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
    <template #actions="{ active, size }">
      <Button
        variant="secondary"
        :size="size"
        :kbd="active ? keyOf(undo) : undefined"
        :keyshortcuts="active ? formatAriaKeyShortcuts(keyOf(undo)) : undefined"
        @click="undoClose(close)"
      >
        {{ t(l.undo) }}
      </Button>
    </template>
  </Toast>
</template>
