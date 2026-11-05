<!-- `/download` (githq.pen "Landing · Getting the app", LP17–LP19): every desktop build, one row each, the visitor's system highlighted without changing any size; what the landing page leaves out lives here — the Windows warnings and, under "Sign in with GitHub", what GitHub will ask for (D35). Then What's new, one link to the Development stream and the browser path, which comes first on a phone, where nothing installs. Someone signed in gets "Open githq" in place of signing in. -->
<script lang="ts">
const BUILDS = [
  { id: 'macosSilicon', logo: 'apple', name: l.macosSilicon, note: l.macosSiliconNote },
  { id: 'macosIntel', logo: 'apple', name: l.macosIntel, note: l.macosIntelNote },
  { id: 'windows', logo: 'windows', name: l.windows, note: l.windowsNote },
  { id: 'linuxAppImage', logo: 'linux', name: l.linux, note: l.linuxAppImageNote },
  { id: 'linuxDeb', logo: 'linux', name: l.linux, note: l.linuxDebNote },
] as const;
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, Download, TriangleAlert } from 'lucide-vue-next';

import { HOME_PATH } from '@/auth/routeAccess.js';
import Button from '@/components/Button.vue';

import BrandLogo from './BrandLogo.vue';
import { DEFAULT_DESKTOP_BUILD, DESKTOP_BUILDS, DEVELOPMENT_RELEASE_URL } from './desktopBuilds.js';
import type { DesktopSystem } from './desktopBuilds.js';
import * as l from './DownloadScreen.loc.js';
import LandingFooter from './LandingFooter.vue';
import LandingNav from './LandingNav.vue';
import LandingPermission from './LandingPermission.vue';
import { RELEASES_URL } from './landingLinks.js';

const props = defineProps<{
  /** The visitor's system, `null` while unknown or when there is nothing to install on it. */
  system: DesktopSystem | null;
  /** Holds a session, so the browser path opens the app instead of signing in. */
  signedIn: boolean;
}>();

const emit = defineEmits<{
  /** Every "Sign in". */
  signIn: [];
}>();

const t = useTranslate();

function isVisitorsBuild(id: (typeof BUILDS)[number]['id']) {
  return props.system !== null && DEFAULT_DESKTOP_BUILD[props.system] === id;
}
</script>

<template>
  <div :class="css.downloadScreen">
    <LandingNav
      elsewhere
      :signed-in="signedIn"
      @sign-in="emit('signIn')"
    />

    <main :class="css.downloadScreen_main">
      <header :class="css.downloadScreen_head">
        <h1 :class="css.downloadScreen_title">{{ t(l.title) }}</h1>
        <p :class="[css.downloadScreen_sub, css.downloadScreen_sub__wide]">{{ t(l.sub) }}</p>
        <p :class="[css.downloadScreen_sub, css.downloadScreen_sub__phone]">{{ t(l.subPhone) }}</p>
        <a
          :class="css.downloadScreen_whatsNew"
          :href="RELEASES_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t(l.whatsNew) }}
          <ArrowUpRight
            :class="css.downloadScreen_whatsNewIcon"
            aria-hidden="true"
          />
        </a>
      </header>

      <ul :class="css.downloadScreen_builds">
        <li
          v-for="build in BUILDS"
          :key="build.id"
          :class="[css.downloadScreen_build, isVisitorsBuild(build.id) && css.downloadScreen_build__yours]"
        >
          <span :class="css.downloadScreen_logoBox">
            <BrandLogo
              :class="css.downloadScreen_logo"
              :logo="build.logo"
            />
          </span>
          <div :class="css.downloadScreen_words">
            <div :class="css.downloadScreen_name">
              <h2 :class="css.downloadScreen_buildName">{{ t(build.name) }}</h2>
              <span :class="css.downloadScreen_file">{{ DESKTOP_BUILDS[build.id].file }}</span>
              <span
                v-if="isVisitorsBuild(build.id)"
                :class="css.downloadScreen_yours"
                >{{ t(l.yourSystem) }}</span
              >
              <span
                v-if="build.id === 'windows'"
                :class="css.downloadScreen_unsigned"
              >
                <TriangleAlert
                  :class="css.downloadScreen_unsignedIcon"
                  aria-hidden="true"
                />
                {{ t(l.unsigned) }}
              </span>
            </div>
            <p :class="css.downloadScreen_note">{{ t(build.note) }}</p>
            <p
              v-if="build.id === 'windows'"
              :class="css.downloadScreen_note"
            >
              {{ t(l.windowsSmartAppControl) }}
            </p>
          </div>
          <!-- As tall as the logo: the button stays beside the first two lines, however long the note runs. -->
          <div :class="css.downloadScreen_action">
            <Button
              :variant="isVisitorsBuild(build.id) ? 'light' : 'outline'"
              size="lg"
              :icon="Download"
              :link="DESKTOP_BUILDS[build.id].url"
              :aria-label="t(l.downloadBuild, { build: `${t(build.name)} ${DESKTOP_BUILDS[build.id].file}` })"
            >
              {{ t(l.download) }}
            </Button>
          </div>
        </li>
      </ul>

      <p :class="css.downloadScreen_development">
        <a
          :class="css.downloadScreen_developmentLink"
          :href="DEVELOPMENT_RELEASE_URL"
          target="_blank"
          rel="noopener noreferrer"
          >{{ t(l.development) }}</a
        >
        <span>{{ t(l.developmentNote) }}</span>
      </p>

      <section :class="css.downloadScreen_browser">
        <h2 :class="css.downloadScreen_browserTitle">
          <span :class="css.downloadScreen_sub__wide">{{ t(signedIn ? l.browserOpenTitle : l.browserTitle) }}</span>
          <span :class="css.downloadScreen_sub__phone">{{
            t(signedIn ? l.browserOpenTitle : l.browserTitlePhone)
          }}</span>
        </h2>
        <p :class="css.downloadScreen_browserSub">{{ t(signedIn ? l.browserOpenSub : l.browserSub) }}</p>
        <Button
          v-if="signedIn"
          :class="css.downloadScreen_browserAction"
          size="xl"
          :link="HOME_PATH"
        >
          {{ t(l.openGithq) }}
        </Button>
        <template v-else>
          <Button
            :class="css.downloadScreen_browserAction"
            size="xl"
            @click="emit('signIn')"
          >
            <BrandLogo
              :class="css.downloadScreen_browserLogo"
              logo="github"
            />
            {{ t(l.signIn) }}
          </Button>
          <LandingPermission />
        </template>
      </section>
    </main>

    <LandingFooter
      elsewhere
      :signed-in="signedIn"
      @sign-in="emit('signIn')"
    />
  </div>
