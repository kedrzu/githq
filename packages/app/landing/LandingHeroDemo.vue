<!-- The hero's picture of the app: a still of My work, the page's first image and what the prerendered page shows, then — once the page has loaded, when it is large enough to read and without reduced motion — a recording of githq in use (`bun run demo:landing`), laid over the still it starts on, looping, with a button under it to pause it. -->
<script lang="ts" setup>
import { NuxtImg } from '#components';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Pause, Play } from 'lucide-vue-next';
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

import * as l from './LandingHeroDemo.loc.js';
import { prefersReducedMotion } from './prefersReducedMotion.js';

/**
 * Where the recording is: `off` — none, the still alone (the prerendered page, a phone, reduced motion); `loading` —
 * fetching, still hidden; `playing`; `paused` by the visitor.
 */
type DemoState = 'off' | 'loading' | 'playing' | 'paused';

/**
 * The narrowest the picture is with the recording, in CSS pixels: smaller — a phone, where it shows the still's left
 * part — the recording's text is too small to follow, and not worth its megabyte.
 */
const MIN_WIDTH = 600;

const t = useTranslate();
const state = ref<DemoState>('off');
const shot = useTemplateRef<HTMLElement>('shot');
const video = useTemplateRef<HTMLVideoElement>('video');

onMounted(() => {
  if (prefersReducedMotion() || (shot.value?.clientWidth ?? 0) < MIN_WIDTH) {
    return;
  }

  // After everything the page needs, so the recording never competes with the still, the page's first image.
  if (document.readyState === 'complete') {
    load();
  } else {
    window.addEventListener('load', load, { once: true });
  }
});

onBeforeUnmount(() => window.removeEventListener('load', load));

function load() {
  state.value = 'loading';
}

function toggle() {
  if (!video.value) {
    return;
  }

  if (state.value === 'paused') {
    void video.value.play();
  } else {
    video.value.pause();
    state.value = 'paused';
  }
}
</script>

<template>
  <div :class="css.landingHeroDemo">
    <div
      ref="shot"
      :class="css.landingHeroDemo_shot"
    >
      <NuxtImg
        :class="css.landingHeroDemo_still"
        src="/landing/hero.webp"
        width="2400"
        height="1500"
        sizes="320:134vw 720:84vw 1080:84vw 1440:1200px"
        fetchpriority="high"
        :alt="t(l.alt)"
      />
      <video
        v-if="state !== 'off'"
        ref="video"
        :class="[css.landingHeroDemo_video, state !== 'loading' && css.landingHeroDemo_video_shown]"
        muted
        autoplay
        loop
        playsinline
        disablepictureinpicture
        disableremoteplayback
        aria-hidden="true"
        @playing="state = 'playing'"
      >
        <source
          src="/landing/hero.av1.mp4"
          type='video/mp4; codecs="av01.0.12M.08"'
        />
        <source
          src="/landing/hero.mp4"
          type='video/mp4; codecs="avc1.640033"'
        />
      </video>
    </div>

    <button
      v-if="state === 'playing' || state === 'paused'"
      type="button"
      :class="css.landingHeroDemo_toggle"
      @click="toggle"
    >
      <component
        :is="state === 'paused' ? Play : Pause"
        :class="css.landingHeroDemo_toggleIcon"
        aria-hidden="true"
      />
      {{ t(state === 'paused' ? l.play : l.pause) }}
    </button>
  </div>
</template>

<style lang="scss" module="css">
.landingHeroDemo {
  position: relative;
  width: 100%;
}

.landingHeroDemo_shot {
  position: relative;
  width: 100%;
  overflow: hidden;
  border: 1px solid $color-border-2;
  border-radius: 14px;
  box-shadow:
    0 40px 120px rgb(0 0 0 / 80%),
    0 -10px 90px rgba($color-accent, 0.2);

  // Once, as the page opens: no state and no script, so the prerendered page plays it too, and where it does not
  // play the still simply stands in place. Starts visible, so the page's first image is painted at once.
  @media (prefers-reduced-motion: no-preference) {
    animation: hero-rise-in $landing-motion-duration ease-out;
  }

  @include landing-mobile {
    aspect-ratio: 350 / 292;
    border-radius: 12px;
  }
}

.landingHeroDemo_still {
  display: block;
  width: 100%;
  height: auto;

  // A phone shows the list's left part, larger, instead of the whole window shrunk.
  @include landing-mobile {
    height: 100%;
    object-fit: cover;
    object-position: left top;
  }
}

// Over the still it starts on, so the swap shows nothing; hidden until it plays, so a recording that never loads
// leaves the still alone.
.landingHeroDemo_video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 200ms ease-out;

  // Cut as the still is.
  @include landing-mobile {
    object-fit: cover;
    object-position: left top;
  }
}

.landingHeroDemo_video_shown {
  opacity: 1;
}

// In the hero's room under the picture, out of the flow: it comes once the recording plays, and moves nothing.
.landingHeroDemo_toggle {
  @include focus-ring;

  position: absolute;
  top: calc(100% + #{$spacing-12});
  left: 50%;
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  padding: $spacing-4 $spacing-8;
  font-size: $font-size-sm;
  color: $color-fg-2;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-sm;
  translate: -50% 0;

  &:hover {
    color: $color-fg;
  }
}

.landingHeroDemo_toggleIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

@keyframes hero-rise-in {
  from {
    opacity: 0.4;
    transform: translateY(16px);
  }
}
</style>
