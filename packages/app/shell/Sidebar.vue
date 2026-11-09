<!-- The app's sidebar (D9): on top the logo and the collapse button, then search, "Draft reviews" with their count while there is any (code review D28; an amber pencil with a badge on the rail), "My work" and its groups with their counts — the same as the list's (D11), a group's blank while it is still arriving and the total until every group is in (first run and loading D14) — then "Broken workflows" with their total while any is known broken or its screen is open (actions W1: a red dot and count for a break under a day old, quiet ones after), and the tracked projects and repositories in the user's order — a private repository with a lock, a repository's icon marked when its workflows are broken (bright or quiet red) or not read yet (a hollow ring) — each with its open items once they are in, blank before (first run and loading D4: how far downloads are is the status bar's to say); a section with nothing in it is not drawn, and with nothing tracked at all a note and a link to Settings stand in their place. These lists scroll under the logo and search; the signed-in user, with their menu, stays at the very bottom — with an amber dot on the avatar while syncing the settings stopped. Expanded, or collapsed to a rail of icons — "Broken workflows" with its total in a badge — with a mark for each tracked project (tracked repositories are reached by ⌘K from there). Search opens the command menu (⌘K). Right-clicking a tracked project or repository opens its menu (`trackedMenu`); without one, the browser's own. On a link Tab focused, ↑/↓ move to the previous or next link, which holds the screen's keys back as it did (`useTabFocus`). In the macOS desktop app a strip along its top holds the window controls and moves the window, staying put above everything else. -->
<script lang="ts">
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

import type { SidebarWorkflowMarker } from './SidebarTypes.js';

/** What a tracked project or repository shows beside its name. */
export type SidebarTrackedStatus =
  /** Its open issues, pull requests and draft issues. */
  | { readonly kind: 'count'; readonly count: number }
  /** Its open items are not all in yet: nothing shows where its count goes. */
  | { readonly kind: 'downloading' }
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
  /** The marker on a repository's icon, of its workflows (actions W1); none when nothing there can be told. */
  readonly workflowMarker?: SidebarWorkflowMarker | null;
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
  PencilLine,
  Search,
  Settings,
  SquareKanban,
  Workflow,
} from 'lucide-vue-next';
import { computed, useTemplateRef } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import type { Viewer } from '@/auth/AuthStore.js';
import { APP_KEYS } from '@/commands/CommandRegistry.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import IconButton from '@/components/IconButton.vue';
import Sygnet from '@/components/Sygnet.vue';
import Wordmark from '@/components/Wordmark.vue';
import * as groupLabels from '@/myWork/MyWorkGroupLabel.loc.js';
import { DRAFT_REVIEWS_PATH, getMyWorkGroupPath } from '@/myWork/myWorkRoutes.js';
import { SETTINGS_PATH } from '@/settings/settingsRoutes.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';
import { BROKEN_WORKFLOWS_PATH, REPOSITORY_SECTION_SEGMENTS } from '@/tracking/trackingRoutes.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';
import { moveTabFocus } from '@/utils/useTabFocus.js';

import AccountMenu from './AccountMenu.vue';
import * as l from './Sidebar.loc.js';
import type { SidebarBrokenWorkflows, SidebarMyWorkCounts } from './SidebarTypes.js';

