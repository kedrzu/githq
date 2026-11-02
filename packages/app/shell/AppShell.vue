<!-- The signed-in app's frame (D1 screen of Direction D): the sidebar (expanded or the rail, toggled also with `[`), the screen in the middle, an opened item's panel at the right — the expanded sidebar and the panel resized by dragging their edge, their widths remembered in this browser — and the status bar along the bottom with a segment under each — the allowance under the sidebar, how fresh the list is under the screen, how fresh the item is under its panel. In the macOS desktop app the rail is wider, to hold the window controls over the sidebar. -->
<script lang="ts" setup>
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next';
import { SplitterGroup, SplitterPanel } from 'reka-ui';
import { nextTick, useTemplateRef, watch } from 'vue';

import type { Viewer } from '@/auth/AuthStore.js';
import { APP_KEYS } from '@/commands/CommandRegistry.js';
import { useCommands } from '@/commands/useCommands.js';
import ResizeHandle from '@/components/ResizeHandle.vue';
import { usePanelWidth } from '@/components/usePanelWidth.js';
import type { MyWorkCounts } from '@/myWork/buildMyWork.js';
import type { Freshness } from '@/sync/Freshness.js';
import type { SyncNotice } from '@/sync/SyncEngine.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

import * as l from './AppShell.loc.js';
import FreshnessSegment from './FreshnessSegment.vue';
import type { SegmentEdits } from './FreshnessSegment.vue';
import Sidebar from './Sidebar.vue';
import type { SidebarTracked } from './Sidebar.vue';
import StatusBar from './StatusBar.vue';
import { WINDOW_CONTROLS_OVERLAID } from './windowControls.js';

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
  /** Syncing the settings stopped (settings-sync T9): an amber dot on the user's avatar. */
  settingsSyncStopped?: boolean;
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
  /** The entries of a tracked project's or repository's context menu in the sidebar. */
  trackedMenu?(props: { target: TrackedTarget }): unknown;
}>();

/** The sidebar collapsed to the rail. */
const collapsed = defineModel<boolean>('collapsed', { default: false });

/** `$sidebar-rail-width`, or room for macOS's window controls over it: the rail is not resized. */
const SIDEBAR_RAIL_WIDTH = WINDOW_CONTROLS_OVERLAID ? 80 : 56;
/** What is left to the screen, at least, in percent of the window. */
const SCREEN_MIN_SIZE = 25;

const t = useTranslate();
const sidebarWidth = usePanelWidth({ key: 'sidebar', default: 236, min: 180, max: 400 });
const panelWidth = usePanelWidth({ key: 'itemPanel', default: 560, min: 400, max: 960 });
const sidebarPanel = useTemplateRef<InstanceType<typeof SplitterPanel>>('sidebarPanel');
const itemPanel = useTemplateRef<InstanceType<typeof SplitterPanel>>('itemPanel');

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

// Reka lays the panels out anew whenever one comes or goes or the rail toggles — from the `default-size` each had
// when it mounted, not the one it has now: once it has, the widths the user chose since are put back.
async function restoreWidths() {
  await nextTick();
  if (!collapsed.value) {
    sidebarPanel.value?.resize(sidebarWidth.stored);
  }

  itemPanel.value?.resize(panelWidth.stored);
}

watch(collapsed, restoreWidths);

// The panels' widths now, in pixels but the screen's: `[sidebar, screen, panel?]`. The rail's is not the sidebar's.
function onLayout(sizes: number[]) {
  const [sidebar, , panel] = sizes;
  if (sidebar !== undefined && !collapsed.value) {
    sidebarWidth.current = sidebar;
  }

  if (panel !== undefined) {
    panelWidth.current = panel;
  }
}
</script>

<template>
  <div
    :class="css.appShell"
    :style="{
      '--sidebar-width': `${sidebarWidth.current}px`,
      '--sidebar-rail-width': `${SIDEBAR_RAIL_WIDTH}px`,
      '--item-panel-width': `${panelWidth.current}px`,
    }"
  >
    <!-- Ids and orders keep the panels apart as the item panel comes and goes. -->
    <SplitterGroup
      direction="horizontal"
      :class="css.appShell_surfaces"
      @layout="onLayout"
    >
      <SplitterPanel
        id="app-sidebar"
        ref="sidebarPanel"
        :order="0"
        size-unit="px"
        :default-size="collapsed ? SIDEBAR_RAIL_WIDTH : sidebarWidth.stored"
        :min-size="collapsed ? SIDEBAR_RAIL_WIDTH : sidebarWidth.min"
        :max-size="collapsed ? SIDEBAR_RAIL_WIDTH : sidebarWidth.max"
        :style="collapsed ? undefined : sidebarWidth.style"
      >
        <Sidebar
          :viewer="viewer"
          :collapsed="collapsed"
          :window-controls="WINDOW_CONTROLS_OVERLAID"
          :counts="myWorkCounts"
          :tracked="tracked"
          :settings-sync-stopped="settingsSyncStopped"
          @toggle="toggle"
          @search="emit('search')"
          @sign-out="emit('signOut')"
        >
          <template
            v-if="$slots.trackedMenu"
            #trackedMenu="menu"
          >
            <slot
              name="trackedMenu"
              v-bind="menu"
            />
          </template>
        </Sidebar>
      </SplitterPanel>
      <ResizeHandle
        v-if="!collapsed"
        :label="t(l.resizeSidebar)"
        @resized="sidebarWidth.save()"
      />
      <SplitterPanel
        id="app-screen"
        as="main"
        :order="1"
        :min-size="SCREEN_MIN_SIZE"
        :class="css.appShell_screen"
      >
        <slot />
      </SplitterPanel>
      <template v-if="$slots.panel">
        <ResizeHandle
          :label="t(l.resizePanel)"
          @resized="panelWidth.save()"
        />
        <SplitterPanel
          id="app-panel"
          ref="itemPanel"
          :order="2"
          size-unit="px"
          :default-size="panelWidth.stored"
          :min-size="panelWidth.min"
          :max-size="panelWidth.max"
          :style="panelWidth.style"
          :class="css.appShell_panel"
          @vue:mounted="restoreWidths"
          @vue:unmounted="restoreWidths"
        >
          <slot name="panel" />
        </SplitterPanel>
      </template>
    </SplitterGroup>
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
  flex: 1;
  min-height: 0;
}

.appShell_panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid $color-border;
}

// As wide as the panel above it.
.appShell_itemSegment {
  display: flex;
  flex: none;
  width: var(--item-panel-width, $item-panel-width);
}

.appShell_screen {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
</style>
