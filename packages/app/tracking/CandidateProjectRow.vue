<!-- A project the project picker offers (T22, `Track / Project row`): its checkbox, the board icon, its title and `#number`, how many items it holds, and how recently it was updated. A tracked one shows a grey, fixed tick and "tracked" instead (`· tracked`). No "from …" column and no visibility tag: GitHub's lists give neither for a project not tracked (D25). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { SquareKanban } from 'lucide-vue-next';

import Checkbox from '@/components/Checkbox.vue';
import { formatAge } from '@/utils/formatAge.js';

import * as l from './CandidateProjectRow.loc.js';
import type { CandidateProject } from './TrackingTypes.js';

defineProps<{
  project: CandidateProject;
  now: number;
  /** Already tracked, so its tick is fixed and it can't be picked. */
  tracked?: boolean;
}>();

const selected = defineModel<boolean>({ required: true });

const t = useTranslate();
</script>

<template>
  <div
    :class="[css.candidateProjectRow, tracked && css.candidateProjectRow_tracked]"
    data-tracking-row
  >
    <Checkbox
      :model-value="tracked || selected"
      :readonly="tracked"
      :class="css.candidateProjectRow_label"
      @update:model-value="selected = $event"
    >
      <span :class="css.candidateProjectRow_name">
        <SquareKanban
          :class="css.candidateProjectRow_icon"
          aria-hidden="true"
        />
        <span :class="css.candidateProjectRow_title">{{ project.title }}</span>
        {{ ' ' }}
        <span :class="css.candidateProjectRow_number">#{{ project.number }}</span>
      </span>
    </Checkbox>
    <span :class="css.candidateProjectRow_items">{{ t(l.items, { count: project.itemCount }) }}</span>
    <span :class="css.candidateProjectRow_updated">{{
      tracked ? t(l.tracked) : t(l.updated, { age: formatAge(Date.parse(project.updatedAt), now) })
    }}</span>
  </div>
</template>

<style lang="scss" module="css">
.candidateProjectRow {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  min-height: 32px;
  padding: 0 $spacing-12;
  line-height: 18px;
  border-radius: $radius-md;

  &:hover {
    background: $color-bg-2;
  }

  &:focus-within {
    background: $color-sel;
  }
}

.candidateProjectRow_label {
  flex: 1;
  min-width: 0;
  padding: 7px 0;
}

.candidateProjectRow_name {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  min-width: 0;
}

.candidateProjectRow_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.candidateProjectRow_title {
  min-width: 0;
  overflow: hidden;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidateProjectRow_number {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.candidateProjectRow_items {
  flex: none;
  width: 80px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-align: right;
  white-space: nowrap;
}

.candidateProjectRow_updated {
  flex: none;
  min-width: 110px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-align: right;
  white-space: nowrap;
}

// A fixed tick, grey rather than the readonly checkbox's dimmed accent, with the title quieter.
.candidateProjectRow.candidateProjectRow_tracked {
  [role='checkbox'] {
    color: $color-fg-3;
    background: $color-bg-3;
    border-color: $color-control-border;
  }

  .candidateProjectRow_title {
    color: $color-fg-2;
  }
}
</style>
