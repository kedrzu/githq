<!-- `/auth/callback`: where GitHub sends the browser back. Finishes the sign-in (`AuthStore.completeSignIn`) and goes on to where the user was heading, or back to the landing page with the reason in its address (`/?failed=…`), which its banner explains — after a reload too. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onMounted } from 'vue';
import type { LocationQueryValue } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';

import * as l from './AuthCallbackPage.loc.js';
import { AuthStore } from './AuthStore.js';
import type { SignInResult } from './AuthStore.js';
import { HOME_PATH } from './routeAccess.js';

const auth = useService(AuthStore);
const route = useRoute();
const router = useRouter();
const t = useTranslate();
const logger = useLogger();

onMounted(async () => {
  const result = await completeSignIn();

  // `replace`: the callback's address, with its one-time code, does not stay in the history.
  await router.replace(result.ok ? result.returnTo : { path: HOME_PATH, query: { failed: result.failure } });
});

/** The sign-in's end; whatever goes wrong, a failure — the page must never stay on "Signing in…". */
async function completeSignIn(): Promise<SignInResult> {
  try {
    return await auth.completeSignIn({
      code: readParam(route.query.code),
      state: readParam(route.query.state),
      error: readParam(route.query.error),
    });
  } catch (error) {
    logger.error('Completing the sign-in failed unexpectedly', { error });
    return { ok: false, failure: 'failed' };
  }
}

function readParam(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first : undefined;
}
</script>

<template>
  <main :class="css.authCallbackPage">
    <p role="status">{{ t(l.signingIn) }}</p>
  </main>
</template>

<style lang="scss" module="css">
.authCallbackPage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  font-size: $font-size-md;
  color: $color-fg-dim;
}
</style>
