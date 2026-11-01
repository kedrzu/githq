<!-- A text with parts of it marked: the letters typed text matched, in the accent. It adds nothing around them, so the text reads, and a row is named, as without the marks. -->
<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
  text: string;
  /** The parts to mark, as offsets `[start, end, start, end…]`; `null` marks nothing. */
  ranges: readonly number[] | null;
}>();

const parts = computed(() => {
  const ranges = props.ranges ?? [];
  const result: { text: string; marked: boolean }[] = [];
  let at = 0;
  for (let index = 0; index + 1 < ranges.length; index += 2) {
    const start = ranges[index] ?? at;
    const end = ranges[index + 1] ?? start;
    if (start > at) {
      result.push({ text: props.text.slice(at, start), marked: false });
    }

    result.push({ text: props.text.slice(start, end), marked: true });
    at = end;
  }

  if (at < props.text.length) {
    result.push({ text: props.text.slice(at), marked: false });
  }

  return result;
});
</script>

<template>
  <span>
    <template
      v-for="(part, index) in parts"
      :key="index"
    >
      <mark
        v-if="part.marked"
        :class="css.matchedText_mark"
        >{{ part.text }}</mark
      >
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<style lang="scss" module="css">
.matchedText_mark {
  font-weight: normal;
  color: $color-accent;
  background: none;
}
</style>
