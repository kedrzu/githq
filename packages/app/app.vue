<script lang="ts" setup>
import { NuxtLayout, NuxtPage } from '#components';
import { ConfigProvider } from 'reka-ui';

import './styles/main.scss';
</script>

<template>
  <ConfigProvider dir="ltr">
    <!-- The app's screens sit in the shell (`layouts/shell.vue`, `meta.layout`); sign-in has none. -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </ConfigProvider>
</template>
