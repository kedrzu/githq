<!-- The status bar along the window's bottom (D15): one segment per surface, each as wide as the surface above it. The sidebar's segment holds the API allowance — in full, or short under the rail — or, in amber, what holds the whole app back: being offline, or refresh paused until the allowance resets (K3), when it is a button opening why — reading and editing still work, only other people's changes wait — with the allowance, when refresh resumes and when it last refreshed. The rest of the segments come from the default slot (`StatusSegment`). In the desktop app, an update ready to run is offered at the bar's right end (`desktop/UpdateSegment.vue`, U1); the web builds drop it. -->
<script lang="ts" setup>
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { Pause, WifiOff } from 'lucide-vue-next';
import { computed, defineAsyncComponent, shallowRef, watch } from 'vue';

import Popover from '@/components/Popover.vue';
import Tooltip from '@/components/Tooltip.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { AppUpdate } from '@/services/AppUpdate.js';
import { useNow } from '@/services/useNow.js';
import type { SyncNotice } from '@/sync/SyncEngine.js';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';
import { formatTime } from '@/utils/formatTime.js';

import * as l from './StatusBar.loc.js';
import StatusSegment from './StatusSegment.vue';

const props = defineProps<{
  /** GitHub's GraphQL allowance from its last answer; nothing is shown before the first one. */
  rateLimit: GitHubRateLimit | null;
  /** What holds the whole app back, shown instead of the allowance. */
  notice?: SyncNotice | null;
  /** The sidebar is collapsed to the rail: its segment is as narrow and says less. */
  collapsed?: boolean;
  /** When the app last refreshed from GitHub (epoch ms), for the explanation of a pause; `null` never. */
  lastRefreshedAt?: number | null;
}>();

defineSlots<{
  /** The segments of the surfaces right of the sidebar. */
  default?(): unknown;
}>();

/** How often "in 18 min" moves on while the explanation is open. */
const TICK_MS = 15_000;
const MINUTE = 60_000;

// The desktop app's update notice, in the desktop build only (`__DESKTOP__`); the web builds drop it.
const UpdateSegment = __DESKTOP__ ? defineAsyncComponent(() => import('@/desktop/UpdateSegment.vue')) : null;
const update = __DESKTOP__ ? useService(AppUpdate) : null;

const t = useTranslate();
const explained = shallowRef(false);
const now = useNow(TICK_MS, explained);
const minutes = new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'minute', unitDisplay: 'short' });
const fullNumber = new Intl.NumberFormat(APP_LANGUAGE);
const shortNumber = new Intl.NumberFormat(APP_LANGUAGE, { notation: 'compact', maximumFractionDigits: 1 });

const fullText = computed(() => {
  const { notice, rateLimit } = props;
  if (notice?.kind === 'offline') {
    return t(l.offlineSince, { time: formatTime(notice.since) });
  }

  if (notice?.kind === 'paused') {
    const time = formatTime(notice.until);
    return notice.allowance === null
      ? t(l.pausedUntil, { time })
      : t(l.pausedUntilLeft, { time, remaining: fullNumber.format(notice.allowance.remaining) });
  }

  return rateLimit
    ? t(l.allowance, { remaining: fullNumber.format(rateLimit.remaining), limit: fullNumber.format(rateLimit.limit) })
    : '';
});
const icon = computed(() => {
  switch (props.notice?.kind) {
    case 'offline':
      return WifiOff;
    case 'paused':
      return Pause;
    default:
      return null;
  }
});
const paused = computed(() => (props.notice?.kind === 'paused' ? props.notice : null));

// The explanation of the pause (K3), from the moment it opens.
const explanation = computed(() => {
  const pause = paused.value;
  if (!pause) {
    return null;
  }

  const time = formatTime(pause.until);
  const duration = minutes.format(Math.max(1, Math.ceil((pause.until - now.value) / MINUTE)));
  const { allowance } = pause;
  // The search allowance goes by the minute, the others by the hour.
  const perMinute = allowance?.resource === 'search';
  const { lastRefreshedAt } = props;
  return {
    text: t(getExplanation(allowance), { time, duration }),
    allowance:
      allowance &&
      t(perMinute ? l.allowanceThisMinute : l.allowanceThisHour, {
        remaining: fullNumber.format(allowance.remaining),
        limit: fullNumber.format(allowance.limit),
      }),
    resumes: t(l.atIn, { time, duration }),
    lastRefreshed:
      lastRefreshedAt == null
        ? t(l.never)
        : t(l.atAgo, { time: formatTime(lastRefreshedAt), age: formatCheckedAge(lastRefreshedAt, now.value) }),
  };
});

