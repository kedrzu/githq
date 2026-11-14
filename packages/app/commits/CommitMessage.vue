<!-- A commit's message body as light formatting over plain text: paragraphs that keep the author's line breaks, bulleted lists with hanging bullets and a quiet closing block of trailers (`Co-Authored-By: …`). Never Markdown or HTML: `#566`, `**x**` and `<b>` stay as typed. -->
<script lang="ts" setup>
import { computed } from 'vue';

import { parseCommitMessage } from './parseCommitMessage.js';

const props = defineProps<{
  body: string;
}>();

const blocks = computed(() => parseCommitMessage(props.body));
</script>

<template>
  <div :class="css.commitMessage">
    <template
      v-for="(block, index) in blocks"
      :key="index"
    >
      <ul
        v-if="block.kind === 'list'"
        :class="css.commitMessage_list"
      >
        <li
          v-for="(item, itemIndex) in block.items"
          :key="itemIndex"
          :class="css.commitMessage_item"
        >
          {{ item }}
        </li>
      </ul>
      <p
        v-else
        :class="[css.commitMessage_paragraph, block.kind === 'trailers' && css.commitMessage_trailers]"
      >
        {{ block.lines.join('\n') }}
      </p>
    </template>
  </div>
</template>

<style lang="scss" module="css">
.commitMessage {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: $font-size-lg;
  line-height: 1.6;
  color: $color-fg;
  overflow-wrap: anywhere;
}

.commitMessage_paragraph {
  margin: 0;
  white-space: pre-wrap;
}

.commitMessage_trailers {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commitMessage_list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.commitMessage_item {
  position: relative;
  padding-left: 16px;

  &::before {
    content: '•';
    position: absolute;
    left: 4px;
    color: $color-fg-dim;
  }
}
</style>
