<!-- The toast of an untrack that can still be taken back (D25, T20): what stopped being tracked, that its copy goes when this closes, and Undo (⌘Z, while it shows). Of several pending it shows the latest; the one before comes back when that one goes. It closes when `PendingUntracks`' time ends, not on `Toast`'s own timer, and dismissing it untracks at once. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { EyeOff, Undo2 } from 'lucide-vue-next';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { useCommands } from '@/commands/useCommands.js';
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

useCommands(() => {
  const { latest } = pending;
  return latest
    ? [
        {
          id: 'tracking.undoUntrack',
          title: t(l.undoCommand),
          section: 'app',
          key: UNDO_KEY,
          icon: Undo2,
          menu: false,
          run: () => pending.undo(latest.target),
        },
      ]
    : [];
});

function onOpenChange(entry: PendingUntrack, open: boolean) {
  if (!open) {
    pending.commit(entry.target);
  }
}
</script>

<template>
  <Toast
    v-if="pending.latest"
    :key="getTrackedKey(pending.latest.target)"
    :title="t(l.title, { name: pending.latest.label })"
    tone="neutral"
    :icon="EyeOff"
    :duration="Infinity"
    @update:open="onOpenChange(pending.latest, $event)"
  >
    {{ t(l.description) }}
    <template #actions>
      <Button
        variant="secondary"
        size="sm"
        :kbd="UNDO_KEY"
        :aria-keyshortcuts="formatAriaKeyShortcuts(UNDO_KEY)"
        @click="pending.undo(pending.latest.target)"
      >
        {{ t(l.undo) }}
      </Button>
    </template>
  </Toast>
</template>
