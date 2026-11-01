<!-- One feature of the landing page (githq.pen "Landing — githq.dev", Feature 01–04): its number and kicker, a title, what it does and three points beside a screenshot of the app that fades into the page; side by side on a wide page — the screenshot on either side — and the screenshot under the text on a narrow one. The first time it scrolls into view the text fades up, the screenshot after it (`useReveal`); what the overlay animates keys off its `data-reveal`. -->
<script lang="ts">
import type { LucideIcon } from 'lucide-vue-next';

/** One of a feature's points: a line of text after an icon. */
export interface LandingFeaturePoint {
  icon: LucideIcon;
  text: string;
}
</script>

<script lang="ts" setup>
import { useId, useTemplateRef } from 'vue';

import { useReveal } from './useReveal.js';

withDefaults(
  defineProps<{
    /** "01". */
    number: string;
    /** "Instant": the word after the number, set in capitals. */
    kicker: string;
    /** May break into lines with `\n`. */
    title: string;
    body: string;
    /** What a `details` slot doesn't replace. */
    points?: readonly LandingFeaturePoint[];
    /** The screenshot: 1280×1120, twice the size the wide page shows it at, its top left the part that matters. */
    image: string;
    /** Empty when what the screenshot shows is described by what is laid over it. */
    imageAlt: string;
    /** The screenshot before the text on a wide page. */
    flip?: boolean;
  }>(),
  { points: () => [], flip: false },
);

defineSlots<{
  /** In place of the points (the keys of "Keyboard"). */
  details?(): unknown;
  /** Laid over the screenshot, under its fade; raise `z-index` to sit above it (a toast). */
  overlay?(): unknown;
}>();

const titleId = useId();
const reveal = useReveal(useTemplateRef<HTMLElement>('section'));
</script>

<template>
  <section
    ref="section"
    :class="[css.landingFeature, flip && css.landingFeature_flip]"
    :aria-labelledby="titleId"
    :data-reveal="reveal"
  >
    <div :class="css.landingFeature_copy">
      <p :class="css.landingFeature_eyebrow">
        <span :class="css.landingFeature_number">{{ number }}</span>
        <span
          :class="css.landingFeature_rule"
          aria-hidden="true"
        />
        <span :class="css.landingFeature_kicker">{{ kicker }}</span>
      </p>
      <h2
        :id="titleId"
        :class="css.landingFeature_title"
      >
        {{ title }}
      </h2>
      <p :class="css.landingFeature_body">{{ body }}</p>
      <slot name="details">
        <ul :class="css.landingFeature_points">
          <li
            v-for="(point, index) in points"
            :key="index"
            :class="css.landingFeature_point"
          >
            <component
              :is="point.icon"
              :class="css.landingFeature_pointIcon"
              aria-hidden="true"
            />
            {{ point.text }}
          </li>
        </ul>
      </slot>
    </div>

    <div :class="css.landingFeature_visual">
      <img
        :class="css.landingFeature_image"
        :src="image"
        width="1280"
        height="1120"
        loading="lazy"
        decoding="async"
        :alt="imageAlt"
      />
      <slot name="overlay" />
    </div>
  </section>
</template>

<style lang="scss" module="css">
.landingFeature {
  @include landing-gutter;

  display: flex;
  gap: 80px;
  align-items: center;
  padding-block: 100px;
  border-top: 1px solid $color-border;

  @include landing-narrow {
    flex-direction: column;
    gap: 36px;
    align-items: stretch;
  }

  @include landing-mobile {
    padding-block: 56px;
  }
}

// The text stays first for screen readers and the keyboard; only the picture moves.
.landingFeature_flip {
  flex-direction: row-reverse;

  @include landing-narrow {
    flex-direction: column;
  }
}

.landingFeature_copy {
  @include landing-reveal;

  display: flex;
  flex: none;
  flex-direction: column;
  gap: $spacing-24;
  width: 480px;

  @include landing-narrow {
    width: auto;
    max-width: $landing-visual-width;
  }

  @include landing-mobile {
    gap: 20px;
  }
}

.landingFeature_eyebrow {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
}

.landingFeature_number {
  color: $color-accent;
}

.landingFeature_rule {
  width: 24px;
  height: 1px;
  background: $color-border-2;
}

.landingFeature_kicker {
  color: $color-fg-2;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.landingFeature_title {
  font-family: $font-family-brand;
  font-size: clamp(32px, 3.06cqi, 44px);
  font-weight: $font-weight-semibold;
  line-height: 1.08;
  color: $color-fg;
  letter-spacing: -0.033em;
  white-space: pre-line;
}

.landingFeature_body {
  font-size: 17px;
  line-height: 1.6;
  color: $color-fg-2;

  @include landing-mobile {
    font-size: 16px;
  }
}

.landingFeature_points {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: $spacing-8 0 0;
  margin: 0;
  list-style: none;
}

.landingFeature_point {
  display: flex;
  gap: $spacing-12;
  align-items: flex-start;
  font-size: $font-size-xl;
  line-height: 1.45;
  color: $color-fg;
}

.landingFeature_pointIcon {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 3px;
  color: $color-accent;
}

// The app's window, cut to a box: its top left at the size the design shows it, the rest cropped or faded.
.landingFeature_visual {
  @include landing-reveal($landing-reveal-stagger);

  position: relative;
  flex: 1;
  min-width: 0;
  height: $landing-visual-height;
  overflow: hidden;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: $radius-landing-visual;
  box-shadow: $shadow-landing-visual;

  &::after {
    position: absolute;
    inset: auto 0 0;
    z-index: 1;
    height: 160px;
    pointer-events: none;
    content: '';
    background: linear-gradient(180deg, rgba($color-bg, 0), $color-bg);
  }

  @include landing-narrow {
    flex: none;
  }

  @include landing-mobile {
    height: $landing-visual-height-mobile;
  }
}

.landingFeature_image {
  display: block;
  width: max(100%, #{$landing-visual-width});
  max-width: none;
  height: auto;
}
</style>
