<!-- The Settings screen (D15, G8, T4): its title, a tab for each section, with how many repositories and projects are tracked, and `1` to `4` to switch them while it is shown (the command menu goes to them as places); the section itself in the default slot. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Kbd from '@/components/Kbd.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';

import * as sectionLabels from './SettingsSectionLabel.loc.js';
import { SETTINGS_SECTIONS } from './settingsRoutes.js';
import type { SettingsSection } from './settingsRoutes.js';
import * as l from './SettingsView.loc.js';

const SECTION_KEYS: Readonly<Record<SettingsSection, string>> = {
  repositories: '1',
  projects: '2',
  saving: '3',
  account: '4',
};

const props = defineProps<{
  /** How many repositories are tracked. */
  repositories: number;
  /** How many projects are tracked. */
  projects: number;
}>();

const section = defineModel<SettingsSection>('section', { required: true });

const t = useTranslate();

const options = computed((): SegmentedTabsOption<SettingsSection>[] =>
  SETTINGS_SECTIONS.map(candidate => ({
    value: candidate,
    label: t(sectionLabels[candidate]),
    keyshortcuts: SECTION_KEYS[candidate],
    count: getCount(candidate),
  })),
);

useCommands(() =>
  SETTINGS_SECTIONS.map(candidate => ({
    id: `settings.section.${candidate}`,
    title: t(sectionLabels[candidate]),
    section: 'view',
    key: SECTION_KEYS[candidate],
    menu: false,
    run: () => {
      section.value = candidate;
    },
  })),
);

function getCount(candidate: SettingsSection) {
  switch (candidate) {
    case 'repositories':
      return props.repositories;
    case 'projects':
      return props.projects;
    default:
      return undefined;
  }
}
</script>

<template>
  <div :class="css.settingsView">
    <header :class="css.settingsView_header">
      <h1 :class="css.settingsView_title">{{ t(l.title) }}</h1>
      <SegmentedTabs
        v-model="section"
        :label="t(l.sections)"
        :options="options"
      />
      <span :class="css.settingsView_spacer" />
      <!-- Hidden from screen readers: each tab names its key in `aria-keyshortcuts`. -->
      <span
        :class="css.settingsView_keys"
        aria-hidden="true"
      >
        <Kbd :keys="SECTION_KEYS.repositories" />
        {{ t(l.keysTo) }}
        <Kbd :keys="SECTION_KEYS.account" />
      </span>
    </header>
    <div :class="css.settingsView_section">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.settingsView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.settingsView_header {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: $list-header-height;
  padding: 0 20px;
  border-bottom: 1px solid $color-border;
}

.settingsView_title {
  padding-right: $spacing-12;
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
}

.settingsView_spacer {
  flex: 1;
}

.settingsView_keys {
  display: inline-flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.settingsView_section {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
</style>
