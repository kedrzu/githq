<!-- At the right end of the desktop app's status bar: what there is to say about updates (`AppUpdate.notice`). Ready (U1): "githq 1.4.0 is ready", a small "Restart" button and a plain "Later". Quiet and waiting: nothing restarts until the user clicks Restart. The outcome of a check the user asked for (U21, U22): checking, up to date, downloading, no release, or a failure with "Try again" and "Dismiss". The install (U40): "Installing githq 1.4.0…" offers nothing, so Restart can't be pressed twice; a failed install, amber, offers "Try again" and "Later". -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, CircleArrowDown, Info, LoaderCircle, TriangleAlert } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';

import type { UpdateNotice } from '@/services/AppUpdate.js';

import * as l from './UpdateSegment.loc.js';

/** How a notice is drawn. */
interface UpdateSegmentView {
  readonly icon: LucideIcon;
  readonly tone: 'accent' | 'dim' | 'muted' | 'warning';
  readonly text: string;
  /** The small button. */
  readonly action?: { readonly text: string; readonly run: () => void };
  /** The plain button beside it. */
  readonly secondary?: { readonly text: string; readonly run: () => void };
}

const props = defineProps<{
  notice: UpdateNotice;
}>();

const emit = defineEmits<{
  /** Restarts into the update, or tries installing it again. */
  restart: [];
  later: [];
  /** Tries a failed check again. */
  check: [];
  dismiss: [];
}>();

const t = useTranslate();
const view = computed(() => getView(props.notice));

function getView(notice: UpdateNotice): UpdateSegmentView {
  switch (notice.kind) {
    case 'checking':
      return { icon: LoaderCircle, tone: 'muted', text: t(l.checking) };
    case 'upToDate':
      return { icon: Check, tone: 'dim', text: t(l.upToDate, { version: notice.version }) };
    case 'downloading':
      return {
        icon: CircleArrowDown,
        tone: 'accent',
        text:
          notice.percent === null
            ? t(l.downloading, { version: notice.version })
            : t(l.downloadingPercent, { version: notice.version, percent: notice.percent }),
      };
    case 'ready':
      return {
        icon: CircleArrowDown,
        tone: 'accent',
        text: t(l.ready, { version: notice.version }),
        action: { text: t(l.restart), run: () => emit('restart') },
        secondary: { text: t(l.later), run: () => emit('later') },
      };
    case 'failed':
      return {
        icon: TriangleAlert,
        tone: 'warning',
        text: t(notice.reason === 'offline' ? l.failedOffline : l.failedUnreachable),
        action: { text: t(l.tryAgain), run: () => emit('check') },
        secondary: { text: t(l.dismiss), run: () => emit('dismiss') },
      };
    case 'noRelease':
      return { icon: Info, tone: 'muted', text: t(l.noRelease) };
    case 'installing':
      return { icon: LoaderCircle, tone: 'muted', text: t(l.installing, { version: notice.version }) };
    case 'installFailed':
      return {
        icon: TriangleAlert,
        tone: 'warning',
        text: t(l.installFailed, { version: notice.version }),
        action: { text: t(l.tryAgain), run: () => emit('restart') },
        secondary: { text: t(l.later), run: () => emit('later') },
      };
  }
}
</script>

<template>
  <div :class="css.updateSegment">
    <component
      :is="view.icon"
      :class="[css.updateSegment_icon, css[`updateSegment_icon_${view.tone}`]]"
      aria-hidden="true"
    />
    <span :class="css.updateSegment_text">{{ view.text }}</span>
    <button
      v-if="view.action"
      type="button"
      :class="[css.updateSegment_button, css.updateSegment_action]"
      @click="view.action.run()"
    >
      {{ view.action.text }}
    </button>
    <button
      v-if="view.secondary"
      type="button"
      :class="[css.updateSegment_button, css.updateSegment_secondary]"
      @click="view.secondary.run()"
    >
      {{ view.secondary.text }}
    </button>
  </div>
</template>

<style lang="scss" module="css">
.updateSegment {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding-right: $spacing-12;
  white-space: nowrap;
}

.updateSegment_icon {
  flex: none;
  width: 12px;
  height: 12px;
}

.updateSegment_icon_accent {
  color: $color-accent;
}

.updateSegment_icon_dim {
  color: $color-fg-dim;
}

.updateSegment_icon_muted {
  color: $color-fg-2;
}

.updateSegment_icon_warning {
  color: $color-amber;
}

.updateSegment_text {
  color: $color-fg-2;
}

.updateSegment_button {
  @include focus-ring;

  font: inherit;
  line-height: 14px;
  cursor: pointer;
  background: none;
  border: none;
}

.updateSegment_action {
  padding: 0 $spacing-6;
  font-weight: $font-weight-medium;
  color: $color-fg;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: 5px;

  &:hover {
    background: $color-border-2;
  }
}

.updateSegment_secondary {
  padding: 1px $spacing-4;
  color: $color-fg-dim;
  border-radius: 5px;

  &:hover {
    color: $color-fg-2;
  }
}
</style>
