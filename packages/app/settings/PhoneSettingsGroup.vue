<!-- A group of rows in Settings on a phone (mobile MB146–MB161): its name in small grey letters above the rows ("Tracking", "Organisations"), what the group is about under its name and the rows (`PhoneSettingsRow`, `PhoneSettingsSwitchRow`, …) in the default slot. A region named by its name. -->
<script lang="ts" setup>
import { useId } from 'vue';

defineProps<{
  /** None for a group the screen's head already names. */
  title?: string;
  /** What the group is about, under its name and above the rows. */
  description?: string;
}>();

defineSlots<{
  /** The rows; `titleId` names a group of controls by the group's name (a radio group). */
  default(props: { titleId: string }): unknown;
}>();

const titleId = useId();
</script>

<template>
  <section
    :class="css.phoneSettingsGroup"
    :aria-labelledby="title ? titleId : undefined"
  >
    <h2
      v-if="title"
      :id="titleId"
      :class="css.phoneSettingsGroup_title"
    >
      {{ title }}
    </h2>
    <p
      v-if="description"
      :class="css.phoneSettingsGroup_description"
    >
      {{ description }}
    </p>
    <slot :title-id="titleId" />
  </section>
</template>

<style lang="scss" module="css">
.phoneSettingsGroup {
  display: flex;
  flex-direction: column;
  padding: $spacing-12 0 $spacing-8;
}

.phoneSettingsGroup_title {
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 0 $spacing-16;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.phoneSettingsGroup_description {
  padding: 0 $spacing-16 $spacing-6;
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}
</style>
