<!-- `/settings` (D15): the one Settings screen, its section in the address (`?tab=`, `settingsRoutes.ts`). `?q=` opens the Repositories or Projects section's picker with that search (`TrackedRepositoriesSection.vue`, `TrackedProjectsSection.vue`). On a phone (`PhoneLayout.active`, mobile D33) `/settings` alone is the list of the sections (`SettingsSectionsList`), its back returning where Settings was opened from (`useSettingsOrigin`) — the places button with nothing behind it — and each section a screen of its own at its `?tab=`, the first included, in one column (`PhoneSettingsScreen`), its back "‹ Settings" returning to the list: by the history's Back when the list is the entry behind, else in place of the section. Repositories and Projects have "+" in their top bar, adding more (mobile D35). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { Plus } from 'lucide-vue-next';
import { computed, defineAsyncComponent, useTemplateRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AccountSection from '@/account/AccountSection.vue';
import { AuthStore } from '@/auth/AuthStore.js';
import IconButton from '@/components/IconButton.vue';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import TrackedProjectsSection from '@/tracking/TrackedProjectsSection.vue';
import TrackedRepositoriesSection from '@/tracking/TrackedRepositoriesSection.vue';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import CodeReviewSection from './CodeReviewSection.vue';
import DisplaySection from './DisplaySection.vue';
import PhoneSettingsScreen from './PhoneSettingsScreen.vue';
import PrivacySection from './PrivacySection.vue';
import SavingSection from './SavingSection.vue';
import * as l from './SettingsPage.loc.js';
import * as sectionLabels from './SettingsSectionLabel.loc.js';
import SettingsSectionsList from './SettingsSectionsList.vue';
import { getSettingsPath, readPhoneSettingsSection, readSettingsSection, SETTINGS_PATH } from './settingsRoutes.js';
import SettingsView from './SettingsView.vue';
import { SettingsSync } from './sync/SettingsSync.js';
import { useSettingsOrigin } from './useSettingsOrigin.js';

// The desktop app's sections, in the desktop build only (`__DESKTOP__`); the web builds drop them.
const UpdatesSection = __DESKTOP__ ? defineAsyncComponent(() => import('./UpdatesSection.vue')) : null;
const ChangelogSection = __DESKTOP__ ? defineAsyncComponent(() => import('./ChangelogSection.vue')) : null;

const tracking = useService(TrackingStore);
const sync = useService(SettingsSync);
const auth = useService(AuthStore);
const phone = useService(PhoneLayout);
const route = useRoute();
const router = useRouter();
const t = useTranslate();

const search = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''));
const section = computed({
  get: () => readSettingsSection(route.query.tab),
  set: value => void router.replace(getSettingsPath(value)),
});
/** On a phone, the section shown; `null` for the list of the sections. */
const phoneSection = computed(() => readPhoneSettingsSection(route.query.tab));
const origin = useSettingsOrigin({ shown: () => phone.active && phoneSection.value === null });
const trackedRepositories = useTemplateRef('trackedRepositories');
const trackedProjects = useTemplateRef('trackedProjects');

function backToList() {
  if (router.options.history.state.back === SETTINGS_PATH) {
    router.back();
  } else {
    void router.replace(SETTINGS_PATH);
  }
}

function add() {
  trackedRepositories.value?.add();
  trackedProjects.value?.add();
}
</script>

<template>
  <template v-if="phone.active">
    <PhoneSettingsScreen
      v-if="phoneSection === null"
      :title="t(sectionLabels.settings)"
      :back="origin.exists"
      :back-place="origin.place"
      scroll-key="settings-sections"
      @back="router.back()"
    >
      <SettingsSectionsList
        :tracked-repositories="tracking.repositories.length"
        :tracked-projects="tracking.projects.length"
        :animations="tracking.animations"
        :review-comment-choice="tracking.reviewCommentChoice"
        :usage-statistics="tracking.usageStatistics"
        :saving="sync.state.state"
        :login="auth.viewer?.login ?? null"
      />
    </PhoneSettingsScreen>
    <PhoneSettingsScreen
      v-else
      :key="phoneSection"
      :title="t(sectionLabels[phoneSection])"
      back
      :back-place="t(sectionLabels.settings)"
      :scroll-key="`settings-phone:${phoneSection}`"
      @back="backToList"
    >
      <template
        v-if="phoneSection === 'repositories' || phoneSection === 'projects'"
        #actions
      >
        <IconButton
          :icon="Plus"
          :label="t(phoneSection === 'projects' ? l.trackProjects : l.trackRepositories)"
          @click="add"
        />
      </template>
      <AccountSection
        v-if="phoneSection === 'account'"
        phone
      />
      <SavingSection
        v-else-if="phoneSection === 'sync'"
        phone
      />
      <PrivacySection
        v-else-if="phoneSection === 'privacy'"
        phone
      />
      <CodeReviewSection
        v-else-if="phoneSection === 'review'"
        phone
      />
      <DisplaySection
        v-else-if="phoneSection === 'display'"
        phone
      />
      <TrackedProjectsSection
        v-else-if="phoneSection === 'projects'"
        ref="trackedProjects"
        phone
        :initial-search="search"
      />
      <TrackedRepositoriesSection
        v-else-if="phoneSection === 'repositories'"
        ref="trackedRepositories"
        phone
        :initial-search="search"
      />
    </PhoneSettingsScreen>
  </template>
  <SettingsView
    v-else
    v-model:section="section"
    :tracked-repositories="tracking.repositories.length"
    :tracked-projects="tracking.projects.length"
    :saving-stopped="sync.state.state === 'stopped'"
  >
    <component
      :is="UpdatesSection"
      v-if="UpdatesSection && section === 'updates'"
    />
    <component
      :is="ChangelogSection"
      v-else-if="ChangelogSection && section === 'changelog'"
    />
    <AccountSection v-else-if="section === 'account'" />
    <SavingSection v-else-if="section === 'sync'" />
    <PrivacySection v-else-if="section === 'privacy'" />
    <CodeReviewSection v-else-if="section === 'review'" />
    <DisplaySection v-else-if="section === 'display'" />
    <TrackedProjectsSection
      v-else-if="section === 'projects'"
      :initial-search="search"
    />
    <TrackedRepositoriesSection
      v-else
      :initial-search="search"
    />
  </SettingsView>
</template>
