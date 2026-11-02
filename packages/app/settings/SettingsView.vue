<!-- The Settings screen (D15, G8, T4): its title and a tab for each section, with how many repositories and projects are tracked on What to track and an amber dot on Sync settings while syncing stopped (settings-sync T7), and `1` to `3` to switch them while it is shown (the command menu goes to them as places); the section itself in the default slot. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import { useCommands } from '@/commands/useCommands.js';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';

import * as sectionLabels from './SettingsSectionLabel.loc.js';
import { SETTINGS_SECTIONS } from './settingsRoutes.js';
import type { SettingsSection } from './settingsRoutes.js';
import * as l from './SettingsView.loc.js';

const SECTION_KEYS: Readonly<Record<SettingsSection, string>> = {
  tracking: '1',
  sync: '2',
  account: '3',
};

const props = defineProps<{
  /** How many repositories and projects are tracked, together: the count on What to track. */
  tracked: number;
  /** Syncing the settings stopped (settings-sync T7): the Sync settings tab carries an amber dot until it is fixed. */
  savingStopped?: boolean;
}>();

const section = defineModel<SettingsSection>('section', { required: true });

const t = useTranslate();

const options = computed((): SegmentedTabsOption<SettingsSection>[] =>
  SETTINGS_SECTIONS.map(candidate => ({
    value: candidate,
    label: t(sectionLabels[candidate]),
    keyshortcuts: SECTION_KEYS[candidate],
    count: candidate === 'tracking' ? props.tracked : undefined,
    attention: candidate === 'sync' && props.savingStopped ? t(l.savingStopped) : undefined,
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
</script>

<template>
  <div :class="css.settingsView">
    <header
      :class="css.settingsView_header"
      v-bind="WINDOW_DRAG_REGION"
    >
      <h1 :class="css.settingsView_title">{{ t(l.title) }}</h1>
      <SegmentedTabs
        v-model="section"
        :label="t(l.sections)"
        :options="options"
      />
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
  flex-wrap: wrap;
  row-gap: $spacing-6;
  align-items: center;
  min-height: $list-header-height;
  padding: $spacing-6 20px;
  border-bottom: 1px solid $color-border;
}

.settingsView_title {
  padding-right: $spacing-12;
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
}

.settingsView_section {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
</style>
