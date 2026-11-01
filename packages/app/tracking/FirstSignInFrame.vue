<!-- The frame of the first sign-in's steps (G2, G6), outside the app's shell: githq's name, where the user is among "Sign in → Choose what to track → First download", and who is signed in; the step's screen below. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import type { Viewer } from '@/auth/AuthStore.js';
import Avatar from '@/components/Avatar.vue';
import Stepper from '@/components/Stepper.vue';
import Wordmark from '@/components/Wordmark.vue';
import { WINDOW_CONTROLS_OVERLAID, WINDOW_DRAG_REGION } from '@/shell/windowControls.js';

import * as l from './FirstSignInFrame.loc.js';

const props = defineProps<{
  viewer: Viewer;
  step: 'choose' | 'download';
}>();

defineSlots<{
  /** The step's screen; it scrolls under the top bar. */
  default(): unknown;
}>();

const t = useTranslate();

const steps = computed(() => [t(l.signIn), t(l.chooseWhatToTrack), t(l.firstDownload)]);
const current = computed(() => (props.step === 'choose' ? 1 : 2));
</script>

<template>
  <div :class="css.firstSignInFrame">
    <header
      :class="css.firstSignInFrame_top"
      v-bind="WINDOW_DRAG_REGION"
    >
      <Wordmark :class="WINDOW_CONTROLS_OVERLAID && css.firstSignInFrame_name_clearOfControls" />
      <Stepper
        :steps="steps"
        :current="current"
        :label="t(l.steps)"
      />
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
  display: grid;
  flex: none;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 56px;
  padding: 0 $spacing-24;
  border-bottom: 1px solid $color-border;
}

// Past macOS's window controls, with the stepper still in the middle.
.firstSignInFrame_name_clearOfControls {
  margin-left: 56px;
}

.firstSignInFrame_account {
  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
  justify-self: end;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.firstSignInFrame_body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
