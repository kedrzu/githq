<!-- The app's sidebar (D9): on top the logo and the collapse button, then search, "My work" and its groups with their counts — the same as the list's (D11) — and the tracked projects and repositories in the user's order — a private repository with a lock — each with its open items, or how far its first download is; a section with nothing in it is not drawn, and with nothing tracked at all a note and a link to Settings stand in their place. These lists scroll; the signed-in user, with their menu, stays at the very bottom. Expanded, or collapsed to a rail of icons with a mark for each tracked project (tracked repositories are reached by ⌘K from there). Search opens the command menu (⌘K). Right-clicking a tracked project or repository opens its menu (`trackedMenu`); without one, the browser's own. -->
<script lang="ts">
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

/** What a tracked project or repository shows beside its name. */
export type SidebarTrackedStatus =
  /** Its open issues, pull requests and draft issues. */
  | { readonly kind: 'count'; readonly count: number }
  /** Its first download, `percent` done; `null` before it counted its items. */
  | { readonly kind: 'downloading'; readonly percent: number | null }
  /** GitHub does not show it to the user (gone, or hidden by its organisation). */
  | { readonly kind: 'hidden' };

/** A tracked project or repository in the sidebar. */
export interface SidebarTrackedEntry {
  readonly key: string;
  /** The project's title, or `owner/name`. */
  readonly label: string;
  /** Where its view is. */
  readonly to: string;
  /** What it is, for its context menu. */
  readonly target: TrackedTarget;
  readonly status: SidebarTrackedStatus;
  /** A private repository: a lock instead of the repository icon. */
  readonly isPrivate?: boolean;
}

