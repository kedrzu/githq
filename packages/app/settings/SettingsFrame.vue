<!-- What a page of Settings is shown in, by the layout (`PhoneLayout.active`): on a phone a screen of its own (`PhoneSettingsScreen`: its top bar with back, the title and `actions`), else the Settings screen with its column of the sections (`SettingsView`, `section` the one chosen there, the counts and the amber dot read here). The page itself in the default slot. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';

import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import PhoneSettingsScreen from './PhoneSettingsScreen.vue';
import type { SettingsSection } from './settingsRoutes.js';
import SettingsView from './SettingsView.vue';
import { SettingsSync } from './sync/SettingsSync.js';

defineProps<{
  /** The phone's top bar's title. */
  title: string;
  /** On a phone, there is somewhere to go back to: back in place of the places button. */
  back?: boolean;
  /** Where the phone's back returns to ("Settings"); "Back" alone without one. */
  backPlace?: string | null;
  /** What the phone's screen's scroll is kept as (`shell/routeScroll.ts`). */
  scrollKey: string;
}>();

const emit = defineEmits<{
  /** The phone's back. */
  back: [];
}>();

defineSlots<{
  default(): unknown;
  /** The phone's top bar's buttons at the right (`IconButton`s). */
  actions?(): unknown;
}>();

/** The section chosen in the column, off a phone. */
const section = defineModel<SettingsSection>('section', { required: true });

const tracking = useService(TrackingStore);
const sync = useService(SettingsSync);
const phone = useService(PhoneLayout);
</script>

<template>
  <PhoneSettingsScreen
    v-if="phone.active"
    :title="title"
    :back="back"
    :back-place="backPlace"
    :scroll-key="scrollKey"
    @back="emit('back')"
  >
    <template
      v-if="$slots.actions"
      #actions
    >
      <slot name="actions" />
    </template>
    <slot />
  </PhoneSettingsScreen>
  <SettingsView
    v-else
    v-model:section="section"
    :tracked-repositories="tracking.repositories.length"
    :tracked-projects="tracking.projects.length"
    :saving-stopped="sync.state.state === 'stopped'"
  >
    <slot />
  </SettingsView>
</template>
