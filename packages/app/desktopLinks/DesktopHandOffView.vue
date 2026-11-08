<!-- The screen over the shell when a githq link was handed to the desktop app (web only): "Opened in the githq desktop app", with "Open here instead" to stay in the browser and "Don't open links in the app" to turn the opt-in off. It covers the window; focus is held inside it, on the first action. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { FocusScope } from 'reka-ui';

import Button from '@/components/Button.vue';
import Wordmark from '@/components/Wordmark.vue';

import * as l from './DesktopHandOffView.loc.js';

const emit = defineEmits<{
  /** The user wants this tab to stay on githq. */
  openHere: [];
  /** The user does not want links opened in the app. */
  turnOff: [];
}>();

const t = useTranslate();
</script>

<template>
  <FocusScope
    as="div"
    loop
    trapped
    :class="css.desktopHandOffView"
    role="dialog"
    aria-modal="true"
    aria-labelledby="desktop-hand-off-title"
    tid="desktop-hand-off"
  >
    <Wordmark :class="css.desktopHandOffView_name" />
    <h1
      id="desktop-hand-off-title"
      :class="css.desktopHandOffView_title"
    >
      {{ t(l.title) }}
    </h1>
    <p :class="css.desktopHandOffView_detail">{{ t(l.detail) }}</p>
    <div :class="css.desktopHandOffView_actions">
      <Button
        variant="primary"
        size="lg"
        @click="emit('openHere')"
      >
        {{ t(l.openHere) }}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        @click="emit('turnOff')"
      >
        {{ t(l.turnOff) }}
      </Button>
    </div>
  </FocusScope>
</template>

<style lang="scss" module="css">
.desktopHandOffView {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
  align-items: center;
  justify-content: center;
  padding: $spacing-24;
  text-align: center;
  background: $color-bg;
}

.desktopHandOffView_name {
  --wordmark-size: 22px;

  margin-bottom: $spacing-16;
}

.desktopHandOffView_title {
  font-size: 20px;
  font-weight: $font-weight-semibold;
}

.desktopHandOffView_detail {
  max-width: 420px;
  font-size: $font-size-md;
  line-height: 20px;
  color: $color-fg-2;
}

.desktopHandOffView_actions {
  display: flex;
  gap: $spacing-12;
  margin-top: $spacing-8;
}
</style>
