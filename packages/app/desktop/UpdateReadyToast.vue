<!-- An update waiting on the user's word (`AppUpdate.offer`), in a toast that stays until dismissed: ready, "githq 1.4.0 is ready" with Restart (U49), or, amber, its install on Restart failed (Linux, Windows), with Try again (U51). Both are `loadNewVersion`, on ⌥R whether or not the toast shows: `AppCommands` registers it, the toast only shows its key. Nothing restarts until the user says so. Dismiss is "Later": the toast comes back at the next launch or the next check the user asks for, and meanwhile the status bar keeps a quiet trace (`UpdateSegment.vue`, U50). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleArrowDown, TriangleAlert } from 'lucide-vue-next';
import { computed } from 'vue';

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
    @update:open="onOpenChange"
  >
    {{ t(failed ? l.failedDetail : l.readyDetail, { current }) }}
    <template #actions="{ size }">
      <Button
        variant="secondary"
        :size="size"
        :kbd="keyOf(loadNewVersion)"
        :keyshortcuts="keyOf(loadNewVersion)"
        @click="update.restart()"
      >
        {{ t(failed ? l.tryAgain : l.restart) }}
      </Button>
    </template>
  </Toast>
</template>
