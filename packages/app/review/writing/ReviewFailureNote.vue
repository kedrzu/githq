<!-- Why a write in a review didn't go through, in red under what it was about: a comment box or a thread. -->
<script lang="ts" setup>
import { CircleAlert } from 'lucide-vue-next';

defineProps<{
  text: string;
}>();
</script>

<template>
  <p
    :class="css.reviewFailureNote"
    role="alert"
  >
    <CircleAlert
      :class="css.reviewFailureNote_icon"
      aria-hidden="true"
    />
    {{ text }}
  </p>
</template>

<style lang="scss" module="css">
.reviewFailureNote {
  display: flex;
  gap: $spacing-6;
  align-items: baseline;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-red;
  overflow-wrap: anywhere;
}

.reviewFailureNote_icon {
  flex: none;
  align-self: center;
  width: 13px;
  height: 13px;
}
</style>
