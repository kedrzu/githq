<!-- A bordered panel of a submodule block holding one of its lists, commits or files: a head with the list's icon, its title (which names the list) and its count, the rows, and a foot with Show more when rows are held back and a quiet note when GitHub listed fewer than there are. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';
import { ChevronDown } from 'lucide-vue-next';
import { useId } from 'vue';

import Button from '@/components/Button.vue';

defineProps<{
  icon: LucideIcon;
  title: string;
  /** How many there are, in the head's corner. */
  count: string;
  /** Show more's label, when rows are held back. */
  showMore: string | null;
  /** That GitHub listed fewer than there are. */
  note: string | null;
}>();

defineEmits<{
  /** Show more was pressed. */
  expand: [];
}>();

defineSlots<{
  /** The rows, each an `<li>`. */
  default(): unknown;
}>();

const id = useId();
</script>

<template>
  <div :class="css.reviewSubmodulePanel">
    <div :class="css.reviewSubmodulePanel_head">
      <component
        :is="icon"
        :class="css.reviewSubmodulePanel_icon"
        aria-hidden="true"
      />
      <span
        :id="`${id}-title`"
        :class="css.reviewSubmodulePanel_title"
        >{{ title }}</span
      >
      <span :class="css.reviewSubmodulePanel_count">{{ count }}</span>
    </div>
    <ul
      :class="css.reviewSubmodulePanel_rows"
      :aria-labelledby="`${id}-title`"
    >
      <slot />
    </ul>
    <div
      v-if="showMore !== null || note !== null"
      :class="css.reviewSubmodulePanel_foot"
    >
      <Button
        v-if="showMore !== null"
        variant="ghost"
        size="sm"
        :icon="ChevronDown"
        @click="$emit('expand')"
      >
        {{ showMore }}
      </Button>
      <p
        v-if="note !== null"
        :class="css.reviewSubmodulePanel_note"
      >
        {{ note }}
      </p>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewSubmodulePanel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}

.reviewSubmodulePanel_head {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-12;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;
}

.reviewSubmodulePanel_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.reviewSubmodulePanel_title {
  flex: 1;
  min-width: 0;
  font-weight: $font-weight-semibold;
}

.reviewSubmodulePanel_count {
  flex: none;
  color: $color-fg-2;
}

.reviewSubmodulePanel_rows {
  display: flex;
  flex-direction: column;
  padding: $spacing-6 $spacing-12;
  margin: 0;
  list-style: none;
}

.reviewSubmodulePanel_foot {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4 $spacing-12;
  align-items: center;
  padding: $spacing-4 $spacing-6;
  border-top: 1px solid $color-border;
}

.reviewSubmodulePanel_note {
  padding: $spacing-4 $spacing-6;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-fg-2;
}
</style>
