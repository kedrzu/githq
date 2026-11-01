<!-- The landing page's top bar (githq.pen "Landing — githq.dev", Nav): the wordmark, links to the page's sections, the repository on GitHub and "Sign in". On a narrow page the links and the repository fold into a menu behind a button. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Github, Menu, X } from 'lucide-vue-next';
import { ref, useId } from 'vue';

import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import Wordmark from '@/components/Wordmark.vue';

import * as l from './LandingNav.loc.js';
import { LandingSectionId, REPOSITORY_URL } from './landingLinks.js';

const emit = defineEmits<{
  /** "Sign in". */
  signIn: [];
}>();

const t = useTranslate();
const menuId = useId();
const menuOpen = ref(false);

const links = [
  { id: LandingSectionId.features, label: l.features },
  { id: LandingSectionId.keyboard, label: l.keyboard },
  { id: LandingSectionId.howItWorks, label: l.howItWorks },
  { id: LandingSectionId.openSource, label: l.openSource },
];
</script>

<template>
  <header
    :class="css.landingNav"
    @keydown.esc="menuOpen = false"
  >
    <div :class="css.landingNav_bar">
      <Wordmark :class="css.landingNav_wordmark" />

      <nav
        :class="css.landingNav_links"
        :aria-label="t(l.sections)"
      >
        <a
          v-for="link in links"
          :key="link.id"
          :class="css.landingNav_link"
          :href="`#${link.id}`"
          >{{ t(link.label) }}</a
        >
      </nav>

      <div :class="css.landingNav_actions">
        <a
          :class="[css.landingNav_link, css.landingNav_repository]"
          :href="REPOSITORY_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github
            :class="css.landingNav_icon"
            aria-hidden="true"
          />
          {{ t(l.repository) }}
        </a>
        <Button
          variant="light"
          size="lg"
          @click="emit('signIn')"
        >
          {{ t(l.signIn) }}
        </Button>
        <!-- A wrapper: the button's own `display` would win over a class on it. -->
        <span :class="css.landingNav_menuButton">
          <IconButton
            :icon="menuOpen ? X : Menu"
            :label="t(l.menu)"
            size="md"
            :aria-expanded="menuOpen"
            :aria-controls="menuId"
            @click="menuOpen = !menuOpen"
          />
        </span>
      </div>
    </div>

    <nav
      v-if="menuOpen"
      :id="menuId"
      :class="css.landingNav_menu"
      :aria-label="t(l.menu)"
    >
      <a
        v-for="link in links"
        :key="link.id"
        :class="css.landingNav_menuLink"
        :href="`#${link.id}`"
        @click="menuOpen = false"
        >{{ t(link.label) }}</a
      >
      <a
        :class="css.landingNav_menuLink"
        :href="REPOSITORY_URL"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Github
          :class="css.landingNav_icon"
          aria-hidden="true"
        />
        {{ t(l.repository) }}
      </a>
    </nav>
  </header>
</template>

<style lang="scss" module="css">
.landingNav {
  @include landing-gutter;

  border-bottom: 1px solid $color-border;

  @include landing-mobile {
    padding-block: 14px;
  }
}

.landingNav_bar {
  display: flex;
  gap: $spacing-24;
  align-items: center;
  justify-content: space-between;
  min-height: 68px;

  @include landing-mobile {
    min-height: 34px;
  }
}

.landingNav_wordmark {
  --wordmark-size: 20px;
}

.landingNav_links {
  display: flex;
  gap: 32px;
  align-items: center;

  @include landing-narrow {
    display: none;
  }
}

.landingNav_link {
  @include focus-ring;

  font-size: $font-size-lg;
  color: $color-fg-2;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}

.landingNav_actions {
  display: flex;
  gap: $spacing-12;
  align-items: center;

  @include landing-mobile {
    gap: $spacing-8;
  }
}

.landingNav_repository {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  padding: $spacing-8 $spacing-12;
  border-radius: $radius-lg;

  &:hover {
    background: $color-bg-3;
  }

  @include landing-narrow {
    display: none;
  }
}

.landingNav_icon {
  flex: none;
  width: 16px;
  height: 16px;
}

.landingNav_menuButton {
  display: none;

  @include landing-narrow {
    display: inline-flex;
  }
}

.landingNav_menu {
  display: none;
  flex-direction: column;
  padding-block: $spacing-8 $spacing-16;

  @include landing-narrow {
    display: flex;
  }
}

.landingNav_menuLink {
  @include focus-ring;

  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-10 0;
  font-size: $font-size-xl;
  color: $color-fg-2;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}
</style>
