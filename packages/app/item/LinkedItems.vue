<!-- Items an opened item links to, as small rows under a heading ("Closes"): state, title, number — the repository too when it is another — and the first project's "Status" with "+N" (D12). Picking one opens it in the same arrangement. -->
<script lang="ts" setup>
import { CircleDot, GitPullRequest, SquareKanban } from 'lucide-vue-next';

import Button from '@/components/Button.vue';
import type { Item } from '@/store/ItemTypes.js';

import { getItemReference } from './itemRoutes.js';
import type { ItemReference } from './itemRoutes.js';

defineProps<{
  title: string;
  items: readonly Item[];
  /** The opened item's repository: links within it show their number alone. */
  repository: string;
}>();

const emit = defineEmits<{
  open: [reference: ItemReference];
}>();
</script>

<template>
  <section
    v-if="items.length > 0"
    :class="css.linkedItems"
  >
    <h2 :class="css.linkedItems_title">{{ title }}</h2>
    <ul :class="css.linkedItems_list">
      <li
        v-for="linked in items"
        :key="linked.id"
        :class="css.linkedItems_row"
      >
        <component
          :is="linked.kind === 'issue' ? CircleDot : GitPullRequest"
          :class="[css.linkedItems_icon, linked.state !== 'OPEN' && css.linkedItems_icon_closed]"
          aria-hidden="true"
        />
        <Button
          variant="link"
          :class="css.linkedItems_link"
          @click="emit('open', getItemReference(linked))"
        >
          {{ linked.title }}
        </Button>
        <span :class="css.linkedItems_reference">{{
          linked.repository.nameWithOwner === repository
            ? `#${linked.number}`
            : `${linked.repository.nameWithOwner}#${linked.number}`
        }}</span>
        <span :class="css.linkedItems_spacer" />
        <span
          v-if="linked.projects[0]?.status"
          :class="css.linkedItems_field"
        >
          <SquareKanban
            :class="css.linkedItems_fieldIcon"
            aria-hidden="true"
          />
          {{ linked.projects[0].status.name }}
          <template v-if="linked.projects.length > 1">+{{ linked.projects.length - 1 }}</template>
        </span>
      </li>
    </ul>
  </section>
</template>

<style lang="scss" module="css">
.linkedItems {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.linkedItems_title {
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.linkedItems_list {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding: 0;
  margin: 0;
  list-style: none;
}

.linkedItems_row {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-10;
  font-size: $font-size-sm;
  white-space: nowrap;
  background: $color-bg-3;
  border-radius: $radius-lg;
}

.linkedItems_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-green;
}

.linkedItems_icon_closed {
  color: $color-purple;
}

.linkedItems_link {
  min-width: 0;
  overflow: hidden;
  color: $color-fg;
  text-overflow: ellipsis;
}

.linkedItems_reference {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.linkedItems_spacer {
  flex: 1;
}

.linkedItems_field {
  display: inline-flex;
  flex: none;
  gap: 5px;
  align-items: center;
  font-size: $font-size-2xs;
  color: $color-fg-2;
}

.linkedItems_fieldIcon {
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}
</style>
