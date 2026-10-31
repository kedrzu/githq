<!-- The sign-in page (G1b, and G1c with a `failure`): what githq is, "Sign in with GitHub" (also on Enter), and what GitHub's consent screen will ask for. After a failure, one calm line on what happened, with the explanation behind "Why?". -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { BookLock, CircleAlert, Github, HardDrive, SquareKanban } from 'lucide-vue-next';
import { computed, ref, useId } from 'vue';

import Button from '@/components/Button.vue';
import Wordmark from '@/components/Wordmark.vue';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';

import type { SignInFailure } from './AuthStore.js';
import * as l from './SignInScreen.loc.js';

const props = defineProps<{
  /** Why the user is back here; `null` on a first visit. */
  failure?: SignInFailure | null;
}>();

const emit = defineEmits<{
  /** "Sign in with GitHub", clicked or Enter pressed. */
  signIn: [];
}>();

defineSlots<{
  /** The development sign-in (`DevTokenForm`), under `nuxt dev` and in the local build only. */
  dev?(): unknown;
}>();

const t = useTranslate();
const explainerId = useId();
const notice = computed(() => {
  const failure = props.failure;
  if (failure == null) {
    return null;
  }

  switch (failure) {
    case 'cancelled':
      return { title: t(l.cancelledTitle), detail: t(l.cancelledDetail) };
    case 'failed':
      return { title: t(l.failedTitle), detail: t(l.failedDetail) };
    case 'missingScopes':
      return { title: t(l.missingScopesTitle), detail: t(l.missingScopesDetail) };
    case 'tokenRejected':
      return { title: t(l.tokenRejectedTitle), detail: t(l.tokenRejectedDetail) };
    default:
      return assertNever(failure, 'Unknown sign-in failure');
  }
});
// After a failure the explainer waits behind "Why?" (G1c); on a first visit it is shown up front (G1b).
const explainerOpen = ref(false);
const showExplainer = computed(() => !notice.value || explainerOpen.value);

// Enter anywhere on the page signs in — except where Enter already means something (a field, a button, a link).
onWindowEvent('keydown', event => {
  if (event.key !== 'Enter' || event.repeat || !isSingleKeyShortcut(event) || isActivatableTarget(event.target)) {
    return;
  }

  event.preventDefault();
  emit('signIn');
});
</script>

<template>
  <div :class="css.signInScreen">
    <header :class="css.signInScreen_top">
      <Wordmark />
    </header>

    <main :class="css.signInScreen_body">
      <div :class="css.signInScreen_column">
        <div
          v-if="notice"
          :class="css.signInScreen_notice"
          role="status"
        >
          <CircleAlert
            :class="css.signInScreen_noticeIcon"
            aria-hidden="true"
          />
          <div :class="css.signInScreen_noticeText">
            <p :class="css.signInScreen_noticeTitle">{{ notice.title }}</p>
            <p :class="css.signInScreen_noticeDetail">{{ notice.detail }}</p>
          </div>
        </div>

        <h1 :class="css.signInScreen_headline">{{ t(l.headline) }}</h1>
        <p :class="css.signInScreen_lead">{{ t(l.lead) }}</p>

        <div :class="css.signInScreen_actions">
          <Button
            variant="light"
            size="lg"
            :icon="Github"
            kbd="↵"
            aria-keyshortcuts="Enter"
            @click="emit('signIn')"
          >
            {{ t(l.signIn) }}
          </Button>

          <p
            v-if="notice"
            :class="css.signInScreen_asksShort"
          >
            {{ t(l.asksShort) }}
            <Button
              variant="link"
              :class="css.signInScreen_why"
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
          :class="css.signInScreen_explainer"
        >
          <h2 :class="css.signInScreen_explainerTitle">{{ t(l.asksTitle) }}</h2>
          <ul :class="css.signInScreen_asks">
            <li :class="css.signInScreen_ask">
              <BookLock
                :class="css.signInScreen_askIcon"
                aria-hidden="true"
              />
              <div :class="css.signInScreen_askText">
                <h3 :class="css.signInScreen_askTitle">{{ t(l.asksRepositories) }}</h3>
                <p :class="css.signInScreen_askDetail">{{ t(l.asksRepositoriesDetail) }}</p>
              </div>
            </li>
            <li :class="css.signInScreen_ask">
              <SquareKanban
                :class="css.signInScreen_askIcon"
                aria-hidden="true"
              />
              <div :class="css.signInScreen_askText">
                <h3 :class="css.signInScreen_askTitle">{{ t(l.asksProjects) }}</h3>
                <p :class="css.signInScreen_askDetail">{{ t(l.asksProjectsDetail) }}</p>
              </div>
            </li>
            <li :class="css.signInScreen_ask">
              <HardDrive
                :class="css.signInScreen_askIcon"
                aria-hidden="true"
              />
              <div :class="css.signInScreen_askText">
                <h3 :class="css.signInScreen_askTitle">{{ t(l.asksData) }}</h3>
                <p :class="css.signInScreen_askDetail">{{ t(l.asksDataDetail) }}</p>
              </div>
            </li>
          </ul>
        </section>

        <slot name="dev" />
      </div>
    </main>

    <footer :class="css.signInScreen_footer">
      <span>{{ t(l.footerOpenSource) }}</span>
      <span>{{ t(l.footerStaysOnGitHub) }}</span>
    </footer>
  </div>
</template>

<style lang="scss" module="css">
.signInScreen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: $color-bg;
}

.signInScreen_top {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 $spacing-24;
  border-bottom: 1px solid $color-border;
}

.signInScreen_body {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: $spacing-24 $spacing-24 56px;
}

.signInScreen_column {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 440px;
  max-width: 100%;
}

.signInScreen_notice {
  display: flex;
  gap: $spacing-10;
  padding: $spacing-10 $spacing-12;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.signInScreen_noticeIcon {
  flex: none;
  width: 15px;
  height: 15px;
  margin-top: 1px;
  color: $color-amber;
}

.signInScreen_noticeText {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.signInScreen_noticeTitle {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
}

.signInScreen_noticeDetail {
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.signInScreen_headline {
  font-size: $font-size-display;
  font-weight: $font-weight-semibold;
  line-height: $line-height-tight;
  letter-spacing: -0.6px;
  color: $color-fg;
}

.signInScreen_lead {
  font-size: $font-size-xl;
  line-height: 1.55;
  color: $color-fg-2;
}

.signInScreen_actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  align-items: flex-start;
  padding-top: $spacing-6;
}

.signInScreen_asksShort {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.signInScreen_why {
  margin-left: $spacing-4;
}

.signInScreen_explainer {
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
}

.signInScreen_explainerTitle {
  padding: $spacing-12 $spacing-16;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
  border-bottom: 1px solid $color-border;
}

.signInScreen_asks {
  padding: 0;
  margin: 0;
  list-style: none;
}

.signInScreen_ask {
  display: flex;
  gap: $spacing-12;
  padding: $spacing-12 $spacing-16;
}

.signInScreen_askIcon {
  flex: none;
  width: 15px;
  height: 15px;
  margin-top: $spacing-2;
  color: $color-fg-2;
}

.signInScreen_askText {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.signInScreen_askTitle {
  margin: 0;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.signInScreen_askDetail {
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.signInScreen_footer {
  display: flex;
  justify-content: space-between;
  padding: $spacing-16 $spacing-24;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
