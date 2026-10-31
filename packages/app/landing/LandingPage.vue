<!-- The landing page (`LandingScreen`) at `/` for a signed-out visitor: "Sign in with GitHub" goes straight to GitHub, then on to `next` (or GitHub's `return_to`, see `readSignInReturnPath`); after a failure (`failed`, see `readSignInFailure`) the banner says what went wrong. Under `nuxt dev` and in the local build also the sign-in with a pasted token. The server renders it too (prerendered `/`, `_landing.html`), with the title, description, canonical address and share tags of githq.dev: nothing here touches the session until the browser has it — `AuthStore` is resolved on a click, and the banner and the development sign-in appear once mounted, so hydration matches the server's HTML. -->
<script lang="ts" setup>
import { omitProps } from '@nzyme/utils/omitProps.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import { useHead, useSeoMeta } from 'nuxt/app';
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { readSignInFailure, readSignInReturnPath } from '@/auth/routeAccess.js';

import * as l from './LandingPage.loc.js';
import LandingScreen from './LandingScreen.vue';
import SignInBanner from './SignInBanner.vue';

// The development sign-in exists under `nuxt dev` and in the local build (`__LOCAL_BUILD__`) only. The
// production build replaces both with `false`, which drops this import and the form's whole chunk —
// `scripts/checkProductionBuild.ts` checks the built files for it after every production build.
const DevTokenForm =
  import.meta.dev || __LOCAL_BUILD__ ? defineAsyncComponent(() => import('@/auth/DevTokenForm.vue')) : null;

// What search engines and link previews read from the prerendered page; the address is the production one.
const SITE_URL = 'https://githq.dev/';
const SHARE_IMAGE_URL = 'https://githq.dev/og.png';

const container = useContainer();
const route = useRoute();
const router = useRouter();
const t = useTranslate();

useSeoMeta({
  title: () => t(l.title),
  description: () => t(l.description),
  ogTitle: () => t(l.title),
  ogDescription: () => t(l.description),
  ogImage: SHARE_IMAGE_URL,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogUrl: SITE_URL,
  ogType: 'website',
  twitterCard: 'summary_large_image',
});
useHead({ link: [{ rel: 'canonical', href: SITE_URL }] });

const mounted = ref(false);
const failure = computed(() => (mounted.value ? readSignInFailure(route.query.failed) : null));

onMounted(() => {
  mounted.value = true;
});

function signIn() {
  // Leaves for GitHub and comes back to `/auth/callback`, then to `next`.
  container.resolve(AuthStore).startSignIn(readSignInReturnPath(route.query) ?? '/');
}

// Signed in, the session plugin (`plugins/sessionPlugin.client.ts`) opens home again, which goes on to `next`.
async function signInWithToken(token: string) {
  const result = await container.resolve(AuthStore).signInWithToken(token);
  if (!result.ok) {
    throw new Error(`Sign-in with a token failed: ${result.failure}`);
  }
}

async function dismissFailure() {
  container.resolve(AuthStore).dismissFailure();
  await router.replace({ query: omitProps(route.query, ['failed']) });
}
</script>

<template>
  <LandingScreen @sign-in="signIn">
    <template
      v-if="failure"
      #banner
    >
      <SignInBanner
        :failure="failure"
        @try-again="signIn"
        @dismiss="dismissFailure"
      />
    </template>
    <template
      v-if="DevTokenForm && mounted"
      #dev
    >
      <component
        :is="DevTokenForm"
        @sign-in="signInWithToken"
      />
    </template>
  </LandingScreen>
</template>
