<!-- One card of the landing page's details bento (githq.pen "Landing — githq.dev", Details bento): an icon, a title and what it means; a wide card draws something of its own under the text. The bento sizes it. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

defineProps<{
  icon: LucideIcon;
  title: string;
  body: string;
}>();

defineSlots<{
  /** Under the text, at the card's bottom (the two addresses of "Swap the host"). */
  default?(): unknown;
}>();
</script>

<template>
  <li :class="css.landingDetail">
    <div :class="css.landingDetail_content">
      <component
        :is="icon"
        :class="css.landingDetail_icon"
        aria-hidden="true"
      />
      <h3 :class="css.landingDetail_title">{{ title }}</h3>
      <p :class="css.landingDetail_body">{{ body }}</p>
    </div>
    <slot />
  </li>
</template>

<style lang="scss" module="css">
.landingDetail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: space-between;
  min-width: 0;
  padding: 32px;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-landing-visual;

  @include landing-mobile {
    padding: $spacing-24;
  }
}

.landingDetail_content {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
}

.landingDetail_icon {
  width: 22px;
  height: 22px;
  color: $color-fg-2;
}

.landingDetail_title {
  font-family: $font-family-brand;
  font-size: 22px;
  font-weight: $font-weight-semibold;
  line-height: 1.3;
  color: $color-fg;
  letter-spacing: -0.018em;

  @include landing-mobile {
    font-size: 20px;
    letter-spacing: -0.02em;
  }
}

.landingDetail_body {
  font-size: $font-size-xl;
  line-height: 1.55;
  color: $color-fg-2;
}
</style>
