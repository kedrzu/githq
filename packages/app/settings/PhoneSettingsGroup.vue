<!-- A group of rows in Settings on a phone (mobile MB146–MB161): its name in small grey letters above the rows ("Tracking", "Organisations"), an optional action at the name's right ("Track more"), what the group is about under its name, the rows (`PhoneSettingsRow`, `PhoneSettingsSwitchRow`, …) in the default slot and a grey note under them. A region named by its name. -->
<script lang="ts" setup>
import { useId } from 'vue';

defineProps<{
  /** None for a group the screen's head already names. */
  title?: string;
  /** What the group is about, under its name and above the rows. */
  description?: string;
  /** What the rows mean, under them. */
  note?: string;
}>();

defineSlots<{
  /** The rows; `titleId` names a group of controls by the group's name (a radio group). */
  default(props: { titleId: string }): unknown;
  /** At the name's right: a text link ("Track more"). */
  action?(): unknown;
}>();

const titleId = useId();
</script>

<template>
  <section
    :class="css.phoneSettingsGroup"
    :aria-labelledby="title ? titleId : undefined"
  >
    <div
      v-if="title || $slots.action"
      :class="css.phoneSettingsGroup_head"
    >
      <h2
        v-if="title"
        :id="titleId"
        :class="css.phoneSettingsGroup_title"
      >
        {{ title }}
      </h2>
      <div
        v-if="$slots.action"
        :class="css.phoneSettingsGroup_action"
      >
        <slot name="action" />
      </div>
    </div>
    <p
      v-if="description"
      :class="css.phoneSettingsGroup_description"
    >
      {{ description }}
    </p>
    <slot :title-id="titleId" />
    <p
      v-if="note"
      :class="css.phoneSettingsGroup_note"
    >
      {{ note }}
    </p>
  </section>
</template>

<style lang="scss" module="css">
.phoneSettingsGroup {
  display: flex;
  flex-direction: column;
  padding: $spacing-12 0 $spacing-8;
}

.phoneSettingsGroup_head {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 28px;
  padding: 0 $spacing-16;
}

.phoneSettingsGroup_title {
  flex: 1;
  min-width: 0;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.phoneSettingsGroup_action {
  flex: none;
  margin-left: auto;
}

.phoneSettingsGroup_description {
  padding: 0 $spacing-16 $spacing-6;
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.phoneSettingsGroup_note {
  padding: $spacing-4 $spacing-16 0;
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}
</style>
