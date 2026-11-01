<!-- The desktop app's sign-in with a device code (S1–S4), on the sign-in page's frame (`SignInScreen`): what githq is and "Sign in with GitHub" (S1); then the code, large, with "Copy code and open GitHub" and "Cancel" while githq waits for GitHub (S2); after a failed attempt one line on why and "Get a new code" (S3). A quiet line says when there is no system keychain to keep the token in (S4). Enter runs the main action, Esc cancels a code. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { Copy, Github, KeyRound, LoaderCircle, RotateCw } from 'lucide-vue-next';
import { computed } from 'vue';

import SignInScreen from '@/auth/SignInScreen.vue';
import Button from '@/components/Button.vue';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';

import * as l from './DesktopSignIn.loc.js';
import type { DeviceSignInState } from './DeviceSignIn.js';

const props = defineProps<{
  state: DeviceSignInState;
  /** Whether the token outlives this run of the app (`TokenVault.persistent`); `false` says so up front (S4). */
  persistent: boolean;
  /** Signed out because GitHub stopped accepting the kept token. */
  signedOut?: boolean;
}>();

const emit = defineEmits<{
  /** "Sign in with GitHub" or "Get a new code": ask GitHub for a code. */
  start: [];
  /** "Copy code and open GitHub". */
  open: [];
  /** "Cancel" or Esc: abandon the code. */
  cancel: [];
}>();

const t = useTranslate();

const notice = computed(() => {
  if (props.state.kind !== 'failed') {
    return props.signedOut && props.state.kind === 'idle' ? t(l.signedOut) : null;
  }

  const failure = props.state.failure;
  switch (failure) {
    case 'expired':
      return t(l.expired);
    case 'denied':
      return t(l.denied);
    case 'offline':
      return t(l.offline);
    case 'failed':
      return t(l.failed);
    case 'missingScopes':
      return t(l.missingScopes);
    default:
      return assertNever(failure, 'Unknown device sign-in failure');
  }
});
const minutes = computed(() =>
  props.state.kind === 'waiting' ? Math.max(1, Math.round(props.state.code.expiresIn / 60)) : 0,
);

// Esc abandons the code — also while it is being asked for.
onWindowEvent('keydown', event => {
  if (event.key !== 'Escape' || event.repeat || !isSingleKeyShortcut(event)) {
    return;
  }

  if (props.state.kind === 'waiting' || props.state.kind === 'requesting') {
    event.preventDefault();
    emit('cancel');
  }
});

/** Enter (from `SignInScreen`): the main action of the screen shown. */
function runMainAction() {
  switch (props.state.kind) {
    case 'idle':
    case 'failed':
      emit('start');
      break;
    case 'waiting':
      emit('open');
      break;
    case 'requesting':
      break;
    default:
      assertNever(props.state, 'Unknown device sign-in state');
  }
}
</script>

<template>
  <SignInScreen
    data-location="computer"
    :notice="notice"
    @sign-in="runMainAction"
  >
    <template
      v-if="state.kind === 'waiting'"
      #body
    >
      <h1 :class="css.desktopSignIn_headline">{{ t(l.codeHeadline) }}</h1>
      <p :class="css.desktopSignIn_lead">{{ t(l.codeLead) }}</p>

      <div :class="css.desktopSignIn_code">
        <p :class="css.desktopSignIn_codeLabel">{{ t(l.codeLabel) }}</p>
        <p
          :class="css.desktopSignIn_codeValue"
          tid="device-code"
        >
          {{ state.code.userCode }}
        </p>
      </div>

      <div :class="css.desktopSignIn_actions">
        <div :class="css.desktopSignIn_buttons">
          <Button
            variant="light"
            size="lg"
            :icon="Copy"
            kbd="Enter"
            aria-keyshortcuts="Enter"
            @click="emit('open')"
          >
            {{ t(l.copyAndOpen) }}
          </Button>
          <Button
            kbd="Escape"
            aria-keyshortcuts="Escape"
            @click="emit('cancel')"
          >
            {{ t(l.cancel) }}
          </Button>
        </div>

        <p
          :class="css.desktopSignIn_waiting"
          role="status"
        >
          <LoaderCircle
            :class="css.desktopSignIn_waitingIcon"
            aria-hidden="true"
          />
          <span :class="css.desktopSignIn_waitingText">{{ t(l.waiting) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ t(l.codeWorksFor, { minutes }) }}</span>
        </p>
      </div>
    </template>

    <template #action>
      <Button
        variant="light"
        size="lg"
        :icon="state.kind === 'failed' ? RotateCw : Github"
        kbd="Enter"
        aria-keyshortcuts="Enter"
        :busy="state.kind === 'requesting'"
        @click="emit('start')"
      >
        {{ state.kind === 'failed' ? t(l.newCode) : t(l.signIn) }}
      </Button>
    </template>

    <template
      v-if="!persistent"
      #note
    >
      <p :class="css.desktopSignIn_note">
        <KeyRound
          :class="css.desktopSignIn_noteIcon"
          aria-hidden="true"
        />
        <span>{{ t(l.noKeychain) }}</span>
      </p>
    </template>
  </SignInScreen>
</template>

<style lang="scss" module="css">
// The headline, lead and actions of `SignInScreen`, for the code's own body.
.desktopSignIn_headline {
  font-size: $font-size-display;
  font-weight: $font-weight-semibold;
  line-height: $line-height-tight;
  letter-spacing: -0.6px;
  color: $color-fg;
}

.desktopSignIn_lead {
  font-size: $font-size-xl;
  line-height: 1.55;
  color: $color-fg-2;
}

.desktopSignIn_code {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: 18px 20px;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
}

.desktopSignIn_codeLabel {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.desktopSignIn_codeValue {
  font-family: $font-family-mono;
  font-size: 40px;
  font-weight: $font-weight-medium;
  line-height: $line-height-tight;
  letter-spacing: 6px;
  color: $color-fg;
  user-select: all;
}

.desktopSignIn_actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  align-items: flex-start;
  padding-top: $spacing-6;
}

.desktopSignIn_buttons {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}

.desktopSignIn_waiting {
  display: flex;
  gap: 7px;
  align-items: center;
  padding-top: $spacing-4;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.desktopSignIn_waitingIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
  animation: desktop-sign-in-spin 1.6s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.desktopSignIn_waitingText {
  color: $color-fg-2;
}

.desktopSignIn_note {
  display: flex;
  gap: 7px;
  padding-top: $spacing-2;
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.desktopSignIn_noteIcon {
  flex: none;
  width: 13px;
  height: 13px;
  margin-top: 3px;
  color: $color-fg-3;
}

@keyframes desktop-sign-in-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
