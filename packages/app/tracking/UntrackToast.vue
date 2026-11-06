<!-- The toasts of untracks that can still be taken back (D25, T20), one for each pending in `PendingUntracks`: what stopped being tracked, that its copy goes when this closes, and Undo (⌘Z, on the newest toast). Its own time (`long`, paused while hovered) is Undo's: closing it in any way — timed out, dismissed, Escape — untracks at once. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { EyeOff, Undo2 } from 'lucide-vue-next';

import type { Command } from '@/commands/CommandTypes.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';

import { PendingUntracks } from './PendingUntracks.js';
import type { PendingUntrack } from './PendingUntracks.js';
import * as l from './UntrackToast.loc.js';
import { getTrackedKey } from './utils/getTrackedKey.js';

/** The key of "Undo", while the toast shows. */
const UNDO_KEY = 'Mod+Z';

const pending = useService(PendingUntracks);
const t = useTranslate();

function getCommands(entry: PendingUntrack): Command[] {
  return [
    {
      id: 'tracking.undoUntrack',
      title: t(l.undoCommand),
      section: 'app',
      key: UNDO_KEY,
      icon: Undo2,
      menu: false,
      run: () => pending.undo(entry.target),
    },
  ];
}

function onOpenChange(entry: PendingUntrack, open: boolean) {
  if (!open) {
    pending.commit(entry.target);
  }
}
</script>

<template>
  <Toast
    v-for="entry in pending.entries"
    :key="getTrackedKey(entry.target)"
    :title="t(l.title, { name: entry.label })"
    tone="neutral"
    :icon="EyeOff"
    lasts="long"
    :commands="getCommands(entry)"
    @update:open="onOpenChange(entry, $event)"
  >
    {{ t(l.description) }}
    <template #actions="{ active }">
      <Button
        variant="secondary"
        size="sm"
        :kbd="active ? UNDO_KEY : undefined"
        :aria-keyshortcuts="active ? formatAriaKeyShortcuts(UNDO_KEY) : undefined"
        @click="pending.undo(entry.target)"
      >
        {{ t(l.undo) }}
      </Button>
    </template>
  </Toast>
</template>
