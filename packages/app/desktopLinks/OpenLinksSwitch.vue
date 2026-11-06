<!-- The Settings switch "Open links in the desktop app" (web only), in the Account section's "This browser": whether githq links open in the desktop app, kept by this browser alone (`LocalPreferences`), with a line saying so and that the app must be installed. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useId } from 'vue';

import Switch from '@/components/Switch.vue';

import * as l from './OpenLinksSwitch.loc.js';

const model = defineModel<boolean>({ required: true });

const t = useTranslate();
const id = useId();
</script>

<template>
  <div :class="css.openLinksSwitch">
    <div :class="css.openLinksSwitch_text">
      <h3 :class="css.openLinksSwitch_title">{{ t(l.title) }}</h3>
      <p
        :id="`${id}-description`"
        :class="css.openLinksSwitch_description"
      >
        {{ t(l.description) }}
      </p>
    </div>
    <Switch
      v-model="model"
      :label="t(l.title)"
      :aria-describedby="`${id}-description`"
    />
  </div>
</template>

<style lang="scss" module="css">
.openLinksSwitch {
  display: flex;
  gap: $spacing-16;
  align-items: center;
  padding: $spacing-12 14px;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}

.openLinksSwitch_text {
  flex: 1;
  min-width: 0;
}

.openLinksSwitch_title {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
}

.openLinksSwitch_description {
  margin-top: $spacing-2;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}
</style>
