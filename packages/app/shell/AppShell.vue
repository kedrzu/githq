<!-- The signed-in app's frame (D1 screen of Direction D): the sidebar (expanded or the rail, toggled also with `[`; a screen that forces the rail leaves what the user keeps as it is), the screen in the middle, an opened item's panel at the right — the expanded sidebar and the panel resized by dragging their edge — the panel as wide as the window allows, leaving the screen its minimum, and whether the window holds the panel at all, at its minimum beside the screen at its own (`panelFits`) — their widths remembered in this browser — and the status bar along the bottom with a segment under each — the allowance under the sidebar — or how far the download of everything tracked is —, how fresh the list is under the screen, how fresh the item is under its panel. In the macOS desktop app the rail is wider, to hold the window controls over the sidebar, except in full screen, where macOS hides them. -->
<script lang="ts" setup>
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next';
import { SplitterGroup, SplitterPanel } from 'reka-ui';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

import type { Viewer } from '@/auth/AuthStore.js';
import { APP_KEYS } from '@/commands/CommandRegistry.js';
import { useCommands } from '@/commands/useCommands.js';
import ResizeHandle from '@/components/ResizeHandle.vue';
import { usePanelWidth } from '@/components/usePanelWidth.js';
import { WindowControls } from '@/services/WindowControls.js';
import type { Freshness } from '@/sync/Freshness.js';
import type { SyncNotice } from '@/sync/SyncEngine.js';
import type { OverallDownload } from '@/tracking/DownloadProgress.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

import * as l from './AppShell.loc.js';
import FreshnessSegment from './FreshnessSegment.vue';
import type { SegmentEdits } from './SegmentEdits.js';
import Sidebar from './Sidebar.vue';
import type { SidebarTracked } from './Sidebar.vue';
import type { SidebarBrokenWorkflows, SidebarMyWorkCounts } from './SidebarTypes.js';
import StatusBar from './StatusBar.vue';

