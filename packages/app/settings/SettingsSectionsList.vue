<!-- Settings on a phone (mobile D33, MB146): the list of its sections, grouped — Tracking (Repositories, Projects), How githq behaves (Display, Code review, Privacy), Your settings (Sync settings, Account) — each row saying the section's state at its right (how many are tracked, whether things animate, how a comment goes out, whether statistics are shared, whether the settings are saved — "Stopped" in amber — and who is signed in) and going into the section at its own address (`/settings?tab=…`, the first included). The desktop app's sections are not here: the desktop app never takes the phone layout. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import PhoneSettingsGroup from './PhoneSettingsGroup.vue';
import PhoneSettingsRow from './PhoneSettingsRow.vue';
import * as sectionLabels from './SettingsSectionLabel.loc.js';
import * as l from './SettingsSectionsList.loc.js';
import { getPhoneSettingsPath } from './settingsRoutes.js';
import { SETTINGS_SECTION_ICONS } from './settingsSectionIcons.js';
import type { ReviewCommentChoice } from './sync/SettingsDocument.js';
import type { SettingsSaving } from './sync/SettingsSaving.js';

defineProps<{
  trackedRepositories: number;
  trackedProjects: number;
  animations: boolean;
  reviewCommentChoice: ReviewCommentChoice;
  usageStatistics: boolean;
  /** Whether the settings are saved to GitHub. */
  saving: SettingsSaving['state'];
  /** Who is signed in; `null` while not known. */
  login: string | null;
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

function getSavingValue(saving: SettingsSaving['state']) {
  switch (saving) {
    case 'on':
      return t(l.savingOn);
    case 'off':
      return t(l.savingOff);
    case 'stopped':
      return t(l.savingStopped);
    default:
      return assertNever(saving);
  }
}
</script>

<template>
  <nav :aria-label="t(sectionLabels.settings)">
    <PhoneSettingsGroup :title="t(l.tracking)">
      <PhoneSettingsRow
        :icon="SETTINGS_SECTION_ICONS.repositories"
        :label="t(sectionLabels.repositories)"
        :value="numbers.format(trackedRepositories)"
        :to="getPhoneSettingsPath('repositories')"
      />
      <PhoneSettingsRow
        :icon="SETTINGS_SECTION_ICONS.projects"
        :label="t(sectionLabels.projects)"
        :value="numbers.format(trackedProjects)"
        :to="getPhoneSettingsPath('projects')"
      />
    </PhoneSettingsGroup>
    <PhoneSettingsGroup :title="t(l.behaviour)">
      <PhoneSettingsRow
        :icon="SETTINGS_SECTION_ICONS.display"
        :label="t(sectionLabels.display)"
        :value="t(animations ? l.animationsOn : l.animationsOff)"
        :to="getPhoneSettingsPath('display')"
      />
      <PhoneSettingsRow
        :icon="SETTINGS_SECTION_ICONS.review"
        :label="t(sectionLabels.review)"
        :value="t(reviewCommentChoice === 'draft' ? l.reviewDraft : l.reviewSingle)"
        :to="getPhoneSettingsPath('review')"
      />
      <PhoneSettingsRow
        :icon="SETTINGS_SECTION_ICONS.privacy"
        :label="t(sectionLabels.privacy)"
        :value="t(usageStatistics ? l.statisticsOn : l.statisticsOff)"
        :to="getPhoneSettingsPath('privacy')"
      />
    </PhoneSettingsGroup>
    <PhoneSettingsGroup :title="t(l.yours)">
      <PhoneSettingsRow
        :icon="SETTINGS_SECTION_ICONS.sync"
        :label="t(sectionLabels.sync)"
        :value="getSavingValue(saving)"
        :tone="saving === 'stopped' ? 'amber' : undefined"
        :to="getPhoneSettingsPath('sync')"
      />
      <PhoneSettingsRow
        :icon="SETTINGS_SECTION_ICONS.account"
        :label="t(sectionLabels.account)"
        :value="login ?? undefined"
        :to="getPhoneSettingsPath('account')"
      />
    </PhoneSettingsGroup>
  </nav>
</template>
