<!-- The frame of the first sign-in's screen — choosing what to track (G2), or loading the settings saved to GitHub instead (settings-sync G11) — outside the app's shell: along the top the window's strip, as tall as the sidebar's, with githq's name at the left (clear of macOS's window controls in the desktop app, where the strip moves the window) and who is signed in at the right; the screen below. On a phone (mobile D7, MB134–MB138, `Phone / Setup bar`) the strip is the phone's setup bar — the wordmark, and the user's login before their avatar — and the frame covers what the on-screen keyboard leaves of the window (`useVisualViewport`), so what the screen pins to its bottom rides above the keyboard while typing (MB163); no key hints are drawn in it (`KeyHintsContext`). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { computed } from 'vue';

import type { Viewer } from '@/auth/AuthStore.js';
import Avatar from '@/components/Avatar.vue';
import { KeyHintsContext } from '@/components/KeyHintsContext.js';
import Wordmark from '@/components/Wordmark.vue';
import { WindowControls } from '@/services/WindowControls.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { useVisualViewport } from '@/shell/useVisualViewport.js';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';

defineProps<{
  viewer: Viewer;
}>();

defineSlots<{
  /** The screen; it scrolls under the top bar. */
  default(): unknown;
}>();

const windowControls = useService(WindowControls);
const phone = useService(PhoneLayout);
const viewport = useVisualViewport();
// A phone's setup has no keys to hint at (mobile D52): its buttons' and its fields'.
provideContext(KeyHintsContext, {
  get hidden() {
    return phone.active;
  },
});

/** On a phone, the frame over what the keyboard leaves of the window: its bottom on the keyboard's top. */
const phoneStyle = computed(() =>
  phone.active ? { bottom: `${viewport.bottomInset}px`, height: `${viewport.height}px` } : undefined,
);
</script>

<template>
  <div
    :class="[css.firstSignInFrame, phone.active && css.firstSignInFrame_phone]"
    :style="phoneStyle"
  >
    <header
      :class="css.firstSignInFrame_top"
      v-bind="WINDOW_DRAG_REGION"
    >
      <Wordmark :class="windowControls.overlaid && css.firstSignInFrame_name_clearOfControls" />
      <span :class="css.firstSignInFrame_account">
        <Avatar
          :name="viewer.login"
          :src="viewer.avatarUrl"
          decorative
        />
        {{ viewer.login }}
      </span>
    </header>
    <main :class="css.firstSignInFrame_body">
      <slot />
    </main>
  </div>
</template>

<style lang="scss" module="css">
.firstSignInFrame {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $color-bg;
}

.firstSignInFrame_top {
  display: flex;
  flex: none;
  gap: $spacing-12;
  align-items: center;
  justify-content: space-between;
  height: $window-controls-height;
  padding: 0 $spacing-20;
}

// Past macOS's window controls: the design's three 12px buttons 8px apart, 8px after them, and the strip's gap.
.firstSignInFrame_name_clearOfControls {
  margin-left: 64px;
}

.firstSignInFrame_account {
  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.firstSignInFrame_body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

// Pinned over the part of the window the user sees, which the keyboard shrinks while the window stays.
.firstSignInFrame_phone {
  position: fixed;
  right: 0;
  left: 0;
  padding-top: env(safe-area-inset-top, 0px);

  .firstSignInFrame_top {
    height: $phone-top-bar-height;
    padding: 0 $spacing-16;
    border-bottom: 1px solid $color-border;
  }

  .firstSignInFrame_account {
    flex-direction: row-reverse;
    font-size: $font-size-md;
  }
}
</style>
