<!-- The signed-in app's frame (D1 screen of Direction D): the sidebar (expanded or the rail, toggled also with `[`), the screen in the middle, an opened item's panel at the right, and the status bar along the bottom with a segment under each — the allowance under the sidebar, how fresh the list is under the screen, how fresh the item is under its panel. -->
<script lang="ts" setup>
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next';

import type { Viewer } from '@/auth/AuthStore.js';
import { APP_KEYS } from '@/commands/CommandRegistry.js';
import { useCommands } from '@/commands/useCommands.js';
import type { MyWorkCounts } from '@/myWork/buildMyWork.js';
import type { Freshness } from '@/sync/Freshness.js';
import type { SyncNotice } from '@/sync/SyncEngine.js';

import * as l from './AppShell.loc.js';
import FreshnessSegment from './FreshnessSegment.vue';
import type { SegmentEdits } from './FreshnessSegment.vue';
import Sidebar from './Sidebar.vue';
import type { SidebarTracked } from './Sidebar.vue';
import StatusBar from './StatusBar.vue';

defineProps<{
  viewer: Viewer;
  /** GitHub's GraphQL allowance, for the sidebar's segment of the status bar. */
  rateLimit: GitHubRateLimit | null;
  /** What holds the whole app back (offline, refresh paused), shown in the sidebar's segment instead. */
  notice: SyncNotice | null;
  /** When the app last refreshed from GitHub, for the explanation of a pause; `null` never. */
  lastRefreshedAt?: number | null;
  /** How fresh the screen's list is, for its segment. */
  freshness: Freshness;
  /** How fresh an item opened over the screen is (in the panel or a modal), for a segment of its own. */
  itemFreshness?: Freshness | null;
  /** The user's edits on their way or failed, said in the screen's segment instead of its freshness. */
  edits?: SegmentEdits | null;
  /** The same of the item opened over the screen, in its segment. */
  itemEdits?: SegmentEdits | null;
  /** The counts of "my work" for the sidebar; `null` until the first download. */
  myWorkCounts?: MyWorkCounts | null;
  /** The tracked projects and repositories for the sidebar. */
  tracked?: SidebarTracked;
}>();

const emit = defineEmits<{
  signOut: [];
  /** The sidebar's search: the command menu. */
  search: [];
  /** A failed edit in the status bar was clicked: its message again. */
  showFailure: [];
}>();

defineSlots<{
  /** The screen. */
  default?(): unknown;
  /** An item opened beside the screen (`ItemView` in its panel arrangement). */
  panel?(): unknown;
}>();

/** The sidebar collapsed to the rail. */
const collapsed = defineModel<boolean>('collapsed', { default: false });

const t = useTranslate();

// `[` collapses or expands the sidebar, unless the key is being typed into something.
useCommands(() => [
  {
    id: 'app.sidebar',
    title: collapsed.value ? t(l.expandSidebar) : t(l.collapseSidebar),
    section: 'app',
    key: APP_KEYS.sidebar,
    icon: collapsed.value ? PanelLeftOpen : PanelLeftClose,
    run: toggle,
  },
]);

function toggle() {
  collapsed.value = !collapsed.value;
}
</script>

<template>
  <div :class="css.appShell">
    <div :class="css.appShell_surfaces">
      <Sidebar
        :viewer="viewer"
        :collapsed="collapsed"
        :counts="myWorkCounts"
        :tracked="tracked"
        @toggle="toggle"
        @search="emit('search')"
        @sign-out="emit('signOut')"
      />
      <main :class="css.appShell_screen">
        <slot />
      </main>
      <div
        v-if="$slots.panel"
        :class="css.appShell_panel"
      >
        <slot name="panel" />
      </div>
    </div>
    <StatusBar
      :rate-limit="rateLimit"
      :notice="notice"
      :collapsed="collapsed"
      :last-refreshed-at="lastRefreshedAt"
    >
      <FreshnessSegment
        :freshness="freshness"
        :edits="edits"
        :edits-hint="notice?.kind !== 'paused' || notice.allowance?.remaining !== 0"
        @show-failure="emit('showFailure')"
      />
      <div
        v-if="itemFreshness"
        :class="css.appShell_itemSegment"
      >
        <FreshnessSegment
          :freshness="itemFreshness"
          :edits="itemEdits"
          @show-failure="emit('showFailure')"
        />
      </div>
    </StatusBar>
  </div>
</template>

<style lang="scss" module="css">
.appShell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: $color-bg;
}

.appShell_surfaces {
  display: flex;
  flex: 1;
  min-height: 0;
}

.appShell_panel {
  display: flex;
  flex: none;
  flex-direction: column;
  width: $item-panel-width;
  min-height: 0;
  border-left: 1px solid $color-border;
}

// As wide as the panel above it.
.appShell_itemSegment {
  display: flex;
  flex: none;
  width: $item-panel-width;
}

.appShell_screen {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
</style>
