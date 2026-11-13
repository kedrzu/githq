<!-- A boolean setting as a framed card (`Settings / Toggle card`): its title and what it does on the left, a `Switch` in the top-right corner on the title's line, and optionally a link to read more under the text. The Switch is the one control, named by the title and described by the text; the rest of the card is its hit area (the Switch's stretched `::after`), so a click anywhere flips it but on the link, which sits above and only opens. Keyboard focus on the Switch rings the whole card. -->
<script lang="ts">
/** The link under a toggle card's text, to a page outside the app. */
export interface SettingsToggleCardLink {
  label: string;
  href: string;
}
</script>

<script lang="ts" setup>
import { ArrowUpRight } from 'lucide-vue-next';
import { useId } from 'vue';

import Switch from '@/components/Switch.vue';

defineProps<{
  title: string;
  /** What the setting does: the Switch's description too. */
  description: string;
  /** A page saying more, opened in a new tab. */
  link?: SettingsToggleCardLink;
}>();

const on = defineModel<boolean>({ required: true });

const id = useId();
</script>

<template>
  <section :class="css.settingsToggleCard">
    <div :class="css.settingsToggleCard_text">
      <h2 :class="css.settingsToggleCard_title">{{ title }}</h2>
      <p
        :id="`${id}-description`"
        :class="css.settingsToggleCard_description"
      >
        {{ description }}
      </p>
      <a
        v-if="link"
        :class="css.settingsToggleCard_link"
        :href="link.href"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ link.label }}
        <ArrowUpRight
          :class="css.settingsToggleCard_linkIcon"
          aria-hidden="true"
        />
      </a>
    </div>
    <Switch
      v-model="on"
      :label="title"
      :aria-describedby="`${id}-description`"
      :class="css.settingsToggleCard_switch"
    />
  </section>
</template>

<style lang="scss" module="css">
.settingsToggleCard {
  position: relative;
  display: flex;
  gap: $spacing-16;
  align-items: flex-start;
  padding: $spacing-12 $spacing-14;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &:hover {
    border-color: $color-border-2;
  }

  // Focus on the Switch rings the card, in place of the Switch's own ring; focus on the link keeps the link's.
  &:has(.settingsToggleCard_switch:focus-visible) {
    outline: 2px solid $color-focus;
    outline-offset: 1px;
  }
}

.settingsToggleCard_text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
}

.settingsToggleCard_title {
  font-size: $font-size-row-title;
  font-weight: $font-weight-medium;
}

.settingsToggleCard_description {
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.settingsToggleCard_link {
  @include focus-ring;

  position: relative;
  z-index: 1;
  display: inline-flex;
  gap: 5px;
  align-items: center;
  align-self: flex-start;
  font-size: $font-size-sm;
  color: $color-accent;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    text-decoration: underline;
  }
}

.settingsToggleCard_linkIcon {
  flex: none;
  width: 13px;
  height: 13px;
}

.settingsToggleCard .settingsToggleCard_switch {
  // The card's whole frame is the Switch's hit area.
  &::after {
    position: absolute;
    inset: 0;
    content: '';
    border-radius: $radius-lg;
  }

  &:focus-visible {
    outline: none;
  }
}
</style>
