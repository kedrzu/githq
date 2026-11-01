<!-- How far something is, as a thin bar: the accent while it goes on, green once it is done. Its text (what and how much) sits beside it; the bar carries the same as a progress bar for screen readers. -->
<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
  /** How much is done, 0–1; `null` while not known yet (an empty bar). */
  value: number | null;
  /** What the bar measures ("skyline-labs/portal"). */
  label: string;
}>();

const percent = computed(() => (props.value === null ? null : Math.round(Math.min(Math.max(props.value, 0), 1) * 100)));
</script>

<template>
  <div
    :class="css.progressBar"
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="percent ?? undefined"
  >
    <div
      :class="[css.progressBar_fill, percent === 100 && css.progressBar_fill_done]"
      :style="{ width: `${percent ?? 0}%` }"
    />
  </div>
</template>

<style lang="scss" module="css">
.progressBar {
  height: 4px;
  overflow: hidden;
  background: $color-bg-3;
  border-radius: 2px;
}

.progressBar_fill {
  height: 100%;
  background: $color-accent;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progressBar_fill_done {
  background: $color-green;
}
</style>
