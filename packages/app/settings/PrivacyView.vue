<!-- The Privacy section of Settings (T23): whether githq counts this account's sign-ins and visits (`SettingsToggleCard`), with a link to the docs on what it counts. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { DOCS_URL } from '@/landing/docsUrl.js';

import * as l from './PrivacyView.loc.js';
import SettingsToggleCard from './SettingsToggleCard.vue';

const usageStatistics = defineModel<boolean>({ required: true });

const t = useTranslate();
</script>

<template>
  <div
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
          href: `${DOCS_URL}how-it-works/privacy-and-permissions#usage-statistics`,
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
