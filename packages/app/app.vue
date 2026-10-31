<script lang="ts" setup>
import { NuxtLayout, NuxtPage } from '#components';
import { ConfigProvider } from 'reka-ui';

import './styles/main.scss';
</script>

<template>
  <ConfigProvider dir="ltr">
    <!-- The app's screens sit in the shell (`layouts/shell.vue`, `meta.layout`); the landing page and the first sign-in have none. -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </ConfigProvider>
</template>
