<script lang="ts" setup>
import { NuxtLayout, NuxtPage } from '#components';
import { useHead } from 'nuxt/app';
import { ConfigProvider } from 'reka-ui';

import './styles/main.scss';

// The app's title, as in `app.head` (`nuxt.config.ts`), which the browser only gets from a SPA page: hydrating the
// prerendered landing page, the landing page's title would otherwise stay once a signed-in user moves on.
useHead({ title: 'githq' });
</script>

<template>
  <ConfigProvider dir="ltr">
    <!-- The app's screens sit in the shell (`layouts/shell.vue`, `meta.layout`); the landing page and the first sign-in have none. -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </ConfigProvider>
</template>
