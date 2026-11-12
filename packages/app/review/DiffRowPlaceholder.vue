<!-- A line of a file still on its way, drawn from its patch (D45): its numbers from the hunk headers in the number columns, as wide as a code row's, and a quiet bar where its code will start, as long as the line might be (D38), tinted when the line is added or deleted. Split side by side, the side with nothing blank; unified in one column, the sign's column empty. Nothing in it can be acted on, and it is hidden from assistive technology: it only holds the place of what comes. -->
<script lang="ts" setup>
import DiffLineNumber from './DiffLineNumber.vue';
import type { PlaceholderBar, PlaceholderSplitLine, PlaceholderUnifiedLine } from './utils/getPlaceholderMask.js';

defineProps<{
  line: PlaceholderSplitLine | PlaceholderUnifiedLine;
  /** The patch's largest line number, which the number columns are as wide as. */
  largest: number;
}>();

/** Indent levels are two characters; the bar's font makes a `ch` a character of code. */
function getBarStyle(bar: PlaceholderBar) {
  return { marginLeft: `${bar.indent * 2}ch`, width: `${bar.length}ch` };
}
</script>

<template>
  <div
    v-if="line.kind === 'split'"
    :class="css.diffRowPlaceholder_split"
    aria-hidden="true"
  >
    <div
      v-for="(cell, index) in [line.left, line.right]"
      :key="index"
      :class="css.diffRowPlaceholder_cell"
    >
      <template v-if="cell">
        <DiffLineNumber
          :class="css.diffRowPlaceholder_number"
          :line="cell.line"
          :largest="largest"
          still
        />
        <span :class="css.diffRowPlaceholder_code">
          <span
            v-if="cell.bar"
            :class="[css.diffRowPlaceholder_bar, cell.tint && css[`diffRowPlaceholder_bar_${cell.tint}`]]"
            :style="getBarStyle(cell.bar)"
          />
        </span>
      </template>
    </div>
  </div>
  <div
    v-else
    :class="css.diffRowPlaceholder_unified"
    aria-hidden="true"
  >
    <DiffLineNumber
      :class="[css.diffRowPlaceholder_number, css.diffRowPlaceholder_number_unified]"
      :line="line.oldLine"
      :largest="largest"
      still
    />
    <DiffLineNumber
      :class="[css.diffRowPlaceholder_number, css.diffRowPlaceholder_number_unified]"
      :line="line.newLine"
      :largest="largest"
      still
    />
    <span :class="css.diffRowPlaceholder_sign" />
    <span :class="css.diffRowPlaceholder_code">
      <span
        v-if="line.bar"
        :class="[css.diffRowPlaceholder_bar, line.tint && css[`diffRowPlaceholder_bar_${line.tint}`]]"
        :style="getBarStyle(line.bar)"
      />
    </span>
  </div>
</template>

<style lang="scss" module="css">
// The geometry of `DiffRowSplit` and `DiffRowUnified`, so the code that replaces a bar starts where it did.
.diffRowPlaceholder_split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  height: 20px;
}

.diffRowPlaceholder_cell {
  display: flex;
  gap: $spacing-12;
  min-width: 0;
  padding-right: $spacing-10;

  & + & {
    border-left: 1px solid $color-border;
  }
}

.diffRowPlaceholder_unified {
  display: flex;
  height: 20px;
  padding-right: $spacing-10;
}

.diffRowPlaceholder_number {
  flex: none;
  color: $color-fg-dim;
}

.diffRowPlaceholder_number_unified {
  margin-right: $spacing-4;
}

.diffRowPlaceholder_sign {
  flex: none;
  width: 28px;
}

// Code's font, for a `ch` to be a character; a long bar ends at its column's edge.
.diffRowPlaceholder_code {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
}

.diffRowPlaceholder_bar {
  flex: none;
  height: 8px;
  background: $color-skeleton-weak;
  border-radius: 2px;
}

.diffRowPlaceholder_bar_deleted {
  background: $color-skeleton-deleted;
}

.diffRowPlaceholder_bar_added {
  background: $color-skeleton-added;
}
</style>
