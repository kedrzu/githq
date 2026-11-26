<!-- One role of the typography (`Settings / Typography card`, T28): a framed card with the role's name and what it sets, its controls in a row (`controls`), then under a rule a sample of the text it sets (`sample`). A region named by its title. -->
<script lang="ts" setup>
import { useId } from 'vue';

defineProps<{
  title: string;
  /** What text the role sets. */
  description: string;
}>();

defineSlots<{
  /** The role's font select and steppers. */
  controls(): unknown;
  /** Text in the role's chosen font, size and line height. */
  sample(): unknown;
}>();

const titleId = useId();
</script>

<template>
  <section
    :class="css.typographyCard"
    :aria-labelledby="titleId"
  >
    <h3
      :id="titleId"
      :class="css.typographyCard_title"
    >
      {{ title }}
    </h3>
    <p :class="css.typographyCard_description">{{ description }}</p>
    <div :class="css.typographyCard_controls">
      <slot name="controls" />
    </div>
    <div :class="css.typographyCard_sample">
      <slot name="sample" />
    </div>
  </section>
</template>

<style lang="scss" module="css">
.typographyCard {
  display: flex;
  flex-direction: column;
  padding: $spacing-12 $spacing-14 $spacing-14;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}

.typographyCard_title {
  font-size: $font-size-row-title;
  font-weight: $font-weight-medium;
}

.typographyCard_description {
  margin-top: $spacing-6;
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.typographyCard_controls {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-12 $spacing-16;
  margin-top: $spacing-16;
}

.typographyCard_sample {
  min-width: 0;
  padding-top: $spacing-14;
  margin-top: $spacing-14;
  border-top: 1px solid $color-border;
}
</style>
