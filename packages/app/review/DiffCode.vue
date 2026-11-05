<!-- A line's code: its text as it is, coloured by its tokens once they arrive. The colours are all a token changes that can be seen: its spans round the line's width differently, by 1/64 px at most per span (D7). -->
<script lang="ts" setup>
import { computed } from 'vue';

import { getLineSpans } from './syntax/getLineSpans.js';
import type { LineTokens } from './syntax/getLineSpans.js';

const props = defineProps<{
  text: string;
  tokens: LineTokens | null;
  /** Its 0-based place in `tokens`. */
  line: number;
}>();

const spans = computed(() => getLineSpans(props.text, props.tokens, props.line));
</script>

<template>
  <code :class="css.diffCode"
    ><span
      v-for="(span, index) in spans"
      :key="index"
      :class="span.kind && css[`diffCode_${span.kind}`]"
      :tid="span.kind ? `code-${span.kind}` : undefined"
      >{{ span.text }}</span
    ></code
  >
</template>

<style lang="scss" module="css">
.diffCode {
  min-width: 0;
  font-family: $font-family-mono;
  font-variant-ligatures: none;
  font-size: $font-size-xs;
  line-height: 20px;
  tab-size: 4;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.diffCode_comment {
  color: $color-syntax-comment;
}

.diffCode_keyword {
  color: $color-syntax-keyword;
}

.diffCode_string {
  color: $color-syntax-string;
}

.diffCode_constant {
  color: $color-syntax-constant;
}

.diffCode_title {
  color: $color-syntax-title;
}

.diffCode_tag {
  color: $color-syntax-tag;
}

.diffCode_builtin {
  color: $color-syntax-builtin;
}
</style>
