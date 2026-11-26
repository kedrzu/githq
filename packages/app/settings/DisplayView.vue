<!-- The Display section of Settings (git-client D22): the typography (`TypographyBlock`, T28–T30) and whether things animate (githq D38, a `SettingsToggleCard`). It applies at once; where it is saved shows in the status bar. On a phone (`phone`, mobile D30, MB158) a switch row under Motion alone: the phone layout's typography is fixed. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { TypographyRoleChange, TypographySettings } from '@/typography/readTypography.js';
import type { TypographyPreset } from '@/typography/typographyCatalog.js';

import * as l from './DisplayView.loc.js';
import PhoneSettingsGroup from './PhoneSettingsGroup.vue';
import PhoneSettingsSwitchRow from './PhoneSettingsSwitchRow.vue';
import SettingsToggleCard from './SettingsToggleCard.vue';
import TypographyBlock from './TypographyBlock.vue';

defineProps<{
  /** In a phone's Settings: a switch row in one column. */
  phone?: boolean;
  /** The typography the settings choose; not shown on a phone. */
  typography: TypographySettings;
}>();

const emit = defineEmits<{
  /** A typography preset chosen. */
  typographyPreset: [preset: TypographyPreset];
  /** A role's font, size or line height changed by hand. */
  typographyChange: [change: TypographyRoleChange];
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
      <TypographyBlock
        :typography="typography"
        @preset="emit('typographyPreset', $event)"
        @change="emit('typographyChange', $event)"
      />
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
