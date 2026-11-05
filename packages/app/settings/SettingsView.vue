<!-- The Settings screen (githq D26, `Settings / Sections column`): a column of the sections beside the page, as a repository's column layout has its own (`SegmentedTabs`, vertical). Each row has its icon, how many repositories are tracked on Repositories and how many projects on Projects (D25), an amber dot on Sync settings while syncing stopped (settings-sync T7), and its key, by its place in `SETTINGS_SECTIONS`, which switches to it while the screen is shown (the command menu goes to them as places). The page's header holds only the section's name; the section itself in the default slot, Changelog bringing a header of its own (`Changelog / Pane`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  BookMarked,
  CircleArrowDown,
  Cloud,
  FileDiff,
  PanelsTopLeft,
  ScrollText,
  SquareKanban,
  User,
} from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';

import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import { useCommands } from '@/commands/useCommands.js';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';

import * as sectionLabels from './SettingsSectionLabel.loc.js';
import { SETTINGS_SECTIONS } from './settingsRoutes.js';
import type { SettingsSection } from './settingsRoutes.js';
import * as l from './SettingsView.loc.js';

const SECTION_ICONS: Readonly<Record<SettingsSection, LucideIcon>> = {
  repositories: BookMarked,
  projects: SquareKanban,
  display: PanelsTopLeft,
  review: FileDiff,
  sync: Cloud,
  account: User,
  updates: CircleArrowDown,
  changelog: ScrollText,
};

const props = defineProps<{
  /** How many repositories are tracked: the count on Repositories. */
  trackedRepositories: number;
  /** How many projects are tracked: the count on Projects. */
  trackedProjects: number;
  /** Syncing the settings stopped (settings-sync T7): the Sync settings row carries an amber dot until it is fixed. */
  savingStopped?: boolean;
}>();

const section = defineModel<SettingsSection>('section', { required: true });

const t = useTranslate();

const counts = computed((): Partial<Record<SettingsSection, number>> => ({
  repositories: props.trackedRepositories,
  projects: props.trackedProjects,
}));

const options = computed((): SegmentedTabsOption<SettingsSection>[] =>
  SETTINGS_SECTIONS.map((candidate, index) => ({
    value: candidate,
    label: t(sectionLabels[candidate]),
    icon: SECTION_ICONS[candidate],
    keyshortcuts: getKey(index),
    count: counts.value[candidate],
    attention: candidate === 'sync' && props.savingStopped ? t(l.savingStopped) : undefined,
  })),
);

useCommands(() =>
  SETTINGS_SECTIONS.map((candidate, index) => ({
    id: `settings.section.${candidate}`,
    title: t(sectionLabels[candidate]),
    section: 'view',
    key: getKey(index),
    menu: false,
    run: () => {
      section.value = candidate;
    },
  })),
);

function getKey(index: number) {
  return String(index + 1);
}
</script>

<template>
  <div :class="css.settingsView">
    <div :class="css.settingsView_column">
      <div
        :class="css.settingsView_head"
        v-bind="WINDOW_DRAG_REGION"
      >
        <h1 :class="css.settingsView_title">{{ t(l.title) }}</h1>
      </div>
      <SegmentedTabs
        v-model="section"
        orientation="vertical"
        roomy
        :class="css.settingsView_sections"
        :label="t(l.sections)"
        :options="options"
      />
    </div>
    <div :class="css.settingsView_page">
      <header
        v-if="section !== 'changelog'"
        :class="css.settingsView_header"
        v-bind="WINDOW_DRAG_REGION"
      >
        <h2 :class="css.settingsView_sectionName">{{ t(sectionLabels[section]) }}</h2>
      </header>
      <div :class="css.settingsView_section">
        <slot />
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.settingsView {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.settingsView_column {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 232px;
  min-height: 0;
  overflow-y: auto;
  background: $color-bg-2;
  border-right: 1px solid $color-border;
}

.settingsView_head {
  @include list-header;

  padding: 0 $spacing-14;
}

.settingsView_title {
  font-size: $font-size-row-title;
  font-weight: $font-weight-semibold;
}

.settingsView_sections {
  padding: $spacing-8 $spacing-6;
}

.settingsView_page {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.settingsView_header {
  @include list-header;

  padding: 0 $spacing-20;
}

.settingsView_sectionName {
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
