<!-- `/download` (`DownloadScreen`), open to everyone: signing in from here goes through GitHub and home, and someone holding a session opens the app instead. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import { useSeoMeta } from 'nuxt/app';
import { computed } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import { HOME_PATH } from '@/auth/routeAccess.js';

import * as l from './DownloadScreen.loc.js';
import DownloadScreen from './DownloadScreen.vue';
import { useDesktopSystem } from './useDesktopSystem.js';

const auth = useContainer().resolve(AuthStore);
const t = useTranslate();
const system = useDesktopSystem();
const signedIn = computed(() => auth.signedIn);

useSeoMeta({
  title: () => t(l.pageTitle),
  description: () => t(l.pageDescription),
});
</script>

<template>
  <DownloadScreen
    :system="system"
    :signed-in="signedIn"
    @sign-in="auth.startSignIn(HOME_PATH)"
  />
</template>
