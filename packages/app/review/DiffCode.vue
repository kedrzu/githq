<!-- A line's code: its text as it is, coloured by its tokens once they arrive. The colours are all a token changes that can be seen: its spans round the line's width differently, by 1/64 px at most per span (D7). Find's matches are marked over the colours (D47), each one mark over the tokens it covers, the current one outlined; a mark changes no more than a token does. -->
<script lang="ts">
import type { LineMark } from './find/RowMarks.js';

const NO_MARKS: readonly LineMark[] = [];
</script>

<script lang="ts" setup>
import { computed } from 'vue';

import { getLineSpans } from './syntax/getLineSpans.js';
import type { LineTokens } from './syntax/getLineSpans.js';
import { markLineSpans } from './syntax/markLineSpans.js';

const props = defineProps<{
  text: string;
  tokens: LineTokens | null;
  /** Its 0-based place in `tokens`. */
  line: number;
  /** Find's matches in the text (D47), sorted. */
  marks?: readonly LineMark[];
}>();

const stretches = computed(() =>
  markLineSpans(getLineSpans(props.text, props.tokens, props.line), props.marks ?? NO_MARKS),
);
</script>

<template>
  <code :class="css.diffCode"
    ><template
      v-for="(stretch, stretchIndex) in stretches"
      :key="stretchIndex"
      ><mark
        v-if="stretch.mark"
        :class="[css.diffCode_mark, stretch.mark === 'current' && css.diffCode_mark_current]"
        :data-current-match="stretch.mark === 'current' ? '' : undefined"
        ><span
          v-for="(span, index) in stretch.spans"
          :key="index"
          :class="span.kind && css[`diffCode_${span.kind}`]"
          :tid="span.kind ? `code-${span.kind}` : undefined"
          >{{ span.text }}</span
        ></mark
      ><template v-else
        ><span
          v-for="(span, index) in stretch.spans"
          :key="index"
          :class="span.kind && css[`diffCode_${span.kind}`]"
          :tid="span.kind ? `code-${span.kind}` : undefined"
          >{{ span.text }}</span
        ></template
      ></template
    ></code
  >
</template>

<style lang="scss" module="css">
.diffCode {
  min-width: 0;
  font-family: $font-family-mono;
  font-variant-ligatures: none;
  font-size: $font-size-code;
  line-height: $line-height-code;
  tab-size: 4;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

// No room of its own (D7): the outline is drawn inside, over the text's own box, which no padding or border widens.
.diffCode_mark {
  color: inherit;
  background: $color-find-match;
  border-radius: 2px;
  // Its fill and its ring reach a little past the word, drawn outside its box, so the line's width doesn't change (D7).
  box-shadow:
    0 0 0 2px $color-find-match,
    0 0 0 3px $color-find-match-ring;
  box-decoration-break: clone;
}

.diffCode_mark_current {
  background: $color-find-match-current;
  box-shadow:
    0 0 0 2px $color-find-match-current,
    0 0 0 3px $color-find-match-outline;
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
