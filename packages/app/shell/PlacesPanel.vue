<!-- The phone's places (mobile D19): the sidebar's places (`Sidebar` as a phone's) — a tracked repository or project tapped shows its sections or saved views under it, the panel staying open, the place the user is in shown so to begin with — in a panel from the left over the dimmed screen, where the user is marked and focused; at its foot how fresh the screen is and the status bar's left segment — the allowance, the download, offline or paused (mobile D12, D31) — and the user, whose tile opens the account menu (mobile D32). A tap outside, Escape or the panel's button closes it, and so does going anywhere — a link tapped, one of those rows too. It is no address of its own and takes no step in history. -->
<script lang="ts" setup>
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useTemplateRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import type { Viewer } from '@/auth/AuthStore.js';
import Dialog from '@/components/Dialog.vue';
import type { Freshness } from '@/sync/Freshness.js';
import type { SyncNotice } from '@/sync/SyncEngine.js';
import type { OverallDownload } from '@/tracking/DownloadProgress.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

import FreshnessSegment from './FreshnessSegment.vue';
import * as l from './PlacesPanel.loc.js';
import type { SegmentEdits } from './SegmentEdits.js';
import Sidebar from './Sidebar.vue';
import type { SidebarTracked } from './Sidebar.vue';
import type { SidebarMyWorkCounts, SidebarSubEntry } from './SidebarTypes.js';
import SyncSegment from './SyncSegment.vue';

defineProps<{
  viewer: Viewer;
  /** The counts of "my work", blank while still arriving; `null` before any group arrived. */
  counts?: SidebarMyWorkCounts | null;
  /** The tracked projects and repositories. */
  tracked?: SidebarTracked;
  /** The rows under a tracked project or repository, shown once it is tapped open (`Sidebar`). */
  getChildren?: (target: TrackedTarget) => readonly SidebarSubEntry[];
  /** Those rows slide open and closed. */
  animate?: boolean;
  /** Syncing the settings stopped: an amber dot on the user's avatar. */
  settingsSyncStopped?: boolean;
  /** How fresh the screen is. */
  freshness: Freshness;
  /** The user's edits on their way or failed, said instead of the screen's freshness. */
  edits?: SegmentEdits | null;
  /** GitHub's GraphQL allowance. */
  rateLimit: GitHubRateLimit | null;
  /** What holds the whole app back (offline, refresh paused), said instead of the allowance. */
  notice?: SyncNotice | null;
  /** When the app last refreshed from GitHub, for the explanation of a pause; `null` never. */
  lastRefreshedAt?: number | null;
  /** The download of everything tracked, said instead of the allowance while it lasts. */
  download?: OverallDownload | null;
}>();

const emit = defineEmits<{
  signOut: [];
  /** A failed edit at the foot was clicked: its message again. */
  showFailure: [];
}>();

const open = defineModel<boolean>('open', { default: false });

/** In pixels; a narrower window leaves the dimmed screen in sight beside it all the same (`Dialog`'s `edge`). */
const WIDTH = 320;

const t = useTranslate();
const route = useRoute();
const contentRef = useTemplateRef<HTMLElement>('content');

// Going anywhere — a place chosen, Settings from the account menu — closes it; choosing where the user already is too.
// A tracked place with rows is a button showing them, not a link: tapping it leaves the panel open.
watch(
  () => route.fullPath,
  () => {
    open.value = false;
  },
);

function closeOnLink(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('a[href]')) {
    open.value = false;
  }
}

// Opened on where the user is, focused, the list scrolled to it.
function focusCurrent(event: Event) {
  const current = contentRef.value?.querySelector<HTMLElement>('[aria-current="page"]');
  if (current) {
    event.preventDefault();
    current.focus();
  }
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="t(l.places)"
    :width="WIDTH"
    edge="left"
    bare
    @open-auto-focus="focusCurrent"
  >
    <div
      ref="content"
      :class="css.placesPanel"
      @click="closeOnLink"
    >
      <Sidebar
        :viewer="viewer"
        :counts="counts"
        :tracked="tracked"
        :get-children="getChildren"
        :animate="animate"
        :settings-sync-stopped="settingsSyncStopped"
        phone
        @toggle="open = false"
        @sign-out="emit('signOut')"
      >
        <template #status>
          <FreshnessSegment
            :freshness="freshness"
            :edits="edits"
            @show-failure="emit('showFailure')"
          />
          <SyncSegment
            placement="inline"
            :rate-limit="rateLimit"
            :notice="notice"
            :last-refreshed-at="lastRefreshedAt"
            :download="download"
          />
        </template>
      </Sidebar>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
.placesPanel {
  display: flex;
  flex: 1;
  min-height: 0;
}
</style>
