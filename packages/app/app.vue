<script lang="ts" setup>
import { NuxtLayout, NuxtPage } from '#components';
import { useHead, useNuxtApp } from 'nuxt/app';
import { ConfigProvider } from 'reka-ui';
import { defineAsyncComponent, shallowRef } from 'vue';

import { isApplePlatform } from '@/utils/isApplePlatform.js';

import './styles/main.scss';

// The app's title, as in `app.head` (`nuxt.config.ts`), which the browser only gets from a SPA page: hydrating the
// prerendered landing page, the landing page's title would otherwise stay once a signed-in user moves on.
useHead({ title: 'githq' });

// The desktop app on a Mac draws its own swipe through the history; the browsers, and the web builds, have theirs.
const HistorySwipe =
  __DESKTOP__ && isApplePlatform() ? defineAsyncComponent(() => import('@/desktop/HistorySwipe.vue')) : null;

// The desktop app follows the githq links opened in it (`desktop/OpenedLinks.vue`), on every platform: once the first
// screen is up, as a navigation finishing during the first one's guard would fail that one's redirect.
const OpenedLinks = __DESKTOP__
  ? defineAsyncComponent({ loader: () => import('@/desktop/OpenedLinks.vue'), suspensible: false })
  : null;
const firstScreenUp = shallowRef(false);
if (__DESKTOP__) {
  useNuxtApp().hooks.hookOnce('app:suspense:resolve', () => {
    firstScreenUp.value = true;
  });
}
</script>

<template>
  <ConfigProvider dir="ltr">
    <!-- The app's screens sit in the shell (`layouts/shell.vue`, `meta.layout`); the landing page and the first sign-in have none. -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <component
      :is="HistorySwipe"
      v-if="HistorySwipe"
    />
    <component
      :is="OpenedLinks"
      v-if="OpenedLinks && firstScreenUp"
    />
  </ConfigProvider>
</template>
