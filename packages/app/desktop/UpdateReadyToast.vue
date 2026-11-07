<!-- An update waiting on the user's word (`AppUpdate.offer`), in a toast that stays until dismissed: ready, "githq 1.4.0 is ready" with Restart (⌥R on the newest toast, U49), or, amber, its install on Restart failed (Linux, Windows), with Try again (U51). Nothing restarts until the user says so. Dismiss is "Later": the toast comes back at the next launch or the next check the user asks for, and meanwhile the status bar keeps a quiet trace (`UpdateSegment.vue`, U50). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleArrowDown, RotateCcw, TriangleAlert } from 'lucide-vue-next';
import { computed } from 'vue';

import type { Command } from '@/commands/CommandTypes.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import { AppUpdate } from '@/services/AppUpdate.js';

import * as l from './UpdateReadyToast.loc.js';

/** The key of Restart and Try again, while the toast is the newest. */
const RESTART_KEY = 'Alt+R';

const update = useService(AppUpdate);
const t = useTranslate();

const offer = computed(() => update.offer);
const failed = computed(() => offer.value?.kind === 'installFailed');
const current = computed(() => update.state?.version ?? '');

// Only the key: the command menu has "Restart to update" and "Try again to install the update" of its own
// (`AppCommands.vue`).
const commands = computed((): Command[] => [
  {
    id: 'updates.restart',
    title: t(failed.value ? l.retryInstall : l.restartToUpdate),
    section: 'app',
    key: RESTART_KEY,
    icon: failed.value ? RotateCcw : CircleArrowDown,
    menu: false,
    run: () => update.restart(),
  },
]);

function onOpenChange(open: boolean) {
  if (!open) {
    update.later();
  }
}
</script>

<template>
  <Toast
    v-if="offer"
    :key="`${offer.kind}:${offer.version}`"
    :title="t(failed ? l.failedTitle : l.readyTitle, { version: offer.version })"
    :tone="failed ? 'warning' : 'accent'"
    :icon="failed ? TriangleAlert : CircleArrowDown"
    lasts="pinned"
    :commands="commands"
    @update:open="onOpenChange"
  >
    {{ t(failed ? l.failedDetail : l.readyDetail, { current }) }}
    <template #actions="{ active }">
      <Button
        variant="secondary"
        size="sm"
        :kbd="active ? RESTART_KEY : undefined"
        :aria-keyshortcuts="active ? RESTART_KEY : undefined"
        @click="update.restart()"
      >
        {{ t(failed ? l.tryAgain : l.restart) }}
      </Button>
    </template>
  </Toast>
</template>
