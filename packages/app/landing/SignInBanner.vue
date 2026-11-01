<!-- G1: the landing page's one line on why the user is back from a sign-in — cancelled or failed on the way back from GitHub, granted too little, or signed out because GitHub stopped accepting the token — with "Try again" and a way to dismiss it. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, X } from 'lucide-vue-next';
import { computed } from 'vue';

import type { SignInFailure } from '@/auth/AuthStore.js';
import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';

import * as l from './SignInBanner.loc.js';

const props = defineProps<{
  failure: SignInFailure;
}>();

const emit = defineEmits<{
  /** "Try again": signing in once more. */
  tryAgain: [];
  dismiss: [];
}>();

const t = useTranslate();
const text = computed(() => {
  const failure = props.failure;
  switch (failure) {
    case 'cancelled':
      return { title: t(l.didntFinish), detail: t(l.cancelled) };
    case 'failed':
      return { title: t(l.didntFinish), detail: t(l.failed) };
    case 'missingScopes':
      return { title: t(l.missingScopesTitle), detail: t(l.missingScopes) };
    case 'tokenRejected':
      return { title: t(l.tokenRejectedTitle), detail: t(l.tokenRejected) };
    default:
      return assertNever(failure, 'Unknown sign-in failure');
  }
});
</script>

<template>
  <div
    :class="css.signInBanner"
    role="status"
  >
    <CircleAlert
      :class="css.signInBanner_icon"
      aria-hidden="true"
    />
    <p :class="css.signInBanner_text">
      <strong :class="css.signInBanner_title">{{ text.title }}</strong>
      {{ text.detail }}
    </p>
    <Button
      size="sm"
      @click="emit('tryAgain')"
    >
      {{ t(l.tryAgain) }}
    </Button>
    <IconButton
      :icon="X"
      :label="t(l.dismiss)"
      @click="emit('dismiss')"
    />
  </div>
</template>

<style lang="scss" module="css">
.signInBanner {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-8 $spacing-12;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.signInBanner_icon {
  flex: none;
  width: 15px;
  height: 15px;
  color: $color-amber;
}

.signInBanner_text {
  flex: 1;
  font-size: $font-size-md;
  color: $color-fg-2;
}

.signInBanner_title {
  font-weight: $font-weight-medium;
  color: $color-fg;
}
</style>
