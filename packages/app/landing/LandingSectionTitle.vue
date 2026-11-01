<!-- The title of a landing page section below the features (githq.pen "Landing — githq.dev", Details bento, Comparison, Open source): a violet eyebrow in capitals over a large two-line heading. -->
<script lang="ts" setup>
defineProps<{
  /** "The details": set in capitals. */
  eyebrow: string;
  /**
   * The heading's lines, each on a line of its own where it fits. Not one text with `\n`: the translations keep a
   * short word with the next one, so a break after "up" would be lost.
   */
  lines: readonly string[];
  /** The heading's id, for the section's `aria-labelledby`. */
  headingId: string;
}>();
</script>

<template>
  <div :class="css.landingSectionTitle">
    <p :class="css.landingSectionTitle_eyebrow">{{ eyebrow }}</p>
    <h2
      :id="headingId"
      :class="css.landingSectionTitle_heading"
    >
      <span
        v-for="(line, index) in lines"
        :key="index"
        :class="css.landingSectionTitle_line"
        >{{ line }}</span
      >
    </h2>
  </div>
</template>

<style lang="scss" module="css">
.landingSectionTitle {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.landingSectionTitle_eyebrow {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-accent;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.landingSectionTitle_line {
  display: block;
}

.landingSectionTitle_heading {
  max-width: 820px;
  font-family: $font-family-brand;
  font-size: clamp(30px, 3.61cqi, 52px);
  font-weight: $font-weight-semibold;
  line-height: 1.05;
  color: $color-fg;
  letter-spacing: -0.035em;

  @include landing-mobile {
    line-height: 1.08;
    letter-spacing: -0.03em;
  }
}
</style>
