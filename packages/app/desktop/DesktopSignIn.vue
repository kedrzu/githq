<!-- The desktop app's sign-in with a device code (S1–S4), a screen of its own (D21: the web has no such screen): what githq is, what GitHub will ask for and "Sign in with GitHub" (S1); then the code, large, with "Copy code and open GitHub" and "Cancel" while githq waits for GitHub (S2); after a failed attempt one line on why, "Get a new code", and the explanation behind "Why?" (S3). A quiet line says when there is no system keychain to keep the token in (S4). Enter runs the main action, Esc cancels a code. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import {
  BookLock,
  CircleAlert,
  Copy,
  Github,
  HardDrive,
  KeyRound,
  LoaderCircle,
  RotateCw,
  SquareKanban,
} from 'lucide-vue-next';
import { computed, ref, useId } from 'vue';

import Button from '@/components/Button.vue';
import Wordmark from '@/components/Wordmark.vue';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
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
const explainerId = useId();

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
// After a failure the explainer waits behind "Why?"; before signing in it is shown up front.
const explainerOpen = ref(false);
const showExplainer = computed(() => !notice.value || explainerOpen.value);

onWindowEvent('keydown', event => {
  if (event.repeat || !isSingleKeyShortcut(event)) {
    return;
  }

  // Esc abandons the code — also while it is being asked for.
  if (event.key === 'Escape' && (props.state.kind === 'waiting' || props.state.kind === 'requesting')) {
    event.preventDefault();
    emit('cancel');
  }

  // Enter anywhere on the page runs the main action — except where Enter already means something (a field, a button, a link).
  if (event.key === 'Enter' && !isActivatableTarget(event.target)) {
    event.preventDefault();
    runMainAction();
  }
});

/** Enter: the main action of the screen shown. */
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
  <div :class="css.desktopSignIn">
    <main :class="css.desktopSignIn_body">
      <div :class="css.desktopSignIn_column">
        <Wordmark
          size="lg"
          :class="css.desktopSignIn_logo"
        />

        <template v-if="state.kind === 'waiting'">
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

        <template v-else>
          <div
            v-if="notice"
            :class="css.desktopSignIn_notice"
            role="status"
          >
            <CircleAlert
              :class="css.desktopSignIn_noticeIcon"
              aria-hidden="true"
            />
            <p :class="css.desktopSignIn_noticeText">{{ notice }}</p>
          </div>

          <h1 :class="css.desktopSignIn_headline">{{ t(l.headline) }}</h1>
          <p :class="css.desktopSignIn_lead">{{ t(l.lead) }}</p>

          <div :class="css.desktopSignIn_actions">
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

            <p
              v-if="!persistent"
              :class="css.desktopSignIn_note"
            >
              <KeyRound
                :class="css.desktopSignIn_noteIcon"
                aria-hidden="true"
              />
              <span>{{ t(l.noKeychain) }}</span>
            </p>

            <p
              v-if="notice"
              :class="css.desktopSignIn_asksShort"
            >
              {{ t(l.asksShort) }}
              <Button
                variant="link"
                :class="css.desktopSignIn_why"
                :aria-expanded="explainerOpen"
                :aria-controls="explainerId"
                @click="explainerOpen = !explainerOpen"
              >
                {{ t(l.why) }}
              </Button>
            </p>
          </div>

          <section
            v-if="showExplainer"
            :id="explainerId"
            :class="css.desktopSignIn_explainer"
          >
            <h2 :class="css.desktopSignIn_explainerTitle">{{ t(l.asksTitle) }}</h2>
            <ul :class="css.desktopSignIn_asks">
              <li :class="css.desktopSignIn_ask">
                <BookLock
                  :class="css.desktopSignIn_askIcon"
                  aria-hidden="true"
                />
                <div :class="css.desktopSignIn_askText">
                  <h3 :class="css.desktopSignIn_askTitle">{{ t(l.asksRepositories) }}</h3>
                  <p :class="css.desktopSignIn_askDetail">{{ t(l.asksRepositoriesDetail) }}</p>
                </div>
              </li>
              <li :class="css.desktopSignIn_ask">
                <SquareKanban
                  :class="css.desktopSignIn_askIcon"
                  aria-hidden="true"
                />
                <div :class="css.desktopSignIn_askText">
                  <h3 :class="css.desktopSignIn_askTitle">{{ t(l.asksProjects) }}</h3>
                  <p :class="css.desktopSignIn_askDetail">{{ t(l.asksProjectsDetail) }}</p>
                </div>
              </li>
              <li :class="css.desktopSignIn_ask">
                <HardDrive
                  :class="css.desktopSignIn_askIcon"
                  aria-hidden="true"
                />
                <div :class="css.desktopSignIn_askText">
                  <h3 :class="css.desktopSignIn_askTitle">{{ t(l.asksData) }}</h3>
                  <p :class="css.desktopSignIn_askDetail">{{ t(l.asksDataDetail) }}</p>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </div>
    </main>

    <footer :class="css.desktopSignIn_footer">
      <span>{{ t(l.footerOpenSource) }}</span>
      <span>{{ t(l.footerStaysOnGitHub) }}</span>
    </footer>
  </div>
</template>

<style lang="scss" module="css">
.desktopSignIn {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: $color-bg;
}

.desktopSignIn_body {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: $spacing-24 $spacing-24 56px;
}

.desktopSignIn_column {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 440px;
  max-width: 100%;
}

// The design's 26px under the logo, on top of the column's gap.
.desktopSignIn_logo {
  align-self: flex-start;
  margin-bottom: 26px;
}

.desktopSignIn_notice {
  display: flex;
  gap: $spacing-10;
  padding: $spacing-10 $spacing-12;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.desktopSignIn_noticeIcon {
  flex: none;
  width: 15px;
  height: 15px;
  margin-top: 1px;
  color: $color-amber;
}

.desktopSignIn_noticeText {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
}

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

.desktopSignIn_asksShort {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.desktopSignIn_why {
  margin-left: $spacing-4;
}

.desktopSignIn_explainer {
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
}

.desktopSignIn_explainerTitle {
  padding: $spacing-12 $spacing-16;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
  border-bottom: 1px solid $color-border;
}

.desktopSignIn_asks {
  padding: 0;
  margin: 0;
  list-style: none;
}

.desktopSignIn_ask {
  display: flex;
  gap: $spacing-12;
  padding: $spacing-12 $spacing-16;
}

.desktopSignIn_askIcon {
  flex: none;
  width: 15px;
  height: 15px;
  margin-top: $spacing-2;
  color: $color-fg-2;
}

.desktopSignIn_askText {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.desktopSignIn_askTitle {
  margin: 0;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.desktopSignIn_askDetail {
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.desktopSignIn_footer {
  display: flex;
  justify-content: space-between;
  padding: $spacing-16 $spacing-24;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

@keyframes desktop-sign-in-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
