<!-- The desktop app's home signed out, which `home/HomePage.vue` picks in the desktop build only: the device sign-in (`DeviceSignIn`) on its screen. "Copy code and open GitHub" copies the code and opens GitHub's page in the system browser. Leaving the page abandons the attempt under way. Signed in, the session plugin (`plugins/sessionPlugin.client.ts`) opens home again, which goes on to `next`. -->
<script lang="ts" setup>
import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onBeforeUnmount } from 'vue';

import { TokenVault } from '@/auth/TokenVault.js';
import { Browser } from '@/services/Browser.js';

import DesktopSignIn from './DesktopSignIn.vue';
import { DeviceSignIn } from './DeviceSignIn.js';

defineProps<{
  /** Signed out because GitHub stopped accepting the kept token. */
  signedOut: boolean;
}>();

const signIn = useService(DeviceSignIn);
const vault = useService(TokenVault);
const browser = useService(Browser);
const logger = useLogger();

onBeforeUnmount(() => signIn.cancel());

async function openGitHub() {
  if (signIn.state.kind !== 'waiting') {
    return;
  }

  const { userCode, verificationUri } = signIn.state.code;
  // Copied before the browser takes the focus away from the window, which the clipboard needs.
  try {
    await navigator.clipboard.writeText(userCode);
  } catch (error) {
    logger.warn('Could not copy the device code', { error });
  }

  browser.openInNewTab(verificationUri);
}
</script>

<template>
  <DesktopSignIn
    :state="signIn.state"
    :persistent="vault.persistent"
    :signed-out="signedOut"
    @start="signIn.start()"
    @open="openGitHub()"
    @cancel="signIn.cancel()"
  />
</template>
