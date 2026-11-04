<!-- The toasts of what the user just closed, for a `Toaster` (D29): what closed and Undo (⌘Z takes back the latest, while it shows), which reopens it. A close GitHub refuses leaves only its failure's toast (`EditToasts`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleCheckBig, Undo2 } from 'lucide-vue-next';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';

import * as l from './CloseToasts.loc.js';
import { ItemEditor } from './ItemEditor.js';
import type { UndoableClose } from './ItemEditor.js';

/** The key of "Undo", while a toast shows. */
const UNDO_KEY = 'Mod+Z';
/** As long as an untrack's Undo (D25). */
const UNDO_MS = 10_000;

const editor = useService(ItemEditor);
const t = useTranslate();

useCommands(() => {
  const latest = editor.closes.at(-1);
  return latest
    ? [
        {
          id: 'edits.undoClose',
          title: t(l.undoCommand),
          section: 'app',
          key: UNDO_KEY,
          icon: Undo2,
          menu: false,
          run: () => void editor.undoClose(latest.id),
        },
      ]
    : [];
});

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
    :duration="UNDO_MS"
    @update:open="onOpenChange(close, $event)"
  >
    <template #actions>
      <Button
        variant="secondary"
        size="sm"
        :kbd="UNDO_KEY"
        :aria-keyshortcuts="formatAriaKeyShortcuts(UNDO_KEY)"
        @click="editor.undoClose(close.id)"
      >
        {{ t(l.undo) }}
      </Button>
    </template>
  </Toast>
</template>
