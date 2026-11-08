<!-- The landing page's call to action (githq.pen "Landing — githq.dev"; D35), in the hero and the Final CTA: "Download the app" with the logo of the visitor's system, which downloads its build at once and spins until the download has started (with no system to install on, it opens `/download`), and "Sign in with GitHub", straight to GitHub's consent screen (D21); under them one line of fine print, starting with the link to every build. Stacked on a phone. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Download } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import Button from '@/components/Button.vue';

import BrandLogo from './BrandLogo.vue';
import { DEFAULT_DESKTOP_BUILD, DESKTOP_BUILDS, DOWNLOAD_PATH } from './desktopBuilds.js';
import type { DesktopSystem } from './desktopBuilds.js';
import * as l from './LandingActions.loc.js';
import { waitForDownload } from './waitForDownload.js';

const LOGOS = { macos: 'apple', windows: 'windows', linux: 'linux' } as const;

const props = defineProps<{
  /** The visitor's system, `null` while unknown or when there is nothing to install on it. */
  system: DesktopSystem | null;
}>();

const emit = defineEmits<{
  /** "Sign in with GitHub". */
  signIn: [];
}>();

const t = useTranslate();
const downloadLink = computed(() =>
  props.system ? DESKTOP_BUILDS[DEFAULT_DESKTOP_BUILD[props.system]].url : DOWNLOAD_PATH,
);

/** Spins the button until the download has started; opening `/download` needs no wait of its own. */
function onDownload() {
  return props.system ? waitForDownload(downloadLink.value) : undefined;
}
</script>

<template>
  <div :class="css.landingActions">
    <div :class="css.landingActions_buttons">
      <Button
        :class="[css.landingActions_cta, css.landingActions_download]"
        variant="light"
        size="xl"
        :link="downloadLink"
        @click="onDownload"
      >
        <!-- One size for every icon, so nothing moves when the system becomes known. -->
        <BrandLogo
          v-if="system"
          :class="css.landingActions_icon"
          :tid="`landing-download-logo-${system}`"
          :logo="LOGOS[system]"
        />
        <Download
          v-else
          :class="css.landingActions_icon"
          aria-hidden="true"
        />
        <span :class="css.landingActions_words">
          <span :class="css.landingActions_title">{{ t(l.download) }}</span>
          <span :class="css.landingActions_subtitle">{{ t(l.downloadSubtitle) }}</span>
        </span>
      </Button>
      <Button
        :class="[css.landingActions_cta, css.landingActions_signIn]"
        size="xl"
        @click="emit('signIn')"
      >
        <BrandLogo
          :class="css.landingActions_icon"
          logo="github"
        />
        <span :class="css.landingActions_words">
          <span :class="css.landingActions_title">{{ t(l.signIn) }}</span>
          <span :class="css.landingActions_subtitle">{{ t(l.signInSubtitle) }}</span>
        </span>
      </Button>
    </div>

    <p :class="css.landingActions_finePrint">
      <RouterLink
        :class="css.landingActions_allDownloads"
        :to="DOWNLOAD_PATH"
        >{{ t(l.allDownloads) }}</RouterLink
      >
      <span :class="css.landingActions_reassurance">
        <span>{{ t(l.noTracker) }}</span>
        <span :class="css.landingActions_separated">{{ t(l.nothingStored) }}</span>
      </span>
    </p>
  </div>
</template>

<style lang="scss" module="css">
.landingActions {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  padding-top: $spacing-8;

  @include landing-mobile {
    gap: $spacing-16;
    align-self: stretch;
  }
}

.landingActions_buttons {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-12;
  justify-content: center;

  @include landing-mobile {
    flex-direction: column;
    align-self: stretch;
  }
}

// Over the button's own look (one class deeper): larger than any other button, and two lines of text.
.landingActions_buttons > .landingActions_cta {
  padding: 11px 22px 11px 18px;
  text-align: left;
  white-space: normal;
  border-radius: 12px;

  > span {
    gap: $spacing-12;
  }

  // On a phone they start at one edge, so their icons line up.
  @include landing-mobile {
    display: flex;
    justify-content: flex-start;
  }
}

// The design's glow, and the outline brighter than `border-2`: beside the glow it reads as the smaller button otherwise.
.landingActions_buttons > .landingActions_download {
  box-shadow: 0 0 32px rgba($color-accent, 0.4);
}

.landingActions_buttons > .landingActions_signIn {
  background: $color-bg-2;
  border-color: $color-landing-secondary-border;
}

.landingActions_icon {
  flex: none;
  width: 24px;
  height: 24px;
}

.landingActions_words {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.landingActions_title {
  font-size: 16px;
  line-height: 1.3;

  .landingActions_download & {
    font-weight: $font-weight-semibold;
  }
}

.landingActions_subtitle {
  font-size: $font-size-md;
  font-weight: $font-weight-normal;
  line-height: 1.35;
  color: $color-fg-2;

  .landingActions_download & {
    color: rgba($color-on-light, 0.72);
  }
}

// "All downloads · No new tracker · Nothing stored outside GitHub": one line, two on a phone.
.landingActions_finePrint {
  display: flex;
  flex-wrap: wrap;
  column-gap: $spacing-10;
  justify-content: center;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  line-height: 1.6;
  color: $color-fg-dim;
  letter-spacing: 0.2px;

  @include landing-mobile {
    flex-direction: column;
    align-items: center;
  }
}

.landingActions_allDownloads {
  @include focus-ring;

  color: $color-fg;
  text-decoration: none;
  text-underline-offset: 2px;
  border-radius: $radius-sm;

  &:hover {
    text-decoration: underline;
  }
}

.landingActions_reassurance::before,
.landingActions_separated::before {
  content: ' · ' / '';
}

.landingActions_reassurance::before {
  @include landing-mobile {
    content: none;
  }
}
</style>