const props = defineProps<{
  viewer: Viewer;
  /** GitHub's GraphQL allowance, for the sidebar's segment of the status bar. */
  rateLimit: GitHubRateLimit | null;
  /** What holds the whole app back (offline, refresh paused), shown in the sidebar's segment instead. */
  notice: SyncNotice | null;
  /** When the app last refreshed from GitHub, for the explanation of a pause; `null` never. */
  lastRefreshedAt?: number | null;
  /** The download of everything tracked, said in the sidebar's segment while it lasts (first run and loading D4). */
  download?: OverallDownload | null;
  /** How fresh the screen's list is, for its segment. */
  freshness: Freshness;
  /** How fresh an item opened over the screen is (in the panel), for a segment of its own. */
  itemFreshness?: Freshness | null;
  /** The user's edits on their way or failed, said in the screen's segment instead of its freshness. */
  edits?: SegmentEdits | null;
  /** The same of the item opened over the screen, in its segment. */
  itemEdits?: SegmentEdits | null;
  /** The counts of "my work" for the sidebar, blank while still arriving; `null` before any group arrived. */
  myWorkCounts?: SidebarMyWorkCounts | null;
  /** The tracked projects and repositories for the sidebar. */
  tracked?: SidebarTracked;
  /** Syncing the settings stopped (settings-sync T9): an amber dot on the user's avatar. */
  settingsSyncStopped?: boolean;
  /** The sidebar's entry "Broken workflows" (actions W1); not drawn when `null`. */
  brokenWorkflows?: SidebarBrokenWorkflows | null;
  /** How many pull requests have the user's draft review, for the sidebar's entry. */
  draftReviews?: number;
  /** The screen wants the rail (a code review): shown as long as this is on, the remembered `collapsed` left as it is. */
  railForced?: boolean;
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

/** The sidebar collapsed to the rail, as the user keeps it. */
const collapsed = defineModel<boolean>('collapsed', { default: false });
/** Whether the rail shows: what the user keeps, unless the screen asks for it. */
const rail = computed(() => props.railForced || collapsed.value);
/**
 * Whether the window holds the item panel at its minimum beside the screen at its own, next to the sidebar as the user
 * keeps it: written by the shell as the window changes, read by whoever opens items.
 */
const panelFits = defineModel<boolean>('panelFits', { default: true });

const windowControls = useService(WindowControls);
/** `$sidebar-rail-width`, or room for macOS's window controls over it; the user does not resize the rail. */
const sidebarRailWidth = computed(() => (windowControls.overlaid ? 80 : 56));
/** What is left to the screen (the list), at least, in pixels: the item panel grows as wide as the window allows. */
const SCREEN_MIN_WIDTH = 400;

const t = useTranslate();
const sidebarWidth = usePanelWidth({ key: 'sidebar', default: 236, min: 180, max: 400 });
const panelWidth = usePanelWidth({ key: 'itemPanel', default: 560, min: 400 });
const surfaces = useTemplateRef<InstanceType<typeof SplitterGroup>>('surfaces');
const sidebarPanel = useTemplateRef<InstanceType<typeof SplitterPanel>>('sidebarPanel');
const itemPanel = useTemplateRef<InstanceType<typeof SplitterPanel>>('itemPanel');

/** The panels' width together, in pixels: the window's, as the screen's minimum is in percent of it. */
const surfacesWidth = ref(window.innerWidth);
const screenMinSize = computed(() => Math.min(100, (SCREEN_MIN_WIDTH / surfacesWidth.value) * 100));
// The room the window leaves the screen and the panel, from the sidebar's width the user chose, not the one it has while
// dragged: the panels would be laid out anew.
const besideSidebar = computed(() => surfacesWidth.value - (rail.value ? sidebarRailWidth.value : sidebarWidth.stored));
// The panel stops where the screen would get narrower than its minimum, so dragging it never squeezes the sidebar.
const panelMaxWidth = computed(() => Math.max(panelWidth.min, besideSidebar.value - SCREEN_MIN_WIDTH));

// Whether the panel fits at all: at its minimum, beside the screen at its own.
watch(
  () => besideSidebar.value >= SCREEN_MIN_WIDTH + panelWidth.min,
  fits => {
    panelFits.value = fits;
  },
  { immediate: true },
);

let observer: ResizeObserver | undefined;
onMounted(() => {
  const element = surfaces.value?.$el as HTMLElement | undefined;
  if (element) {
    observer = new ResizeObserver(([entry]) => {
      if (entry) {
        surfacesWidth.value = entry.contentRect.width;
      }
    });
    observer.observe(element);
  }
});
onBeforeUnmount(() => observer?.disconnect());

// `[` collapses or expands the sidebar, unless the key is being typed into something; a forced rail doesn't toggle.
useCommands(() => [
  {
    id: 'app.sidebar',
    title: collapsed.value ? t(l.expandSidebar) : t(l.collapseSidebar),
    section: 'app',
    key: APP_KEYS.sidebar,
    icon: collapsed.value ? PanelLeftOpen : PanelLeftClose,
    when: () => !props.railForced,
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
  if (!rail.value) {
    sidebarPanel.value?.resize(sidebarWidth.stored);
  }

  itemPanel.value?.resize(panelWidth.stored);
}

// A new minimum or maximum lays the panels out anew as well.
watch([rail, sidebarRailWidth, screenMinSize, panelMaxWidth], restoreWidths);

// The panels' widths now, in pixels but the screen's: `[sidebar, screen, panel?]`. The rail's is not the sidebar's.
function onLayout(sizes: number[]) {
  const [sidebar, , panel] = sizes;
  if (sidebar !== undefined && !rail.value) {
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
      '--sidebar-rail-width': `${sidebarRailWidth}px`,
      '--item-panel-width': `${panelWidth.current}px`,
    }"
  >
    <!-- Ids and orders keep the panels apart as the item panel comes and goes. -->
    <SplitterGroup
      ref="surfaces"
      direction="horizontal"
      :class="css.appShell_surfaces"
      @layout="onLayout"
    >
      <SplitterPanel
        id="app-sidebar"
        ref="sidebarPanel"
        :order="0"
        size-unit="px"
        :default-size="rail ? sidebarRailWidth : sidebarWidth.stored"
        :min-size="rail ? sidebarRailWidth : sidebarWidth.min"
        :max-size="rail ? sidebarRailWidth : sidebarWidth.max"
        :style="rail ? undefined : sidebarWidth.style"
      >
        <Sidebar
          :viewer="viewer"
          :collapsed="rail"
          :rail-forced="railForced"
          :window-controls="windowControls.overlaid"
          :counts="myWorkCounts"
          :tracked="tracked"
          :settings-sync-stopped="settingsSyncStopped"
          :broken-workflows="brokenWorkflows"
          :draft-reviews="draftReviews"
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
        v-if="!rail"
        :label="t(l.resizeSidebar)"
        @resized="sidebarWidth.save()"
      />
      <SplitterPanel
        id="app-screen"
        as="main"
        :order="1"
        :min-size="screenMinSize"
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
          as="aside"
          :aria-label="t(l.openedItem)"
          :order="2"
          size-unit="px"
          :default-size="panelWidth.stored"
          :min-size="panelWidth.min"
          :max-size="panelMaxWidth"
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
      :collapsed="rail"
      :last-refreshed-at="lastRefreshedAt"
      :download="download"
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