function getExplanation(allowance: GitHubRateLimit | null) {
  if (allowance === null) {
    return l.slowDownExplained;
  }

  if (allowance.resource === 'search') {
    return l.searchExplained;
  }

  // githq keeps some for the user's edits (`EDIT_RESERVE`); nothing left, other apps used it too.
  return allowance.remaining === 0 ? l.exhaustedExplained : l.pausedExplained;
}

// Refresh resumed: nothing is left to explain.
watch(paused, pause => {
  if (!pause) {
    explained.value = false;
  }
});
// Under the rail only the short form fits — "4.8k", or a notice's icon alone; the whole sentence is its tooltip.
const text = computed(() => {
  if (!props.collapsed) {
    return fullText.value;
  }

  return !props.notice && props.rateLimit ? shortNumber.format(props.rateLimit.remaining).toLowerCase() : '';
});
</script>

<template>
  <footer
    :class="css.statusBar"
    :aria-label="t(l.status)"
  >
    <!-- Paused (K3): a button opening why, in full or under the rail. -->
    <Popover
      v-if="explanation"
      v-model:open="explained"
      :label="t(l.pausedTitle)"
      side="top"
    >
      <template #trigger>
        <StatusSegment
          :icon="Pause"
          tone="warning"
          action
          :class="[css.statusBar_sidebar, collapsed && css.statusBar_sidebar_collapsed]"
          :aria-label="collapsed ? fullText : undefined"
        >
          <!-- Under the rail, the icon alone. -->
          <template
            v-if="text"
            #default
            >{{ text }}</template
          >
        </StatusSegment>
      </template>
      <div
        :class="css.statusBar_explanation"
        tid="refresh-paused"
      >
        <h2 :class="css.statusBar_explanationTitle">
          <Pause
            :class="css.statusBar_icon"
            aria-hidden="true"
          />
          {{ t(l.pausedTitle) }}
        </h2>
        <p :class="css.statusBar_explanationText">{{ explanation.text }}</p>
        <dl :class="css.statusBar_facts">
          <template v-if="explanation.allowance">
            <dt>{{ t(l.allowanceLabel) }}</dt>
            <dd :class="css.statusBar_warning">{{ explanation.allowance }}</dd>
          </template>
          <dt>{{ t(l.resumesLabel) }}</dt>
          <dd>{{ explanation.resumes }}</dd>
          <dt>{{ t(l.lastRefreshedLabel) }}</dt>
          <dd>{{ explanation.lastRefreshed }}</dd>
        </dl>
      </div>
    </Popover>
    <!-- Under the rail the whole sentence is the segment's tooltip. -->
    <Tooltip
      v-else
      :text="fullText"
      side="top"
      :disabled="!collapsed || !fullText"
    >
      <div
        :class="[
          css.statusBar_sidebar,
          collapsed && css.statusBar_sidebar_collapsed,
          notice && css.statusBar_sidebar_warning,
        ]"
      >
        <component
          :is="icon"
          v-if="icon"
          :class="css.statusBar_icon"
          aria-hidden="true"
        />
        <span
          v-if="text"
          :class="css.statusBar_text"
          >{{ text }}</span
        >
        <!-- A notice under the rail is its icon alone; screen readers get the sentence. -->
        <span
          v-else-if="icon"
          :class="css.statusBar_hidden"
          >{{ fullText }}</span
        >
      </div>
    </Tooltip>
    <slot />
    <component
      :is="UpdateSegment"
      v-if="UpdateSegment && update?.readyVersion"
      :version="update.readyVersion"
      @restart="update.restart()"
      @later="update.later()"
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

.statusBar_sidebar {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  width: var(--sidebar-width, $sidebar-width);
  padding: 0 $spacing-12;
  overflow: hidden;
  white-space: nowrap;
}

.statusBar_sidebar_collapsed {
  justify-content: center;
  width: var(--sidebar-rail-width, $sidebar-rail-width);
  padding: 0;
}

.statusBar_sidebar_warning {
  color: $color-amber;
  background: rgba($color-amber, 0.08);
}

.statusBar_explanation {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  width: 320px;
  padding: $spacing-6;
}

.statusBar_explanationTitle {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;

  .statusBar_icon {
    color: $color-amber;
  }
}

.statusBar_explanationText {
  font-size: $font-size-sm;
  line-height: 19px;
  color: $color-fg-2;
}

.statusBar_facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: $spacing-8 $spacing-16;
  padding-top: $spacing-10;
  margin: 0;
  font-size: $font-size-sm;
  border-top: 1px solid $color-border;

  dt {
    color: $color-fg-dim;
  }

  dd {
    margin: 0;
  }
}

.statusBar_warning {
  color: $color-amber;
}

.statusBar_icon {
  flex: none;
  width: 12px;
  height: 12px;
}

.statusBar_hidden {
  @include visually-hidden;
}

.statusBar_text {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
