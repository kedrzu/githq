<!-- A screen of Settings on a phone (mobile D33, MB146–MB161): the phone's top bar — back naming where it returns ("‹ Settings", "‹ Repositories", "‹ My work") when there is somewhere to go back to (`back`), else the places button — with the screen's title and its actions at the right ("+"), then its content in one column, which is the screen's scroll (ending with room for the command line, `AppShell`). No key hints are drawn in it (mobile D52). -->
<script lang="ts" setup>
import { provideContext } from '@nzyme/vue-utils/context.js';

import { KeyHintsContext } from '@/components/KeyHintsContext.js';
import PhoneBackButton from '@/shell/PhoneBackButton.vue';
import PhoneTopBar from '@/shell/PhoneTopBar.vue';

defineProps<{
  title: string;
  /** There is somewhere to go back to: back in place of the places button. */
  back?: boolean;
  /** Where back returns to ("Settings"); "Back" alone without one. */
  backPlace?: string | null;
  /** What the screen's scroll is kept as (`shell/routeScroll.ts`). */
  scrollKey: string;
}>();

const emit = defineEmits<{
  back: [];
}>();

defineSlots<{
  default(): unknown;
  /** The top bar's buttons at the right (`IconButton`s). */
  actions?(): unknown;
}>();

provideContext(KeyHintsContext, { hidden: true });
</script>

<template>
  <div :class="css.phoneSettingsScreen">
    <PhoneTopBar :title="title">
      <template
        v-if="back"
        #start
      >
        <PhoneBackButton
          :place="backPlace"
          @click="emit('back')"
        />
      </template>
      <template
        v-if="$slots.actions"
        #actions
      >
        <slot name="actions" />
      </template>
    </PhoneTopBar>
    <div
      :class="css.phoneSettingsScreen_body"
      :data-route-scroll="scrollKey"
    >
      <slot />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.phoneSettingsScreen {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.phoneSettingsScreen_body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}
</style>
