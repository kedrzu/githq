<!-- The command menu's way there (`Workflow / Command step`): the chip of what the actions act on, then a chip per level entered, an arrow between them — before the menu's field, or alone over a form. -->
<script lang="ts">
import type { LucideIcon } from 'lucide-vue-next';

/** A chip of {@link CommandCrumbs}. */
export interface CommandCrumb {
  /** Unique among the crumbs. */
  readonly key: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  /** Dim text after the label (the repository a workflow runs in). */
  readonly detail?: string;
  /** An arrow before it. */
  readonly arrow?: boolean;
  /** Its icon in green: what the actions act on (an item, a selection, a repository). */
  readonly subject?: boolean;
}
</script>

<script lang="ts" setup>
import { ChevronRight } from 'lucide-vue-next';

defineProps<{
  crumbs: readonly CommandCrumb[];
}>();
</script>

<template>
  <template
    v-for="crumb in crumbs"
    :key="crumb.key"
  >
    <ChevronRight
      v-if="crumb.arrow"
      :class="css.commandCrumbs_arrow"
      aria-hidden="true"
    />
    <span :class="css.commandCrumbs_chip">
      <component
        :is="crumb.icon"
        v-if="crumb.icon"
        :class="[css.commandCrumbs_icon, crumb.subject && css.commandCrumbs_icon_subject]"
        aria-hidden="true"
      />
      {{ crumb.label }}
      <span
        v-if="crumb.detail"
        :class="css.commandCrumbs_detail"
        >{{ crumb.detail }}</span
      >
    </span>
  </template>
</template>

<style lang="scss" module="css">
.commandCrumbs_chip {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  padding: 3px $spacing-8;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: $radius-md;
}

.commandCrumbs_icon {
  width: 13px;
  height: 13px;
  color: $color-fg-2;
}

.commandCrumbs_icon_subject {
  width: 12px;
  height: 12px;
  color: $color-green;
}

.commandCrumbs_detail {
  color: $color-fg-2;
}

.commandCrumbs_arrow {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}
</style>
