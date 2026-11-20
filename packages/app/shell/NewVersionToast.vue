<!-- A newer githq was deployed while the page runs (`NewVersion`, on the web only: the desktop app has its own updater): a toast that stays until dismissed, with Reload (⌥R on the newest toast; in the command menu while it shows). Reload loads the new version at once; otherwise the next move to another screen does (Nuxt's chunk-reload plugin), never a reload in place. Dismissed, it does not come back until the next load. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { RotateCw } from 'lucide-vue-next';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { loadNewVersion } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';

import { NewVersion } from './NewVersion.js';
import * as l from './NewVersionToast.loc.js';

const version = useService(NewVersion);
const t = useTranslate();

const commands: BoundCommand[] = [
  bindCommand(
    loadNewVersion,
    {
      place: 'app',
      title: t(l.reloadCommand),
      section: 'app',
      proposed: true,
      icon: RotateCw,
      run: () => version.reload(),
    },
    t,
  ),
];

function onOpenChange(open: boolean) {
  if (!open) {
    version.dismiss();
  }
}
</script>

<template>
  <Toast
    v-if="version.out"
    :title="t(l.title)"
    tone="accent"
    :icon="RotateCw"
    lasts="pinned"
    :commands="commands"
    @update:open="onOpenChange"
  >
    {{ t(l.detail) }}
    <template #actions="{ active, size }">
      <Button
        variant="secondary"
        :size="size"
        :kbd="active ? keyOf(loadNewVersion) : undefined"
        :keyshortcuts="active ? keyOf(loadNewVersion) : undefined"
        @click="version.reload()"
      >
        {{ t(l.reload) }}
      </Button>
    </template>
  </Toast>
</template>
