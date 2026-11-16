<!-- A section of a repository's or a project's settings (`Settings / Section`, T16, T17): under a rule, its name and what it changes on the left, its controls on the right. Sections stack, so a new setting is one more of these. On a phone (`phone`) its name and what it changes above its controls, at a phone's margins. -->
<script lang="ts" setup>
import { useId } from 'vue';

defineProps<{
  title: string;
  /** What the section changes. */
  description: string;
  /** On a phone: the name and text above the controls. */
  phone?: boolean;
}>();

defineSlots<{
  /** The section's controls. */
  default(): unknown;
}>();

// Named by its title: a region the keys and assistive technology can find.
const titleId = useId();
</script>

<template>
  <section
    :class="[css.settingsBlock, phone && css.settingsBlock_phone]"
    :aria-labelledby="titleId"
  >
    <div :class="css.settingsBlock_about">
      <h2
        :id="titleId"
        :class="css.settingsBlock_title"
      >
        {{ title }}
      </h2>
      <p :class="css.settingsBlock_description">{{ description }}</p>
    </div>
    <div :class="css.settingsBlock_content">
      <slot />
    </div>
  </section>
</template>

<style lang="scss" module="css">
.settingsBlock {
  display: flex;
  gap: 40px;
  padding: 20px 0;
  border-top: 1px solid $color-border;
}

.settingsBlock.settingsBlock_phone {
  flex-direction: column;
  gap: $spacing-12;
  padding: $spacing-16;

  .settingsBlock_about {
    width: auto;
  }

  .settingsBlock_content {
    flex: none;
  }
}

.settingsBlock_about {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: $spacing-6;
  width: 280px;
}

.settingsBlock_title {
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
}

.settingsBlock_description {
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.settingsBlock_content {
  display: flex;
  flex: 1 1 640px;
  flex-direction: column;
  min-width: 0;
}
</style>
