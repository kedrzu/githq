<!-- `/sign-in`: GitHub's sign-in, then on to `next`; after a failure (`failed`, see `readSignInFailure`) it says what went wrong. Under `nuxt dev` and in the local build also the sign-in with a pasted token. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';

import { AuthStore } from './AuthStore.js';
import { readSignInFailure, safeNextPath } from './routeAccess.js';
import SignInScreen from './SignInScreen.vue';

// The development sign-in exists under `nuxt dev` and in the local build (`__LOCAL_BUILD__`) only. The
// production build replaces both with `false`, which drops this import and the form's whole chunk —
// `scripts/checkProductionBuild.ts` checks the built files for it after every production build.
const DevTokenForm =
  import.meta.dev || __LOCAL_BUILD__ ? defineAsyncComponent(() => import('./DevTokenForm.vue')) : null;

const auth = useService(AuthStore);
const route = useRoute();

function next() {
  return safeNextPath(route.query.next) ?? '/';
}

function signIn() {
  // Leaves for GitHub and comes back to `/auth/callback`, then to `next`.
  auth.startSignIn(next());
}

// Signed in, the session plugin (`plugins/sessionPlugin.ts`) moves on to `next`, as for a sign-in in another tab.
async function signInWithToken(token: string) {
  const result = await auth.signInWithToken(token);
  if (!result.ok) {
    throw new Error(`Sign-in with a token failed: ${result.failure}`);
  }
}
</script>

<template>
  <SignInScreen
    :failure="readSignInFailure(route.query.failed)"
    @sign-in="signIn"
  >
    <template
      v-if="DevTokenForm"
      #dev
    >
      <component
        :is="DevTokenForm"
        @sign-in="signInWithToken"
      />
    </template>
  </SignInScreen>
</template>
