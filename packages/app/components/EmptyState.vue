<!-- A list with nothing in it, said calmly (K4, K5; first run and loading D8, `Empty / Note · screen | group | column`): on a screen the Workflows look — a large thin icon, its tone the only colour (grey, green when empty is good news, amber when it can't be read, red when something is broken), a title, a line saying what was checked so "empty" can be trusted, optionally a technical fact in a mono chip, and the ways on in a row; in a list's group one quiet line under its header; in a board column a small centred note. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    /** Optional only in a group or a column, where a plain "Nothing here." has none. */
    icon?: LucideIcon;
    /**
     * The icon's colour, everything else stays grey. `muted`: just nothing here, or filtered out (the design's one
     * quiet grey); `good`: nothing left is good news (green); `warning`: it can't be read (amber, as the status bar's
     * stale states); `broken`: something failed (red).
     */
    tone?: 'broken' | 'good' | 'muted' | 'warning';
    /** In a group or a column, the one line it says. */
    title: string;
    /** Drawn on a screen only. */
    detail?: string;
    /** A technical fact in a mono chip, on a screen only: `api.github.com → unreachable`. */
    fact?: string;
    /** `screen`: the centred note filling a screen; `group`: a line under a list's group header; `column`: a board column's. */
    place?: 'screen' | 'group' | 'column';
  }>(),
  { icon: undefined, tone: 'muted', detail: undefined, fact: undefined, place: 'screen' },
);

defineSlots<{
  /** The ways on: `Button`s, `variant="secondary" size="sm"`, drawn in a wrapping row on a screen. */
  action?(): unknown;
}>();
</script>

<template>
  <div
    v-if="place === 'screen'"
    :class="css.emptyState"
  >
    <div :class="css.emptyState_body">
      <component
        :is="icon"
        v-if="icon"
        :class="[css.emptyState_icon, css[`emptyState_icon_${tone}`]]"
        :stroke-width="1"
        aria-hidden="true"
      />
      <div :class="css.emptyState_copy">
        <h2 :class="css.emptyState_title">{{ title }}</h2>
        <p
          v-if="detail"
          :class="css.emptyState_detail"
        >
          {{ detail }}
        </p>
      </div>
      <code
        v-if="fact"
        :class="css.emptyState_fact"
        >{{ fact }}</code
      >
      <div
        v-if="$slots.action"
        :class="css.emptyState_actions"
      >
        <slot name="action" />
      </div>
    </div>
  </div>
  <div
    v-else
    :class="css[`emptyState_${place}`]"
  >
    <component
      :is="icon"
      v-if="icon"
      :class="[css[`emptyState_${place}Icon`], css[`emptyState_icon_${tone}`]]"
      aria-hidden="true"
    />
    <p :class="css.emptyState_line">{{ title }}</p>
    <slot name="action" />
  </div>
</template>

<style lang="scss" module="css">
.emptyState {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: $spacing-24 $spacing-16 80px;
}

.emptyState_body {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
  align-items: center;
  width: 460px;
  max-width: 100%;
}

.emptyState_icon {
  width: 40px;
  height: 40px;
}

.emptyState_icon_good {
  color: $color-green;
}

.emptyState_icon_muted {
  color: $color-fg-3;
}

// On a screen the quiet grey is `fg-2`: a 40 px icon drawn at stroke-width 1 fades out in `fg-3`.
.emptyState_icon.emptyState_icon_muted {
  color: $color-fg-2;
}

.emptyState_icon_warning {
  color: $color-amber;
}

.emptyState_icon_broken {
  color: $color-red;
}

.emptyState_copy {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  align-items: center;
  width: 100%;
  text-align: center;
}

.emptyState_title {
  font-size: $font-size-xl;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.emptyState_detail {
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

// `fg-dim`, not the design's `fg-3`: text in `fg-3` misses AA contrast (`tokens.scss`). Wraps anywhere, as a URL or
// an endpoint has no spaces to break at on a narrow screen.
.emptyState_fact {
  max-width: 100%;
  padding: $spacing-4 $spacing-8;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  overflow-wrap: anywhere;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.emptyState_actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  align-items: center;
  justify-content: center;
}

// Under a group's header, indented as its rows' titles (`ListView`'s note).
.emptyState_group {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-16 $spacing-10 36px;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.emptyState_groupIcon {
  flex: none;
  width: 13px;
  height: 13px;
}

.emptyState_column {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  align-items: center;
  padding: 22px $spacing-12 $spacing-24;
  font-size: $font-size-xs;
  line-height: 1.45;
  color: $color-fg-dim;
  text-align: center;
}

.emptyState_columnIcon {
  width: 16px;
  height: 16px;
}

.emptyState_line {
  min-width: 0;
}
</style>
