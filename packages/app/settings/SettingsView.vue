<!-- The Settings screen (D15, G8, T4): its title, a tab for each section, with how many repositories and projects are tracked and an amber dot on Saving to GitHub while syncing stopped (settings-sync T7), and `1` to `4` to switch them while it is shown (the command menu goes to them as places); the section itself in the default slot. A section with controls of its own (the owner filter and the search of G8) teleports them to the end of the header, `#${SETTINGS_CONTROLS_ID}`, keeping their state and keys with its lists. -->
<script lang="ts">
/** The id of the place in the header a section teleports its controls to. */
export const SETTINGS_CONTROLS_ID = 'settings-controls';
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
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
  /** Syncing the settings stopped (settings-sync T7): the Saving to GitHub tab carries an amber dot until it is fixed. */
  savingStopped?: boolean;
}>();

const section = defineModel<SettingsSection>('section', { required: true });

const t = useTranslate();

const options = computed((): SegmentedTabsOption<SettingsSection>[] =>
  SETTINGS_SECTIONS.map(candidate => ({
    value: candidate,
    label: t(sectionLabels[candidate]),
    keyshortcuts: SECTION_KEYS[candidate],
    count: getCount(candidate),
    attention: candidate === 'saving' && props.savingStopped ? t(l.savingStopped) : undefined,
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
      <div
        :id="SETTINGS_CONTROLS_ID"
        :class="css.settingsView_controls"
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
  container-type: inline-size;
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

  // In a narrow screen the tabs need the room; each still names its key to the help sheet.
  @container (max-width: 580px) {
    display: none;
  }
}

// Takes the free room before the spacer does, up to its full width (the owner menu and the 280px search of G8), and
// gives it back first when there is none.
.settingsView_controls {
  display: flex;
  flex: 1000 1 226px;
  gap: $spacing-10;
  align-items: center;
  justify-content: flex-end;
  max-width: 386px;
  min-width: 0;
  // Wrapped to a line of their own, they stay at the right.
  margin-left: auto;

  &:empty {
    display: none;
  }
}

.settingsView_section {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
</style>
