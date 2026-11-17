<!-- An update waiting on the user's word (`AppUpdate.offer`), in a toast that stays until dismissed: ready, "githq 1.4.0 is ready" with Restart (⌥R on the newest toast, U49), or, amber, its install on Restart failed (Linux, Windows), with Try again (U51). Nothing restarts until the user says so. Dismiss is "Later": the toast comes back at the next launch or the next check the user asks for, and meanwhile the status bar keeps a quiet trace (`UpdateSegment.vue`, U50). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleArrowDown, RotateCcw, TriangleAlert } from 'lucide-vue-next';
import { computed } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { loadNewVersion } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import { AppUpdate } from '@/services/AppUpdate.js';

import * as l from './UpdateReadyToast.loc.js';

const update = useService(AppUpdate);
const t = useTranslate();

const offer = computed(() => update.offer);
const failed = computed(() => offer.value?.kind === 'installFailed');
const current = computed(() => update.state?.version ?? '');

// Its key while it is the newest toast, and the command menu's row while it shows: the menu's own "Restart to update"
// (`AppCommands.vue`) stands in only once it is dismissed.
const commands = computed((): BoundCommand[] =>
  offer.value
    ? [
        bindCommand(
          loadNewVersion,
          {
            place: 'app',
            title: t(failed.value ? l.retryInstall : l.restartToUpdate),
            detail: t(l.updateVersion, { version: offer.value.version }),
            section: 'app',
            icon: failed.value ? RotateCcw : CircleArrowDown,
            run: () => update.restart(),
          },
          t,
        ),
      ]
    : [],
);

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
        :kbd="active ? keyOf(loadNewVersion) : undefined"
        :keyshortcuts="active ? keyOf(loadNewVersion) : undefined"
        @click="update.restart()"
      >
        {{ t(failed ? l.tryAgain : l.restart) }}
      </Button>
    </template>
  </Toast>
</template>