/** The tracked projects and repositories, in the user's order. */
export interface SidebarTracked {
  readonly projects: readonly SidebarTrackedEntry[];
  readonly repositories: readonly SidebarTrackedEntry[];
}
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import {
  AtSign,
  BookMarked,
  Inbox,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  SquareKanban,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import type { Viewer } from '@/auth/AuthStore.js';
import { APP_KEYS } from '@/commands/CommandRegistry.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import IconButton from '@/components/IconButton.vue';
import Sygnet from '@/components/Sygnet.vue';
import Wordmark from '@/components/Wordmark.vue';
import type { MyWorkCounts } from '@/myWork/buildMyWork.js';
import * as groupLabels from '@/myWork/MyWorkGroupLabel.loc.js';
import { getMyWorkGroupPath } from '@/myWork/myWorkRoutes.js';
import { SETTINGS_PATH } from '@/settings/settingsRoutes.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';
import { REPOSITORY_KIND_SEGMENTS } from '@/tracking/trackingRoutes.js';

import AccountMenu from './AccountMenu.vue';
import * as l from './Sidebar.loc.js';

const props = defineProps<{
  viewer: Viewer;
  /** Collapsed to the rail. */
  collapsed?: boolean;
  /** The rows of each "my work" group, as its list counts them; `null` until the first download. */
  counts?: MyWorkCounts | null;
  /** The tracked projects and repositories; none when not given. */
  tracked?: SidebarTracked;
}>();

const emit = defineEmits<{
  /** The collapse or expand button. */
  toggle: [];
  /** "Search or jump to…": the command menu. */
  search: [];
  signOut: [];
}>();

defineSlots<{
  /** The entries of a tracked project's or repository's context menu. */
  trackedMenu?(props: { target: TrackedTarget }): unknown;
}>();

const t = useTranslate();
const route = useRoute();

const projects = computed(() => props.tracked?.projects ?? []);
const repositories = computed(() => props.tracked?.repositories ?? []);
const nothingTracked = computed(() => projects.value.length === 0 && repositories.value.length === 0);

/** A repository's row is the current page on its view whichever list of it the address names (`/owner/name/issues`). */
function isCurrentRepository(repository: SidebarTrackedEntry) {
  return (
    route.path === repository.to ||
    Object.values(REPOSITORY_KIND_SEGMENTS).some(segment => route.path === `${repository.to}/${segment}`)
  );
}

function countText(group: MyWorkGroup | 'total') {
  return props.counts ? String(props.counts[group]) : t(l.countArriving);
}

function statusText(status: SidebarTrackedStatus) {
  switch (status.kind) {
    case 'count':
      return String(status.count);
    case 'downloading':
      return status.percent === null ? t(l.waiting) : `${status.percent}%`;
    case 'hidden':
      return t(l.hidden);
    default:
      return assertNever(status);
  }
}

/** A project's mark on the rail: "Platform Q4" → "PQ", the first two letters of a single word ("Docs" → "DO"). */
function getProjectMark(title: string) {
  const [first = '', second] = title.trim().split(/\s+/u);
  const letters = second === undefined ? [...first].slice(0, 2) : [[...first][0], [...second][0]];
  return letters.join('').toUpperCase();
}
</script>

<template>
  <nav
    :class="[css.sidebar, collapsed && css.sidebar_collapsed]"
    :aria-label="t(l.navigation)"
  >
    <template v-if="!collapsed">
      <div :class="css.sidebar_logo">
        <Wordmark :class="css.sidebar_wordmark" />
        <IconButton
          :icon="PanelLeftClose"
          :label="t(l.collapse)"
          :kbd="APP_KEYS.sidebar"
          :aria-keyshortcuts="APP_KEYS.sidebar"
          @click="emit('toggle')"
        />
      </div>

      <Button
        :class="css.sidebar_search"
        variant="field"
        block
        :icon="Search"
        :kbd="APP_KEYS.commandMenu"
        :aria-keyshortcuts="formatAriaKeyShortcuts(APP_KEYS.commandMenu)"
        @click="emit('search')"
      >
        {{ t(l.search) }}
      </Button>

      <div :class="css.sidebar_scroll">
        <ul :class="css.sidebar_list">
          <li>
            <RouterLink
              to="/"
              :class="css.sidebar_item"
              :active-class="css.sidebar_item_active"
            >
              <Inbox
                :class="css.sidebar_itemIcon"
                aria-hidden="true"
              />
              <span :class="css.sidebar_itemLabel">{{ t(l.myWork) }}</span>
              <span :class="css.sidebar_count">{{ countText('total') }}</span>
            </RouterLink>
          </li>
          <li
            v-for="group in MY_WORK_GROUPS"
            :key="group"
          >
            <RouterLink
              :to="getMyWorkGroupPath(group)"
              :class="[css.sidebar_item, group !== 'mentioned' && css.sidebar_item_sub]"
              :active-class="css.sidebar_item_active"
            >
              <AtSign
                v-if="group === 'mentioned'"
                :class="css.sidebar_itemIcon"
                aria-hidden="true"
              />
              <span :class="css.sidebar_itemLabel">{{ t(groupLabels[group]) }}</span>
              <span :class="css.sidebar_count">{{ countText(group) }}</span>
            </RouterLink>
          </li>
        </ul>

        <template v-if="projects.length > 0">
          <h2 :class="css.sidebar_section">{{ t(l.projects) }}</h2>
          <ul :class="css.sidebar_list">
            <li
              v-for="project in projects"
              :key="project.key"
            >
              <ContextMenu :disabled="!$slots.trackedMenu">
                <RouterLink
                  :to="project.to"
                  :class="css.sidebar_item"
                  :active-class="css.sidebar_item_active"
                >
                  <SquareKanban
                    :class="css.sidebar_itemIcon"
                    aria-hidden="true"
                  />
                  <span :class="css.sidebar_itemLabel">{{ project.label }}</span>
                  <span :class="css.sidebar_count">{{ statusText(project.status) }}</span>
                </RouterLink>
                <template #content>
                  <slot
                    name="trackedMenu"
                    :target="project.target"
                  />
                </template>
              </ContextMenu>
            </li>
          </ul>
        </template>

        <template v-if="repositories.length > 0">
          <h2 :class="css.sidebar_section">{{ t(l.repositories) }}</h2>
          <ul :class="css.sidebar_list">
            <li
              v-for="repository in repositories"
              :key="repository.key"
            >
              <ContextMenu :disabled="!$slots.trackedMenu">
                <RouterLink
                  :to="repository.to"
                  :class="[css.sidebar_item, isCurrentRepository(repository) && css.sidebar_item_active]"
                  :aria-current="isCurrentRepository(repository) ? 'page' : undefined"
                >
                  <component
                    :is="repository.isPrivate ? Lock : BookMarked"
                    :class="css.sidebar_itemIcon"
                    aria-hidden="true"
                  />
                  <span :class="css.sidebar_itemLabel">{{ repository.label }}</span>
                  <span :class="css.sidebar_count">{{ statusText(repository.status) }}</span>
                </RouterLink>
                <template #content>
                  <slot
                    name="trackedMenu"
                    :target="repository.target"
                  />
                </template>
              </ContextMenu>
            </li>
          </ul>
        </template>

        <div
          v-if="nothingTracked"
          :class="css.sidebar_nothingTracked"
        >
          <p :class="css.sidebar_note">{{ t(l.nothingTracked) }}</p>
          <RouterLink
            :to="SETTINGS_PATH"
            :class="css.sidebar_item"
            :active-class="css.sidebar_item_active"
          >
            <Settings
              :class="css.sidebar_itemIcon"
              aria-hidden="true"
            />
            <span :class="css.sidebar_itemLabel">{{ t(l.settings) }}</span>
          </RouterLink>
        </div>
      </div>

      <AccountMenu
        :viewer="viewer"
        @sign-out="emit('signOut')"
      />
    </template>

    <template v-else>
      <div :class="[css.sidebar_scroll, css.sidebar_scroll_rail]">
        <div :class="css.sidebar_railLogo">
          <Sygnet :class="css.sidebar_sygnet" />
        </div>
        <IconButton
          size="md"
          :icon="PanelLeftOpen"
          :label="t(l.expand)"
          :kbd="APP_KEYS.sidebar"
          :aria-keyshortcuts="APP_KEYS.sidebar"
          @click="emit('toggle')"
        />
        <IconButton
          size="md"
          :icon="Search"
          :label="t(l.search)"
          :kbd="APP_KEYS.commandMenu"
          :aria-keyshortcuts="formatAriaKeyShortcuts(APP_KEYS.commandMenu)"
          @click="emit('search')"
        />
        <hr :class="css.sidebar_divider" />
        <RouterLink
          to="/"
          :class="css.sidebar_railLink"
          :active-class="css.sidebar_railLink_active"
          :aria-label="t(l.myWork)"
        >
          <Inbox aria-hidden="true" />
        </RouterLink>
        <RouterLink
          :to="getMyWorkGroupPath('mentioned')"
          :class="css.sidebar_railLink"
          :active-class="css.sidebar_railLink_active"
          :aria-label="t(groupLabels.mentioned)"
        >
          <AtSign aria-hidden="true" />
        </RouterLink>
        <template v-if="projects.length > 0">
          <hr :class="css.sidebar_divider" />
          <ContextMenu
            v-for="project in projects"
            :key="project.key"
            :disabled="!$slots.trackedMenu"
          >
            <RouterLink
              :to="project.to"
              :class="css.sidebar_railLink"
              :active-class="css.sidebar_railLink_active"
            >
              <span
                :class="css.sidebar_railMark"
                aria-hidden="true"
                >{{ getProjectMark(project.label) }}</span
              >
              <span :class="css.sidebar_railName">{{ project.label }}</span>
            </RouterLink>
            <template #content>
              <slot
                name="trackedMenu"
                :target="project.target"
              />
            </template>
          </ContextMenu>
        </template>
        <RouterLink
          v-if="nothingTracked"
          :to="SETTINGS_PATH"
          :class="css.sidebar_railLink"
          :active-class="css.sidebar_railLink_active"
          :aria-label="t(l.settings)"
        >
          <Settings aria-hidden="true" />
        </RouterLink>
      </div>

      <AccountMenu
        :viewer="viewer"
        compact
        @sign-out="emit('signOut')"
      />
    </template>
  </nav>
</template>

<style lang="scss" module="css">
.sidebar {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  width: 100%;
  height: 100%;
  padding: $spacing-12 $spacing-10;
  overflow: hidden;
  background: $color-bg-2;
  border-right: 1px solid $color-border;
}

.sidebar_collapsed {
  gap: $spacing-4;
  align-items: center;
  padding: $spacing-12 0;
}

.sidebar_logo {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  padding: 6px $spacing-8;
  margin-bottom: $spacing-10;
}

.sidebar_wordmark {
  --wordmark-size: 18px;
}

.sidebar_search {
  margin-bottom: $spacing-10;
}

// What scrolls when the lists are long, leaving the user at the bottom. Reaching over the sidebar's padding, it does
// not clip the rows' focus rings.
.sidebar_scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-2;
  min-height: 0;
  padding: 3px $spacing-10;
  margin: -3px (-$spacing-10);
  overflow-y: auto;
}

