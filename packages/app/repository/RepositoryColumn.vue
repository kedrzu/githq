<!-- A repository's column in the column layout (git-client D14, CH4–CH6): its name opening its menu, whether it is private, the way to GitHub and "not tracked" when it is not (D20); its sections, each with its count and its key, which the caller handles; and under them what belongs to the section: the projects its listed items live in, or what the caller puts in (Commits' branches and tags). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowUpRight,
  BookMarked,
  CircleDot,
  GitCommitHorizontal,
  GitPullRequest,
  Github,
  Lock,
  SquareKanban,
  Workflow,
} from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import IconButton from '@/components/IconButton.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import ListTitle from '@/lists/ListTitle.vue';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import NotTrackedChip from '@/tracking/NotTrackedChip.vue';

import type { RepositorySection } from './RepositorySection.js';
import type { RepositoryProjectLink } from './RepositoryView.vue';
import * as l from './RepositoryView.loc.js';
import { useRepositoryMeta } from './useRepositoryMeta.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  /** `null` while nothing of it is in the local copy to tell. */
  isPrivate: boolean | null;
  tracked: boolean;
  /** The sections, as the tabs of the other layout have them. */
  sections: readonly SegmentedTabsOption<RepositorySection>[];
  /** Where the GitHub icon leads: the page of what is shown. */
  githubUrl: string;
  /** The projects the section's listed items live in; none where it has none to say. */
  projects: readonly RepositoryProjectLink[];
  /** How many listed items are in no project. */
  withoutProject: number;
  /** The heading over the projects ("Its issues live in"). */
  projectsLabel: string;
}>();

defineSlots<{
  /** The entries of the menu the name opens. */
  menu?(): unknown;
  /** The column's lower part, under the sections, taking the rest of its height. */
  default?(): unknown;
}>();

const section = defineModel<RepositorySection>('section', { required: true });

const t = useTranslate();

const SECTION_ICONS: Readonly<Record<RepositorySection, LucideIcon>> = {
  issues: CircleDot,
  pullRequests: GitPullRequest,
  commits: GitCommitHorizontal,
  workflows: Workflow,
};

const meta = useRepositoryMeta(() => props.isPrivate);
const sectionsWithIcons = computed(() =>
  props.sections.map(option => ({ ...option, icon: SECTION_ICONS[option.value] })),
);
</script>

<template>
  <div :class="css.repositoryColumn">
    <header
      :class="css.repositoryColumn_head"
      v-bind="WINDOW_DRAG_REGION"
    >
      <component
        :is="isPrivate ? Lock : BookMarked"
        :class="css.repositoryColumn_icon"
        aria-hidden="true"
      />
      <span
        v-if="meta"
        :class="css.repositoryColumn_hidden"
        >{{ meta }}</span
      >
      <ListTitle
        :title="nameWithOwner"
        narrow
      >
        <template
          v-if="$slots.menu"
          #menu
        >
          <slot name="menu" />
        </template>
      </ListTitle>
      <IconButton
        :icon="Github"
        :label="t(l.openOnGitHub)"
        :link="githubUrl"
        target="_blank"
      />
    </header>
    <div
      v-if="!tracked"
      :class="css.repositoryColumn_notTracked"
    >
      <NotTrackedChip />
    </div>

    <SegmentedTabs
      v-model="section"
      orientation="vertical"
      :class="css.repositoryColumn_sections"
      :label="t(l.sections)"
      :options="sectionsWithIcons"
    />

    <div :class="css.repositoryColumn_lower">
      <nav
        v-if="projects.length > 0"
        :class="css.repositoryColumn_projects"
        :aria-label="projectsLabel"
      >
        <span :class="css.repositoryColumn_heading">{{ projectsLabel }}</span>
        <component
          :is="project.external ? 'a' : RouterLink"
          v-for="project in projects"
          :key="project.id"
          :class="css.repositoryColumn_item"
          v-bind="
            project.external ? { href: project.to, target: '_blank', rel: 'noopener noreferrer' } : { to: project.to }
          "
        >
          <SquareKanban
            :class="css.repositoryColumn_icon"
            aria-hidden="true"
          />
          <span :class="css.repositoryColumn_label">{{ project.title }}</span>
          <ArrowUpRight
            v-if="project.external"
            :class="css.repositoryColumn_external"
            aria-hidden="true"
          />
          <span :class="css.repositoryColumn_count">{{ project.count }}</span>
        </component>
        <span
          v-if="withoutProject > 0"
          :class="css.repositoryColumn_heading"
          >{{ t(l.inNoProject, { count: withoutProject }) }}</span
        >
      </nav>
      <slot />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.repositoryColumn {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 232px;
  min-height: 0;
  border-right: 1px solid $color-border;
}

.repositoryColumn_head {
  @include list-header;

  gap: $spacing-8;
  padding: 0 $spacing-10 0 $spacing-14;
}

.repositoryColumn_hidden {
  @include visually-hidden;
}

.repositoryColumn_notTracked {
  flex: none;
  padding: $spacing-8 $spacing-14 0;
}

.repositoryColumn_sections {
  padding: $spacing-8 $spacing-6;
}

.repositoryColumn_item {
  @include nav-row;
}

.repositoryColumn_icon {
  flex: none;
  width: 15px;
  height: 15px;
}

.repositoryColumn_external {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}

.repositoryColumn_label {
  @include nav-row-label;
}

.repositoryColumn_count {
  @include nav-row-count;
}

.repositoryColumn_lower {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.repositoryColumn_projects {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-height: 0;
  padding: 0 $spacing-6 $spacing-8;
  overflow-y: auto;
}

.repositoryColumn_heading {
  padding: $spacing-6 $spacing-8;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
