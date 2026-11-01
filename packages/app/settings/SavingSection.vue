<!-- The Saving to GitHub section of Settings (settings-sync T3–T8) on the settings sync: turning saving on — GitHub asked first, a repository found combined only on the user's word (T6) — turning it off, and trying again after it stopped, which shows a file found the same way. What combining would change is worked out from this device's settings as they are, and named with how many items each repository it untracks keeps here. -->
<script lang="ts" setup>
import { Logger } from '@nzyme/logging/Logger.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, shallowRef } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import { Browser } from '@/services/Browser.js';
import { useNow } from '@/services/useNow.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import SavingView from './SavingView.vue';
import type { SavingCombining, SavingConnect } from './SavingView.vue';
import { getCombiningChanges } from './sync/getCombiningChanges.js';
import type { StoppedReason } from './sync/SettingsSaving.js';
import { SettingsSync } from './sync/SettingsSync.js';
import type { FoundSettings } from './sync/SettingsSync.js';

/** How often "2 minutes ago" moves on. */
const TICK_MS = 15_000;

/** Where turning on is, with the file found while it waits for the user's word. */
type Connecting =
  | { readonly kind: 'idle' | 'busy' | 'unreachable' }
  | { readonly kind: 'found'; readonly found: FoundSettings }
  | { readonly kind: 'unusable'; readonly reason: StoppedReason };

const sync = useService(SettingsSync);
const tracking = useService(TrackingStore);
const auth = useService(AuthStore);
const browser = useService(Browser);
const logger = useService(Logger);

const now = useNow(TICK_MS);
const connecting = shallowRef<Connecting>({ kind: 'idle' });

const connect = computed((): SavingConnect => {
  const current = connecting.value;
  return current.kind === 'found' ? { kind: 'found', combining: getCombining(current.found) } : current;
});

function getCombining(found: FoundSettings): SavingCombining {
  const changes = getCombiningChanges(tracking.document, found.document);
  return {
    download: changes.download.map(entry => entry.name),
    saved: changes.saved.map(entry => entry.name),
    untracked: changes.untracked.map(entry => {
      const progress = tracking.getProgress(entry.target);
      return { name: entry.name, items: progress.total === null ? null : progress.done };
    }),
  };
}

/** The box ticked: what is in the account decides — nothing is created, a file is shown first, or it can't be used. */
async function turnOn() {
  connecting.value = { kind: 'busy' };
  try {
    const inspection = await sync.inspect();
    switch (inspection.kind) {
      case 'absent':
      case 'empty':
        await sync.turnOn(inspection);
        connecting.value = { kind: 'idle' };
        break;
      case 'found':
        connecting.value = { kind: 'found', found: inspection };
        break;
      case 'unusable':
        connecting.value = { kind: 'unusable', reason: inspection.reason };
        break;
      default:
        assertNever(inspection);
    }
  } catch (error) {
    logger.warn('Saving the settings could not be turned on', { error });
    connecting.value = { kind: 'unreachable' };
  }
}

async function combine() {
  const current = connecting.value;
  if (current.kind !== 'found') {
    return;
  }

  try {
    await sync.turnOn(current.found);
    connecting.value = { kind: 'idle' };
  } catch (error) {
    logger.warn('Saving the settings could not be turned on', { error });
    connecting.value = { kind: 'unreachable' };
  }
}

async function retry() {
  try {
    const found = await sync.retry();
    if (found) {
      connecting.value = { kind: 'found', found };
    }
  } catch (error) {
    logger.warn('Syncing the settings could not be tried again', { error });
  }
}

function turnOff() {
  connecting.value = { kind: 'idle' };
  sync.turnOff();
}

function reload() {
  browser.navigate(window.location.href);
}
</script>

<template>
  <SavingView
    v-if="auth.viewer"
    :login="auth.viewer.login"
    :saving="sync.state"
    :connect="connect"
    :repositories="tracking.repositories.length"
    :projects="tracking.projects.length"
    :now="now"
    :turn-on="turnOn"
    :combine="combine"
    :retry="retry"
    @cancel="connecting = { kind: 'idle' }"
    @turn-off="turnOff"
    @reload="reload"
  />
</template>
