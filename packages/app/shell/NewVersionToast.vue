<!-- A newer githq was deployed while the page runs (`NewVersion`, on the web only: the desktop app has its own updater): a toast that stays until dismissed, with Reload (⌥R on the newest toast; in the command menu while it shows). Reload loads the new version at once; otherwise the next move to another screen does (Nuxt's chunk-reload plugin), never a reload in place. Dismissed, it does not come back until the next load. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { RotateCw } from 'lucide-vue-next';

import type { Command } from '@/commands/CommandTypes.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';

import { NewVersion } from './NewVersion.js';
import * as l from './NewVersionToast.loc.js';

/** The key of Reload, while the toast is the newest. */
const RELOAD_KEY = 'Alt+R';

const version = useService(NewVersion);
const t = useTranslate();

const commands: Command[] = [
  {
    id: 'app.reloadToNewVersion',
    title: t(l.reloadCommand),
    section: 'app',
    key: RELOAD_KEY,
    icon: RotateCw,
    run: () => version.reload(),
  },
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
    <template #actions="{ active }">
      <Button
        variant="secondary"
        size="sm"
        :kbd="active ? RELOAD_KEY : undefined"
        :aria-keyshortcuts="active ? RELOAD_KEY : undefined"
        @click="version.reload()"
      >
        {{ t(l.reload) }}
      </Button>
    </template>
  </Toast>
</template>
