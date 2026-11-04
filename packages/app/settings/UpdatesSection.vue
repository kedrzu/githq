<!-- The Updates section of Settings, wired to `AppUpdate`, in the desktop app only (`SettingsPage.vue`). The address holds the confirmation of switching to Stable (`?confirm=stable`, `CONFIRM_STABLE_PATH`, U13), so the command menu can open it from anywhere: closing it, whichever way, takes that out of the address, and so it opens once. An address with nothing to confirm (already on Stable, a stable version, Windows) just loses it. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AppUpdate, isPrereleaseVersion } from '@/services/AppUpdate.js';
import { useNow } from '@/services/useNow.js';

import { CONFIRM_STABLE_PATH, getSettingsPath } from './settingsRoutes.js';
import UpdatesView from './UpdatesView.vue';

/** How often "checked 2 hours ago" moves on: it says nothing finer than minutes. */
const TICK_MS = 30_000;

const update = useService(AppUpdate);
const route = useRoute();
const router = useRouter();
const now = useNow(TICK_MS);

const askedInAddress = computed(() => route.query.confirm === 'stable');
const hasToConfirm = computed(() => {
  const { state } = update;
  return state !== null && state.canChoose && state.stream === 'development' && isPrereleaseVersion(state.version);
});
const confirming = computed({
  get: () => askedInAddress.value && hasToConfirm.value,
  set: open => void router.replace(open ? CONFIRM_STABLE_PATH : getSettingsPath('updates')),
});

watchEffect(() => {
  // Before the native side's first answer it isn't known yet.
  if (askedInAddress.value && update.state !== null && !hasToConfirm.value) {
    void router.replace(getSettingsPath('updates'));
  }
});
</script>

<template>
  <UpdatesView
    v-if="update.state"
    v-model:confirming="confirming"
    :state="update.state"
    :now="now"
    @check="update.check()"
    @restart="update.restart()"
    @set-stream="update.setStream($event)"
  />
</template>
