<!-- The app was updated (desktop releases D7, U23, U24): a toast in the corner saying from which version to which, and "What changed" (⌥W on the newest toast; in the command menu while it shows) to Settings: Updates, where the changelog is. Going back to an older version (U25) says which one runs and offers nothing to read (D10). It comes once for each update — remembered as told at once, so not again on reload — and goes by itself after a few seconds; no window opens by itself. Never at the first ever run, which has nothing before it (`VersionRecord.ts`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleArrowDown, CircleArrowUp } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { whatChanged } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import { AppUpdate, isOlderVersion } from '@/services/AppUpdate.js';
import type { VersionChange } from '@/services/AppUpdate.js';
import { getSettingsPath } from '@/settings/settingsRoutes.js';

import * as l from './UpdatedToast.loc.js';

const update = useService(AppUpdate);
const router = useRouter();
const t = useTranslate();

/** The update the toast tells, while it shows. */
const shown = shallowRef<VersionChange | null>(null);

const older = computed(() => shown.value !== null && isOlderVersion(shown.value.version, shown.value.previousVersion));

watch(
  () => update.untoldChange,
  change => {
    if (change) {
      shown.value = change;
      update.markUpdateTold();
    }
  },
  { immediate: true },
);

const commands = computed((): BoundCommand[] =>
  older.value ? [] : [bindCommand(whatChanged, { section: 'app', run: openChangelog }, t)],
);

function openChangelog() {
  shown.value = null;
  void router.push(getSettingsPath('updates'));
}

function onOpenChange(open: boolean) {
  if (!open) {
    shown.value = null;
  }
}
</script>

<template>
  <Toast
    v-if="shown"
    :title="t(older ? l.olderTitle : l.updatedTitle, { version: shown.version })"
    tone="accent"
    :icon="older ? CircleArrowDown : CircleArrowUp"
    lasts="brief"
    :commands="commands"
    @update:open="onOpenChange"
  >
    {{ older ? t(l.olderDetail) : t(l.updatedDetail, { previousVersion: shown.previousVersion }) }}
    <template
      v-if="!older"
      #actions="{ active }"
    >
      <Button
        variant="secondary"
        size="sm"
        :kbd="active ? keyOf(whatChanged) : undefined"
        :keyshortcuts="active ? keyOf(whatChanged) : undefined"
        @click="openChangelog"
      >
        {{ t(l.whatChanged) }}
      </Button>
    </template>
  </Toast>
</template>
