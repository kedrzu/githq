<!-- At the right end of the desktop app's status bar (U1), once an update is downloaded: "githq 1.4.0 is ready", a small "Restart" button and a plain "Later". Quiet and waiting — nothing restarts until the user clicks Restart; Later hides it until the app next starts. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleArrowDown } from 'lucide-vue-next';

import * as l from './UpdateSegment.loc.js';

defineProps<{
  /** The version ready to run (`1.4.0`). */
  version: string;
}>();

const emit = defineEmits<{
  restart: [];
  later: [];
}>();

const t = useTranslate();
</script>

<template>
  <div :class="css.updateSegment">
    <CircleArrowDown
      :class="css.updateSegment_icon"
      aria-hidden="true"
    />
    <span :class="css.updateSegment_text">{{ t(l.ready, { version }) }}</span>
    <button
      type="button"
      :class="[css.updateSegment_button, css.updateSegment_restart]"
      @click="emit('restart')"
    >
      {{ t(l.restart) }}
    </button>
    <button
      type="button"
      :class="[css.updateSegment_button, css.updateSegment_later]"
      @click="emit('later')"
    >
      {{ t(l.later) }}
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
  color: $color-accent;
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

.updateSegment_restart {
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

.updateSegment_later {
  padding: 1px $spacing-4;
  color: $color-fg-dim;
  border-radius: 5px;

  &:hover {
    color: $color-fg-2;
  }
}
</style>