.sidebar_scroll_rail {
  gap: $spacing-4;
  align-items: center;
  align-self: stretch;
  padding: 3px 0;
  margin: -3px 0;
}

.sidebar_list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: 0;
  margin: 0;
  list-style: none;
}

.sidebar_item {
  @include focus-ring;

  display: flex;
  gap: 9px;
  align-items: center;
  width: 100%;
  padding: 5px $spacing-8;
  font-size: $font-size-md;
  line-height: 18px;
  color: $color-fg-2;
  text-decoration: none;
  border-radius: $radius-md;
}

.sidebar_item:hover {
  color: $color-fg;
  background: $color-bg-3;
}

.sidebar_itemLabel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar_count {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.sidebar_item_active {
  font-weight: $font-weight-medium;
  color: $color-fg;
  background: $color-bg-3;
}

.sidebar_item_sub {
  padding-left: 32px;
}

.sidebar_itemIcon {
  flex: none;
  width: 15px;
  height: 15px;
}

.sidebar_section {
  padding: 14px $spacing-8 $spacing-4;
  font-size: $font-size-2xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.sidebar_nothingTracked {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  padding-top: 14px;
}

.sidebar_note {
  padding: 0 $spacing-8;
  margin: 0;
  font-size: $font-size-xs;
  line-height: 1.45;
  color: $color-fg-dim;
}

.sidebar_railLogo {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 34px;
}

.sidebar_sygnet {
  --sygnet-size: 28px;
  --sygnet-glyph-size: 13px;
}

.sidebar_railLink {
  @include focus-ring;

  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 34px;
  color: $color-fg-2;
  text-decoration: none;
  border-radius: 7px;

  &:hover {
    color: $color-fg;
    background: $color-bg-3;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.sidebar_railLink_active {
  color: $color-fg;
  background: $color-bg-3;
}

.sidebar_railMark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 9.5px;
  font-weight: $font-weight-semibold;
  border: 1px solid $color-border-2;
  border-radius: 5px;
}

.sidebar_railName {
  @include visually-hidden;
}

.sidebar_divider {
  flex: none;
  width: 24px;
  height: 1px;
  margin: $spacing-4 0;
  background: $color-border;
  border: none;
}
</style>
