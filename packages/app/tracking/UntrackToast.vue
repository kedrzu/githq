<!-- The toasts of untracks that can still be taken back (D25, T20), one for each pending in `PendingUntracks`: what stopped being tracked, that its copy goes when this closes, and Undo (⌘Z, on the newest toast). Its own time (`long`, paused while hovered) is Undo's: closing it in any way — timed out, dismissed, Escape — untracks at once. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { EyeOff } from 'lucide-vue-next';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { undo } from '@/commands/definitions/index.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { keyOf } from '@/commands/keyOf.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';

import { PendingUntracks } from './PendingUntracks.js';
import type { PendingUntrack } from './PendingUntracks.js';
import * as l from './UntrackToast.loc.js';
import { getTrackedKey } from './utils/getTrackedKey.js';

const pending = useService(PendingUntracks);
const t = useTranslate();

function getCommands(entry: PendingUntrack): BoundCommand[] {
  return [
    bindCommand(
      undo,
      { place: 'app', title: t(l.undoCommand), section: 'app', menu: false, run: () => pending.undo(entry.target) },
      t,
    ),
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
    <template #actions="{ active, size }">
      <Button
        variant="secondary"
        :size="size"
        :kbd="active ? keyOf(undo) : undefined"
        :keyshortcuts="active ? formatAriaKeyShortcuts(keyOf(undo)) : undefined"
        @click="pending.undo(entry.target)"
      >
        {{ t(l.undo) }}
      </Button>
    </template>
  </Toast>
</template>
