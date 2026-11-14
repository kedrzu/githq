<!-- The status bar along the window's bottom (D15): one segment per surface, each as wide as the surface above it. The sidebar's segment (`SyncSegment`) holds the API allowance, or in amber what holds the whole app back (offline, refresh paused — then a button opening why), or how far the download of everything tracked is. The rest of the segments come from the default slot (`StatusSegment`). In the desktop app, what there is to say about updates is said at the bar's right end (`desktop/UpdateSegment.vue`, U22, U40, U50, U51); the web builds drop it. -->
<script lang="ts" setup>
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { defineAsyncComponent } from 'vue';

import { AppUpdate } from '@/services/AppUpdate.js';
import type { SyncNotice } from '@/sync/SyncEngine.js';
import type { OverallDownload } from '@/tracking/DownloadProgress.js';

import * as l from './StatusBar.loc.js';
import SyncSegment from './SyncSegment.vue';

defineProps<{
  /** GitHub's GraphQL allowance from its last answer; nothing is shown before the first one. */
  rateLimit: GitHubRateLimit | null;
  /** What holds the whole app back, shown instead of the allowance. */
  notice?: SyncNotice | null;
  /** The sidebar is collapsed to the rail: its segment is as narrow and says less. */
  collapsed?: boolean;
  /** When the app last refreshed from GitHub (epoch ms), for the explanation of a pause; `null` never. */
  lastRefreshedAt?: number | null;
  /** The download of everything tracked, shown instead of the allowance while it lasts; nothing being offline or paused. */
  download?: OverallDownload | null;
}>();

defineSlots<{
  /** The segments of the surfaces right of the sidebar. */
  default?(): unknown;
}>();

// The desktop app's update segment, in the desktop build only (`__DESKTOP__`); the web builds drop it.
const UpdateSegment = __DESKTOP__ ? defineAsyncComponent(() => import('@/desktop/UpdateSegment.vue')) : null;
const update = __DESKTOP__ ? useService(AppUpdate) : null;

const t = useTranslate();
</script>

<template>
  <footer
    :class="css.statusBar"
    :aria-label="t(l.status)"
  >
    <SyncSegment
      :rate-limit="rateLimit"
      :notice="notice"
      :collapsed="collapsed"
      :last-refreshed-at="lastRefreshedAt"
      :download="download"
    />
    <slot />
    <component
      :is="UpdateSegment"
      v-if="UpdateSegment && update?.notice"
      :notice="update.notice"
      @restart="update.restart()"
      @check="update.check()"
      @dismiss="update.dismiss()"
    />
  </footer>
</template>

<style lang="scss" module="css">
.statusBar {
  display: flex;
  flex: none;
  height: $status-bar-height;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  background: $color-bg-2;
  border-top: 1px solid $color-border;
}
</style>