</template>

<style lang="scss" module="css">
$logo-box: 45px;

.downloadScreen {
  min-height: 100%;
  container: landing / inline-size;
  background: $color-bg;
}

.downloadScreen_main {
  display: flex;
  flex-direction: column;
  gap: 36px;
  width: min(100%, 920px);
  padding: 88px 20px 120px;
  margin-inline: auto;

  @include landing-mobile {
    gap: 28px;
    padding-block: 40px 64px;
  }
}

.downloadScreen_head {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  align-items: flex-start;
}

.downloadScreen_title {
  font-family: $font-family-brand;
  font-size: clamp(38px, 3.9cqi, 56px);
  font-weight: $font-weight-semibold;
  line-height: 1.1;
  color: $color-fg;
  letter-spacing: -0.035em;
}

.downloadScreen_sub {
  font-size: 18px;
  line-height: 1.5;
  color: $color-fg-2;

  @include landing-mobile {
    font-size: 16px;
  }
}

// What the page says differs on a phone, known from its width, so it never changes once shown.
.downloadScreen_sub__wide {
  @include landing-mobile {
    display: none;
  }
}

.downloadScreen_sub__phone {
  display: none;

  @include landing-mobile {
    display: inline;
  }
}

.downloadScreen_whatsNew {
  @include focus-ring;

  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: $radius-sm;
}

.downloadScreen_whatsNewIcon {
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.downloadScreen_builds {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding: 0;
  list-style: none;
}

.downloadScreen_build {
  display: grid;
  grid-template-columns: $logo-box minmax(0, 1fr) auto;
  gap: $spacing-16;
  align-items: start;
  padding: 18px 20px;
  border: 1px solid transparent;
  border-radius: 12px;

  // The button drops under the words, where the row is too narrow for it.
  @include landing-mobile {
    grid-template-columns: $logo-box minmax(0, 1fr);
  }
}

.downloadScreen_build__yours {
  background: $color-bg-2;
  border-color: rgba($color-accent, 0.4);
}

.downloadScreen_logoBox {
  display: flex;
  align-items: center;
  justify-content: center;
  height: $logo-box;
  color: $color-fg-2;
}

.downloadScreen_logo {
  width: 32px;
  height: 32px;
}

.downloadScreen_words {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
}

.downloadScreen_name {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4 $spacing-10;
  align-items: center;
}

.downloadScreen_buildName {
  font-size: 15px;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.downloadScreen_file {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.downloadScreen_yours,
.downloadScreen_unsigned {
  display: inline-flex;
  gap: $spacing-4;
  align-items: center;
  padding: 2px $spacing-8;
  font-size: 11px;
  font-weight: $font-weight-medium;
  line-height: 1.3;
  border-radius: 999px;
}

.downloadScreen_yours {
  color: $color-fg;
  background: rgba($color-accent, 0.15);
}

.downloadScreen_unsigned {
  color: $color-amber;
  background: rgba($color-amber, 0.15);
}

.downloadScreen_unsignedIcon {
  width: 12px;
  height: 12px;
}

.downloadScreen_note {
  font-size: $font-size-md;
  line-height: 1.45;
  color: $color-fg-2;
}

.downloadScreen_action {
  display: flex;
  align-items: center;
  min-height: $logo-box;

  @include landing-mobile {
    grid-column: 1 / -1;
    min-height: 0;
  }
}

.downloadScreen_development {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: $font-size-md;
  line-height: 1.45;
  color: $color-fg-dim;
}

.downloadScreen_developmentLink {
  @include focus-ring;

  align-self: flex-start;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: $radius-sm;
}

.downloadScreen_browser {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
  padding-top: 36px;
  border-top: 1px solid $color-border;

  // First on a phone: it's what works there.
  @include landing-mobile {
    order: -1;
    padding-top: 0;
    border-top: 0;
  }
}

// The head stays above it.
.downloadScreen_head {
  @include landing-mobile {
    order: -2;
  }
}

.downloadScreen_browserTitle {
  font-family: $font-family-brand;
  font-size: 28px;
  font-weight: $font-weight-semibold;
  color: $color-fg;
  letter-spacing: -0.02em;

  @include landing-mobile {
    font-size: 22px;
  }
}

.downloadScreen_browserSub {
  font-size: 15px;
  line-height: 1.45;
  color: $color-fg-2;
}

.downloadScreen_browser > .downloadScreen_browserAction {
  background: $color-bg-2;
  border-color: $color-landing-secondary-border;

  @include landing-mobile {
    align-self: stretch;
  }
}

.downloadScreen_browserLogo {
  width: 18px;
  height: 18px;
}
</style>
