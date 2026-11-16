<!-- The Privacy section of Settings (T23): whether githq counts this account's sign-ins and visits (`SettingsToggleCard`), with a link to the docs on what it counts. On a phone (`phone`, MB240) a switch row under Usage and the link as a row of its own (↗). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { BookOpen } from 'lucide-vue-next';

import { DOCS_URL } from '@/landing/docsUrl.js';

import PhoneSettingsGroup from './PhoneSettingsGroup.vue';
import PhoneSettingsRow from './PhoneSettingsRow.vue';
import PhoneSettingsSwitchRow from './PhoneSettingsSwitchRow.vue';
import * as l from './PrivacyView.loc.js';
import SettingsToggleCard from './SettingsToggleCard.vue';

/** The docs' page on what githq counts. */
const COUNTED_URL = `${DOCS_URL}how-it-works/privacy-and-permissions#usage-statistics`;

defineProps<{
  /** In a phone's Settings: rows in one column. */
  phone?: boolean;
}>();

const usageStatistics = defineModel<boolean>({ required: true });

const t = useTranslate();
</script>

<template>
  <PhoneSettingsGroup
    v-if="phone"
    :title="t(l.usage)"
  >
    <PhoneSettingsSwitchRow
      v-model="usageStatistics"
      :label="t(l.usageStatisticsTitle)"
      :description="t(l.usageStatisticsDescription)"
    />
    <PhoneSettingsRow
      :icon="BookOpen"
      :label="t(l.whatGithqCounts)"
      :href="COUNTED_URL"
    />
  </PhoneSettingsGroup>
  <div
    v-else
    :class="css.privacyView"
    data-route-scroll="settings-privacy"
  >
    <div :class="css.privacyView_column">
      <SettingsToggleCard
        v-model="usageStatistics"
        :title="t(l.usageStatisticsTitle)"
        :description="t(l.usageStatisticsDescription)"
        :link="{
          label: t(l.whatGithqCounts),
          href: COUNTED_URL,
        }"
      />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.privacyView {
  @include settings-screen;

  padding-block: 28px;
}

.privacyView_column {
  @include settings-screen-column;

  max-width: 560px;
}
</style>
