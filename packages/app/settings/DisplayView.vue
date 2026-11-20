<!-- The Display section of Settings (git-client D22): whether things animate (githq D38, a `SettingsToggleCard`). It applies at once; where it is saved shows in the status bar. On a phone (`phone`, mobile D30, MB158) a switch row under Motion. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './DisplayView.loc.js';
import PhoneSettingsGroup from './PhoneSettingsGroup.vue';
import PhoneSettingsSwitchRow from './PhoneSettingsSwitchRow.vue';
import SettingsToggleCard from './SettingsToggleCard.vue';

defineProps<{
  /** In a phone's Settings: a switch row in one column. */
  phone?: boolean;
}>();

const animations = defineModel<boolean>('animations', { required: true });

const t = useTranslate();
</script>

<template>
  <PhoneSettingsGroup
    v-if="phone"
    :title="t(l.motion)"
  >
    <PhoneSettingsSwitchRow
      v-model="animations"
      :label="t(l.animationsTitle)"
      :description="t(l.animationsDescriptionPhone)"
    />
  </PhoneSettingsGroup>
  <div
    v-else
    :class="css.displayView"
    data-route-scroll="settings-display"
  >
    <div :class="css.displayView_column">
      <SettingsToggleCard
        v-model="animations"
        :title="t(l.animationsTitle)"
        :description="t(l.animationsDescription)"
      />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.displayView {
  @include settings-screen;

  padding-block: 28px;
}

.displayView_column {
  @include settings-screen-column;

  gap: $spacing-32;
}
</style>
