<!-- Syncing the settings stopped (settings-sync D12, T9): a toast saying why in short, that githq goes on from what this device has, and "Open settings" (⌥S, on the newest toast) to Sync settings. It comes once for each reason syncing stops for — remembered with the saving state, so not again on reload or in another tab — and stays until dismissed; syncing on again, or turned off, takes it away. On Sync settings itself it is not shown: the reason is there in full, and counts as told. -->
<script lang="ts" setup>
import { getSettingsNameWithOwner } from '@githq/github/settings/getSettingsNameWithOwner.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Settings } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import type { Command } from '@/commands/CommandTypes.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';

import { getSettingsPath, readSettingsSection, SETTINGS_PATH } from './settingsRoutes.js';
import { getUntoldStop } from './sync/SettingsSaving.js';
import type { StoppedReason } from './sync/SettingsSaving.js';
import { SettingsSync } from './sync/SettingsSync.js';
import * as l from './SyncStoppedToast.loc.js';

/** The key of "Open settings", while the toast shows. */
const OPEN_KEY = 'Alt+S';

const props = defineProps<{
  /** The signed-in user's login: the settings repository's owner. */
  login: string;
}>();

const sync = useService(SettingsSync);
const route = useRoute();
const router = useRouter();
const t = useTranslate();

/** The reason the toast tells, while it shows. */
const shown = shallowRef<StoppedReason | null>(null);

const onSync = computed(() => route.path === SETTINGS_PATH && readSettingsSection(route.query.tab) === 'sync');

const sentence = computed(() => {
  const reason = shown.value;
  if (!reason) {
    return '';
  }

  const repository = getSettingsNameWithOwner(props.login);
  switch (reason.kind) {
    case 'deleted':
      return t(l.deleted, { repository });
    case 'foreign':
      return t(l.foreign);
    case 'public':
      return t(l.public, { repository });
    case 'unreadable':
      return t(l.unreadable);
    case 'newer':
      return t(l.newer);
    case 'refused':
      return t(l.refused);
    default:
      return assertNever(reason);
  }
});

// A reason not told yet shows, and is remembered as told at once: the toast stays here until dismissed, and is not
// shown again anywhere.
watch(
  [() => sync.state, onSync],
  ([state, onSyncSection]) => {
    const untold = getUntoldStop(state);
    if (state.state !== 'stopped' || onSyncSection) {
      shown.value = null;
    } else if (untold) {
      shown.value = untold;
    }

    if (untold) {
      sync.markTold();
    }
  },
  { immediate: true },
);

const commands = computed((): Command[] => [
  {
    id: 'settings.saving.open',
    title: t(l.openSyncCommand),
    section: 'app',
    key: OPEN_KEY,
    icon: Settings,
    menu: false,
    run: openSync,
  },
]);

function openSync() {
  shown.value = null;
  void router.push(getSettingsPath('sync'));
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
    :title="t(l.title)"
    tone="warning"
    lasts="pinned"
    :commands="commands"
    @update:open="onOpenChange"
  >
    {{ sentence }} {{ t(l.keepsWorking) }}
    <template #actions="{ active }">
      <Button
        variant="secondary"
        size="sm"
        :icon="Settings"
        :kbd="active ? OPEN_KEY : undefined"
        :keyshortcuts="active ? OPEN_KEY : undefined"
        @click="openSync"
      >
        {{ t(l.openSettings) }}
      </Button>
    </template>
  </Toast>
</template>
