<!-- Home: `/` and "my work" narrowed to a group (`meta.auth: 'home'`, one page instance for all). "My work" in the shell for a signed-in user, the landing page for a signed-out visitor. Which one follows the layout the route guard gave the route (`middleware/auth.global.ts`) — the shell only once it let a signed-in user in — so "my work" never shows outside the shell, and the landing page stays until the guard has sent a freshly signed-in user on. The server renders the landing page, and hydrating it this renders the landing page too, switching once mounted. The desktop app has no landing page (D21): signed out, it shows its own sign-in (`desktop/DesktopSignInPage.vue`) here. -->
<script lang="ts" setup>
import { useNuxtApp } from 'nuxt/app';
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { readSignInFailure } from '@/auth/routeAccess.js';
import { isHydratingServerHtml } from '@/utils/isHydratingServerHtml.js';

// Each page is a chunk of its own, loaded only when shown: the prerendered landing page preloads the chunks its
// server render used — the landing page's, never "my work"'s —, and the shell imports "my work"'s alone.
const LandingPage = defineAsyncComponent(() => import('@/landing/LandingPage.vue'));
// Not suspensible: on the app's first render Nuxt's root `Suspense` would hold the whole app, the shell included,
// outside the document until the chunk came, and the shell's splitter, set up on mount, finds its panels in the
// document — its edges would not resize. The shell mounts at once; "my work" follows into it.
const MyWorkPage = defineAsyncComponent({ loader: () => import('@/myWork/MyWorkPage.vue'), suspensible: false });
// In the desktop build only (`__DESKTOP__`); the web builds drop it with the native side.
const DesktopSignInPage = __DESKTOP__ ? defineAsyncComponent(() => import('@/desktop/DesktopSignInPage.vue')) : null;

const route = useRoute();
const hydrating = ref(import.meta.server || isHydratingServerHtml(useNuxtApp()));
const showMyWork = computed(() => !hydrating.value && route.meta.layout === 'shell');

onMounted(() => {
  hydrating.value = false;
});
</script>

<template>
  <MyWorkPage v-if="showMyWork" />
  <component
    :is="DesktopSignInPage"
    v-else-if="DesktopSignInPage"
    :signed-out="readSignInFailure(route.query.failed) === 'tokenRejected'"
  />
  <LandingPage v-else />
</template>
