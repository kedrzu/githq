<!-- A section of a repository's or a project's settings (`Settings / Section`, T16, T17): under a rule, its name and what it changes on the left, its controls on the right. Sections stack, so a new setting is one more of these. -->
<script lang="ts" setup>
defineProps<{
  title: string;
  /** What the section changes. */
  description: string;
}>();

defineSlots<{
  /** The section's controls. */
  default(): unknown;
}>();
</script>

<template>
  <section :class="css.settingsBlock">
    <div :class="css.settingsBlock_about">
      <h2 :class="css.settingsBlock_title">{{ title }}</h2>
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
  flex: 0 1 640px;
  flex-direction: column;
  min-width: 0;
}
</style>
