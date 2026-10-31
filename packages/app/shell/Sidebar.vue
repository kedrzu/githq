<!-- The app's sidebar (D9): the account, search, "My work" and its groups with their counts — the same as the list's (D11) — and the tracked projects and repositories in the user's order, each with its open items, or how far its first download is; `+` and "Track repositories…" open the tracking page (G8). Expanded, or collapsed to a rail of icons. Search opens the command menu (⌘K). Right-clicking a repository opens its menu (`repositoryMenu`); without one, the browser's own. -->
<script lang="ts">
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
  readonly status: SidebarTrackedStatus;
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
import { AtSign, BookMarked, Inbox, PanelLeftClose, PanelLeftOpen, Plus, Search, SquareKanban } from 'lucide-vue-next';
import { RouterLink, useRoute } from 'vue-router';

import type { Viewer } from '@/auth/AuthStore.js';
import { APP_KEYS } from '@/commands/CommandRegistry.js';
import { formatCommandKey } from '@/commands/formatCommandKey.js';
import { TRACKING_PATH } from '@/auth/routeAccess.js';
import Button from '@/components/Button.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import IconButton from '@/components/IconButton.vue';
import type { MyWorkCounts } from '@/myWork/buildMyWork.js';
import * as groupLabels from '@/myWork/MyWorkGroupLabel.loc.js';
import { getMyWorkGroupPath } from '@/myWork/myWorkRoutes.js';
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
  /** The entries of a tracked repository's context menu. */
  repositoryMenu?(props: { nameWithOwner: string }): unknown;
}>();

const t = useTranslate();
const route = useRoute();

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
</script>

<template>
  <nav
    :class="[css.sidebar, collapsed && css.sidebar_collapsed]"
    :aria-label="t(l.navigation)"
  >
    <template v-if="!collapsed">
      <div :class="css.sidebar_account">
        <AccountMenu
          :viewer="viewer"
          @sign-out="emit('signOut')"
        />
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
        :kbd="formatCommandKey(APP_KEYS.commandMenu).join('')"
        :aria-keyshortcuts="APP_KEYS.commandMenu"
        @click="emit('search')"
      >
        {{ t(l.search) }}
      </Button>

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

      <div :class="css.sidebar_section">
        <h2 :class="css.sidebar_sectionTitle">{{ t(l.projects) }}</h2>
        <IconButton
          :icon="Plus"
          :label="t(l.trackProjects)"
          :link="{ path: TRACKING_PATH, query: { tab: 'projects' } }"
        />
      </div>
      <ul
        v-if="tracked?.projects.length"
        :class="css.sidebar_list"
      >
        <li
          v-for="project in tracked.projects"
          :key="project.key"
        >
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
        </li>
      </ul>

      <div :class="css.sidebar_section">
        <h2 :class="css.sidebar_sectionTitle">{{ t(l.repositories) }}</h2>
        <IconButton
          :icon="Plus"
          :label="t(l.trackRepository)"
          :link="TRACKING_PATH"
        />
      </div>
      <ul
        v-if="tracked?.repositories.length"
        :class="css.sidebar_list"
      >
        <li
          v-for="repository in tracked.repositories"
          :key="repository.key"
        >
          <ContextMenu :disabled="!$slots.repositoryMenu">
            <RouterLink
              :to="repository.to"
              :class="[css.sidebar_item, isCurrentRepository(repository) && css.sidebar_item_active]"
              :aria-current="isCurrentRepository(repository) ? 'page' : undefined"
            >
              <BookMarked
                :class="css.sidebar_itemIcon"
                aria-hidden="true"
              />
              <span :class="css.sidebar_itemLabel">{{ repository.label }}</span>
              <span :class="css.sidebar_count">{{ statusText(repository.status) }}</span>
            </RouterLink>
            <template #content>
              <slot
                name="repositoryMenu"
                :name-with-owner="repository.label"
              />
            </template>
          </ContextMenu>
        </li>
      </ul>
      <Button
        variant="ghost"
        block
        :icon="Plus"
        :link="TRACKING_PATH"
        :class="css.sidebar_track"
      >
        {{ t(l.trackRepositories) }}
      </Button>
    </template>

    <template v-else>
      <AccountMenu
        :viewer="viewer"
        compact
        @sign-out="emit('signOut')"
      />
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
        :kbd="formatCommandKey(APP_KEYS.commandMenu).join('')"
        :aria-keyshortcuts="APP_KEYS.commandMenu"
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
      <hr :class="css.sidebar_divider" />
      <IconButton
        size="md"
        :icon="BookMarked"
        :label="t(l.trackRepositories)"
        :link="TRACKING_PATH"
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
  overflow-y: auto;
  background: $color-bg-2;
  border-right: 1px solid $color-border;
}

.sidebar_collapsed {
  gap: $spacing-4;
  align-items: center;
  padding: $spacing-12 0;
}

.sidebar_account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-10;
}

.sidebar_search {
  margin-bottom: $spacing-10;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 $spacing-2 $spacing-8;
}

.sidebar_sectionTitle {
  font-size: $font-size-2xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.sidebar_track {
  color: $color-fg-dim;
}

.sidebar_railLink {
  @include focus-ring;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 34px;
  color: $color-fg-2;
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

.sidebar_divider {
  width: 24px;
  height: 1px;
  margin: $spacing-4 0;
  background: $color-border;
  border: none;
}
</style>
