<!-- The landing page's four features (githq.pen "Landing — githq.dev", Feature 01–04): Instant — with the toast of an edit saved to GitHub —, My work, Keyboard — its keys, and the command menu over a dimmed list — and Faithful to GitHub, the screenshot on alternating sides. The navigation's "Features" and "Keyboard" land here. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowLeftRight,
  CheckCheck,
  CircleCheck,
  CircleDot,
  Command,
  Eye,
  GitPullRequest,
  Link,
  RefreshCw,
  SquareKanban,
  Zap,
} from 'lucide-vue-next';

import * as l from './LandingFeatures.loc.js';
import LandingFeature from './LandingFeature.vue';
import { LandingSectionId } from './landingLinks.js';

const t = useTranslate();

// "Keyboard"'s keys, two to a row; `command` puts ⌘ before the key.
const keys = [
  { key: 'K', command: true, action: l.keyCommandMenu },
  { key: 'C', command: false, action: l.keyNewIssue },
  { key: 'S', command: false, action: l.keySetStatus },
  { key: 'A', command: false, action: l.keyAssignee },
  { key: 'L', command: false, action: l.keyLabels },
  { key: 'O', command: false, action: l.keyOpenOnGitHub },
];
</script>

<template>
  <div :id="LandingSectionId.features">
    <LandingFeature
      number="01"
      :kicker="t(l.instantKicker)"
      :title="t(l.instantTitle)"
      :body="t(l.instantBody)"
      :points="[
        { icon: Zap, text: t(l.instantLocalCopy) },
        { icon: CheckCheck, text: t(l.instantEdits) },
        { icon: RefreshCw, text: t(l.instantRefresh) },
      ]"
      image="/landing/instant.webp"
      :image-alt="t(l.instantAlt)"
    >
      <template #overlay>
        <p :class="css.landingFeatures_toast">
          <CircleCheck
            :class="css.landingFeatures_toastIcon"
            aria-hidden="true"
          />
          {{ t(l.instantToast) }}
        </p>
      </template>
    </LandingFeature>

    <LandingFeature
      number="02"
      :kicker="t(l.myWorkKicker)"
      :title="t(l.myWorkTitle)"
      :body="t(l.myWorkBody)"
      :points="[
        { icon: CircleDot, text: t(l.myWorkAssigned) },
        { icon: GitPullRequest, text: t(l.myWorkPullRequests) },
        { icon: Eye, text: t(l.myWorkReviews) },
      ]"
      image="/landing/my-work-list.webp"
      :image-alt="t(l.myWorkAlt)"
      flip
    />

    <LandingFeature
      :id="LandingSectionId.keyboard"
      number="03"
      :kicker="t(l.keyboardKicker)"
      :title="t(l.keyboardTitle)"
      :body="t(l.keyboardBody)"
      image="/landing/keyboard.webp"
      image-alt=""
    >
      <template #details>
        <ul
          :class="css.landingFeatures_keys"
          :aria-label="t(l.keyboardKeys)"
        >
          <li
            v-for="item in keys"
            :key="item.key"
            :class="css.landingFeatures_key"
          >
            <kbd :class="css.landingFeatures_keycap">
              <template v-if="item.command">
                <Command
                  :class="css.landingFeatures_command"
                  aria-hidden="true"
                />
                <span :class="css.landingFeatures_hidden">⌘</span>
              </template>
              {{ item.key }}
            </kbd>
            <span :class="css.landingFeatures_action">{{ t(item.action) }}</span>
          </li>
        </ul>
      </template>
      <template #overlay>
        <div :class="css.landingFeatures_scrim" />
        <img
          :class="css.landingFeatures_commandMenu"
          src="/landing/command-menu.webp"
          width="1202"
          height="828"
          loading="lazy"
          decoding="async"
          :alt="t(l.keyboardAlt)"
        />
      </template>
    </LandingFeature>

    <LandingFeature
      number="04"
      :kicker="t(l.faithfulKicker)"
      :title="t(l.faithfulTitle)"
      :body="t(l.faithfulBody)"
      :points="[
        { icon: SquareKanban, text: t(l.faithfulFields) },
        { icon: ArrowLeftRight, text: t(l.faithfulTwoWay) },
        { icon: Link, text: t(l.faithfulAddresses) },
      ]"
      image="/landing/faithful.webp"
      :image-alt="t(l.faithfulAlt)"
      flip
    />
  </div>
</template>

<style lang="scss" module="css">
// Above the screenshot's fade, as the design has it.
.landingFeatures_toast {
  position: absolute;
  bottom: 38px;
  left: 28px;
  z-index: 2;
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-10 14px;
  font-size: $font-size-md;
  color: $color-fg;
  white-space: nowrap;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: $radius-xl;
  box-shadow: $shadow-landing-toast;

  @include landing-mobile {
    bottom: 22px;
    left: $spacing-16;
  }
}

.landingFeatures_toastIcon {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-green;
}

.landingFeatures_keys {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-10;
  padding: $spacing-8 0 0;
  margin: 0;
  list-style: none;
}

.landingFeatures_key {
  display: flex;
  gap: $spacing-12;
  align-items: center;
  min-width: 0;
  padding: $spacing-10;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
}

.landingFeatures_keycap {
  display: inline-flex;
  flex: none;
  gap: $spacing-2;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 9px;
  font-family: $font-family-mono;
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: $color-fg;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-bottom-width: 2px;
  border-radius: $radius-md;
}

.landingFeatures_command {
  width: 14px;
  height: 14px;
}

.landingFeatures_hidden {
  @include visually-hidden;
}

.landingFeatures_action {
  overflow: hidden;
  font-size: $font-size-lg;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.landingFeatures_scrim {
  position: absolute;
  inset: 0;
  background: rgba($color-bg, 0.6);
}

.landingFeatures_commandMenu {
  position: absolute;
  top: 56px;
  left: 20px;
  width: min(600px, calc(100% - 40px));
  height: auto;
  // The image has the menu's outline and corners; the radius only shapes the shadow.
  border-radius: 12px;
  box-shadow: $shadow-landing-overlay;

  @include landing-mobile {
    top: 36px;
    left: 10px;
    width: calc(100% - 20px);
  }
}
</style>