const props = defineProps<{
  viewer: Viewer;
  /** Collapsed to the rail. */
  collapsed?: boolean;
  /** The screen wants the rail (a code review): there is nothing to expand it with. */
  railForced?: boolean;
  /** Keep the top free for macOS's window controls, while they sit over it (`WindowControls`). */
  windowControls?: boolean;
  /** The rows of each "my work" group, as its list counts them, blank while still arriving; `null` before any group arrived. */
  counts?: SidebarMyWorkCounts | null;
  /** The tracked projects and repositories; none when not given. */
  tracked?: SidebarTracked;
  /** Syncing the settings stopped (settings-sync T9, T10): the user's avatar and menu say so. */
  settingsSyncStopped?: boolean;
  /** The entry "Broken workflows" (actions W1); not drawn when `null` or not given. */
  brokenWorkflows?: SidebarBrokenWorkflows | null;
  /** How many pull requests have the user's draft review (code review D28): the entry shows only with any. */
  draftReviews?: number;
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
const navRef = useTemplateRef<HTMLElement>('nav');

const projects = computed(() => props.tracked?.projects ?? []);
const repositories = computed(() => props.tracked?.repositories ?? []);
const nothingTracked = computed(() => projects.value.length === 0 && repositories.value.length === 0);

/** A repository's row is the current page on its view whichever section of it the address names (`/owner/name/issues`). */
function isCurrentRepository(repository: SidebarTrackedEntry) {
  return (
    route.path === repository.to ||
    Object.values(REPOSITORY_SECTION_SEGMENTS).some(segment => route.path === `${repository.to}/${segment}`)
  );
}

function moveBetweenLinks(event: KeyboardEvent) {
  const { key, target } = event;
  if (
    (key !== 'ArrowDown' && key !== 'ArrowUp') ||
    event.shiftKey ||
    !isSingleKeyShortcut(event) ||
    !(target instanceof HTMLAnchorElement) ||
    !target.hasAttribute('data-tab-focus')
  ) {
    return;
  }

  event.preventDefault();
  const links = [...(navRef.value?.querySelectorAll<HTMLElement>('a[href]') ?? [])];
  const next = links[links.indexOf(target) + (key === 'ArrowDown' ? 1 : -1)];
  if (next) {
    moveTabFocus(next);
  }
}

function countText(group: MyWorkGroup | 'total') {
  const count = props.counts?.[group] ?? null;
  return count === null ? '' : String(count);
}

function statusText(status: SidebarTrackedStatus) {
  switch (status.kind) {
    case 'count':
      return String(status.count);
    case 'downloading':
      return '';
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
    ref="nav"
    :class="[css.sidebar, collapsed && css.sidebar_collapsed, windowControls && css.sidebar_underWindowControls]"
    :aria-label="t(l.navigation)"
    @keydown="moveBetweenLinks"
  >
    <div
      v-if="windowControls"
      :class="css.sidebar_windowControls"
      data-tauri-drag-region
    />
    <template v-if="!collapsed">
      <div :class="css.sidebar_logo">
        <Wordmark :class="css.sidebar_wordmark" />
        <IconButton
          :icon="PanelLeftClose"
          :label="t(l.collapse)"
          :kbd="APP_KEYS.sidebar"
          :keyshortcuts="APP_KEYS.sidebar"
          @click="emit('toggle')"
        />
      </div>

      <Button
        :class="css.sidebar_search"
        variant="field"
        block
        :icon="Search"
        :kbd="APP_KEYS.commandMenu"
        :keyshortcuts="formatAriaKeyShortcuts(APP_KEYS.commandMenu)"
        @click="emit('search')"
      >
        {{ t(l.search) }}
      </Button>

      <div :class="css.sidebar_scroll">
        <ul :class="css.sidebar_list">
          <li v-if="draftReviews">
            <RouterLink
              :to="DRAFT_REVIEWS_PATH"
              :class="[css.sidebar_item, css.sidebar_item_draft]"
              :active-class="css.sidebar_item_active"
            >
              <PencilLine
                :class="css.sidebar_itemIcon"
                aria-hidden="true"
              />
              <span :class="css.sidebar_itemLabel">{{ t(l.draftReviews) }}</span>
              <span :class="[css.sidebar_count, css.sidebar_count_draft]">{{ draftReviews }}</span>
            </RouterLink>
          </li>
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
          <li v-if="brokenWorkflows">
            <RouterLink
              :to="BROKEN_WORKFLOWS_PATH"
              :class="css.sidebar_item"
              :active-class="css.sidebar_item_active"
            >
              <Workflow
                :class="css.sidebar_itemIcon"
                aria-hidden="true"
              />
              <span :class="css.sidebar_itemLabel">{{ t(l.brokenWorkflows) }}</span>
              <span
                v-if="brokenWorkflows.tone !== 'none'"
                :class="[css.sidebar_brokenDot, css[`sidebar_brokenDot_${brokenWorkflows.tone}`]]"
                aria-hidden="true"
              />
              <span :class="[css.sidebar_count, css[`sidebar_count_${brokenWorkflows.tone}`]]">{{
                brokenWorkflows.count
              }}</span>
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
                  <span :class="css.sidebar_repositoryIcon">
                    <component
                      :is="repository.isPrivate ? Lock : BookMarked"
                      :class="css.sidebar_itemIcon"
                      aria-hidden="true"
                    />
                    <span
                      v-if="repository.workflowMarker"
                      :class="[css.sidebar_marker, css[`sidebar_marker_${repository.workflowMarker}`]]"
                      tid="workflow-marker"
                      :data-marker="repository.workflowMarker"
                      aria-hidden="true"
                    />
                  </span>
                  <span :class="css.sidebar_itemLabel"
                    >{{ repository.label
                    }}<span
                      v-if="repository.workflowMarker === 'new' || repository.workflowMarker === 'settled'"
                      :class="css.sidebar_hidden"
                    >
                      · {{ t(l.workflowsBroken) }}</span
                    ></span
                  >
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
        :settings-sync-stopped="settingsSyncStopped"
        @sign-out="emit('signOut')"
      />
    </template>

    <template v-else>
      <div :class="css.sidebar_railLogo">
        <Sygnet :class="css.sidebar_sygnet" />
      </div>
      <IconButton
        v-if="!railForced"
        size="md"
        :icon="PanelLeftOpen"
        :label="t(l.expand)"
        :kbd="APP_KEYS.sidebar"
        :keyshortcuts="APP_KEYS.sidebar"
        @click="emit('toggle')"
      />
      <IconButton
        size="md"
        :icon="Search"
        :label="t(l.search)"
        :kbd="APP_KEYS.commandMenu"
        :keyshortcuts="formatAriaKeyShortcuts(APP_KEYS.commandMenu)"
        @click="emit('search')"
      />
      <div :class="[css.sidebar_scroll, css.sidebar_scroll_rail]">
        <hr :class="css.sidebar_divider" />
        <RouterLink
          v-if="draftReviews"
          :to="DRAFT_REVIEWS_PATH"
          :class="[css.sidebar_railLink, css.sidebar_railLink_draft]"
          :active-class="css.sidebar_railLink_active"
          :aria-label="t(l.draftReviewsCount, { count: draftReviews })"
        >
          <PencilLine aria-hidden="true" />
          <span
            :class="[css.sidebar_badge, css.sidebar_badge_draft]"
            aria-hidden="true"
            >{{ draftReviews }}</span
          >
        </RouterLink>
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
        <RouterLink
          v-if="brokenWorkflows"
          :to="BROKEN_WORKFLOWS_PATH"
          :class="css.sidebar_railLink"
          :active-class="css.sidebar_railLink_active"
          :aria-label="
            brokenWorkflows.tone === 'none'
              ? t(l.brokenWorkflows)
              : t(l.brokenWorkflowsCount, { count: brokenWorkflows.count })
          "
        >
          <Workflow aria-hidden="true" />
          <span
            v-if="brokenWorkflows.tone !== 'none'"
            :class="[css.sidebar_badge, css[`sidebar_badge_${brokenWorkflows.tone}`]]"
            aria-hidden="true"
            >{{ brokenWorkflows.count }}</span
          >
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
        :settings-sync-stopped="settingsSyncStopped"
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

.sidebar_underWindowControls {
  padding-top: 0;
}

// Out to the sidebar's edges; items scroll away under it, not under the window controls.
.sidebar_windowControls {
  position: sticky;
  top: 0;
  z-index: 1;
  flex: none;
  align-self: stretch;
  height: $window-controls-height;
  margin: 0 (-$spacing-10);
  background: $color-bg-2;

  .sidebar_collapsed > & {
    margin: 0;
  }
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
  @include nav-row;
}

.sidebar_itemLabel {
  @include nav-row-label;
}

.sidebar_count {
  @include nav-row-count;
}

.sidebar_item_active {
  @include nav-row-current;
}

// Amber all the time: it's the one thing here that blocks someone else (code review D28).
.sidebar_item_draft,
.sidebar_item_draft:hover,
.sidebar_railLink_draft,
.sidebar_railLink_draft:hover {
  color: $color-amber;
}

.sidebar_count_draft {
  color: $color-amber;
}

.sidebar_count_new {
  color: $color-red;
}

.sidebar_count_settled {
  color: $color-fg-2;
}

// The entry's marker (actions W1): bright red with a break under a day old, quiet red with older ones only.
.sidebar_brokenDot {
  @include workflow-broken-marker;
}

.sidebar_brokenDot_settled {
  background: $color-red-quiet;
}

// A repository's icon with its workflows' marker on its corner (actions W1).
.sidebar_repositoryIcon {
  position: relative;
  display: flex;
  flex: none;
}

// 7px on the icon's corner, ringed in the row's background so it reads apart from the icon.
.sidebar_marker {
  position: absolute;
  top: 10px;
  left: 10px;
  box-sizing: border-box;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px $color-bg-2;

  .sidebar_item:hover &,
  .sidebar_item_active & {
    box-shadow: 0 0 0 1.5px $color-bg-3;
  }
}

.sidebar_marker_new {
  background: $color-red;
}

.sidebar_marker_settled {
  background: $color-red-quiet;
}

// Not read yet: a hollow ring, neither healthy nor broken.
.sidebar_marker_unread {
  background: $color-bg-2;
  border: 1.5px solid $color-fg-3;

  .sidebar_item:hover &,
  .sidebar_item_active & {
    background: $color-bg-3;
  }
}

.sidebar_hidden {
  @include visually-hidden;
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
  // A fill alone is too faint to tell which it is (D30): the accent's edge, as a selected row has.
  box-shadow: inset 2px 0 0 $color-accent;
}

// The rail's count of broken workflows (actions W1), on the icon's corner: filled red with a break under a day
// old, outlined in quiet red with older ones only.
.sidebar_badge {
  position: absolute;
  top: 3px;
  left: 21px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 $spacing-4;
  font-size: 9px;
  font-weight: $font-weight-semibold;
  line-height: 1;
  border-radius: 7px;
}

.sidebar_badge_new {
  color: $color-on-light;
  background: $color-red;
}

.sidebar_badge_draft {
  color: $color-on-light;
  background: $color-amber;
}

.sidebar_badge_settled {
  color: $color-fg;
  background: $color-bg-3;
  box-shadow: inset 0 0 0 1px $color-red-quiet;
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
