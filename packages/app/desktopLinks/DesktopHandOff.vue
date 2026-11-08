<!-- Hands the page's first address to the desktop app when this browser opted in (web only, mounted by the shell): the decision is `DesktopHandOff`'s, this shows the screen it leaves over the shell while the link opens. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';

import { DesktopHandOff } from './DesktopHandOff.js';
import DesktopHandOffView from './DesktopHandOffView.vue';

const handOff = useService(DesktopHandOff);

handOff.handOffIfDue();
</script>

<template>
  <DesktopHandOffView
    v-if="handOff.shown"
    @open-here="handOff.stayHere()"
    @turn-off="handOff.turnOff()"
  />
</template>
