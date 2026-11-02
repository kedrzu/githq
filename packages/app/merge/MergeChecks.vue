<!-- The checks in the merge panel (PM4a, merging D13): one line while nothing holds the merge — "All 9 passed", "5 required" aside. What holds it shows as rows: a required check failing or still running, tagged "Required", first; one that isn't required and failed (or runs beside a required one) is grey and says it doesn't stop the merge. `C` or the chevron opens the full list — Required, then Others — each check with its state, time and log, and those that don't stop the merge saying so the same way. Before the panel's read, the row's summary alone, with nothing to open. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import { computed } from 'vue';

import IconButton from '@/components/IconButton.vue';
import { compareChecks } from '@/item/compareChecks.js';
import { getCheckIcon } from '@/item/getCheckIcon.js';
import type { CheckSummary } from '@/item/useCheckTexts.js';
import { useCheckTexts } from '@/item/useCheckTexts.js';
import type { ItemCheckState } from '@/store/ItemDetailTypes.js';
import type { ItemChecks } from '@/store/ItemTypes.js';

import { countMergeChecks } from './countMergeChecks.js';
import { getAttentionChecks } from './getAttentionChecks.js';
import MergeCheckRow from './MergeCheckRow.vue';
import * as l from './MergeChecks.loc.js';
import type { MergeCheck } from './MergeTypes.js';

const props = defineProps<{
  /** The checks as the panel's read brings them; `null` until it arrives, or when it could not be read. */
  checks: readonly MergeCheck[] | null;
  /** The row's summary of them, until the read arrives. */
  summary: ItemChecks | null;
  /** The full list is open. */
  open: boolean;
  /** Epoch ms a running check's time is counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** The full list opened or folded. */
  toggle: [];
}>();

const t = useTranslate();
const checkTexts = useCheckTexts();

const counts = computed(() => (props.checks ? countMergeChecks(props.checks) : null));
const attention = computed(() => (props.checks ? getAttentionChecks(props.checks) : []));
const groups = computed(() => {
  const checks = props.checks ?? [];
  const required = checks.filter(check => check.isRequired).toSorted(compareChecks);
  const others = checks.filter(check => !check.isRequired).toSorted(compareChecks);
  return [
    { key: 'required', heading: t(l.requiredSection, { count: required.length }), checks: required },
    {
      key: 'others',
      // Without required checks, there is nothing to tell them apart from.
      heading: required.length > 0 ? t(l.othersSection, { count: others.length }) : null,
      checks: others,
    },
  ].filter(group => group.checks.length > 0);
});

const line = computed(() => (counts.value ? describeCounts() : checkTexts.summarize(props.summary)));

function describeCounts(): CheckSummary {
  const current = counts.value;
  const total = props.checks?.length ?? 0;
  if (!current || current.passing === total) {
    // None, or all passed: said as the row's summary says it.
    return checkTexts.summarize({ passing: total, failing: 0, pending: 0 });
  }

  const parts: string[] = [];
  if (current.requiredFailing + current.requiredPending > 0) {
    // What holds the merge first, then the rest.
    if (current.requiredFailing > 0) {
      parts.push(t(l.requiredFailed, { count: current.requiredFailing }));
    }

    if (current.requiredPending > 0) {
      parts.push(t(l.requiredRunning, { count: current.requiredPending }));
    }

    if (current.otherFailing > 0) {
      parts.push(t(l.otherFailed, { count: current.otherFailing }));
    }

    if (current.otherPending > 0) {
      parts.push(t(l.otherRunning, { count: current.otherPending }));
    }

    if (current.passing > 0) {
      parts.push(t(l.passed, { count: current.passing }));
    }
  } else {
    // Nothing holds it: what passed first, then what doesn't matter to it.
    if (current.passing > 0) {
      parts.push(t(l.passed, { count: current.passing }));
    }

    if (current.otherFailing > 0) {
      parts.push(t(l.failedNotRequired, { count: current.otherFailing }));
    }

    if (current.otherPending > 0) {
      parts.push(t(l.runningNotRequired, { count: current.otherPending }));
    }
  }

  if (current.skipped > 0) {
    parts.push(t(l.skipped, { count: current.skipped }));
  }

  const state: ItemCheckState =
    current.requiredFailing > 0 ? 'failing' : current.requiredPending > 0 ? 'pending' : 'passing';
  return { state, text: parts.join(', ') };
}
</script>

<template>
  <div :class="css.mergeChecks">
    <div :class="css.mergeChecks_line">
      <component
        :is="getCheckIcon(line.state)"
        :class="[css.mergeChecks_icon, css[`mergeChecks_icon_${line.state}`]]"
        aria-hidden="true"
      />
      <span :class="css.mergeChecks_key">{{ t(l.checks) }}</span>
      <span :class="css.mergeChecks_text">{{ line.text }}</span>
      <span
        v-if="counts && counts.required > 0 && !open"
        :class="css.mergeChecks_aside"
        >{{ t(l.requiredCount, { count: counts.required }) }}</span
      >
      <IconButton
        v-if="checks && checks.length > 0"
        :icon="open ? ChevronDown : ChevronRight"
        :label="open ? t(l.fold) : t(l.showAll)"
        :aria-expanded="open"
        kbd="C"
        aria-keyshortcuts="C"
        @click="emit('toggle')"
      />
    </div>

    <div
      v-if="open"
      :class="css.mergeChecks_list"
    >
      <section
        v-for="group in groups"
        :key="group.key"
        :class="css.mergeChecks_group"
        :aria-label="group.heading ?? t(l.checks)"
      >
        <h3
          v-if="group.heading"
          :class="css.mergeChecks_heading"
        >
          {{ group.heading }}
        </h3>
        <ul :class="css.mergeChecks_rows">
          <MergeCheckRow
            v-for="check in group.checks"
            :key="check.id"
            :check="check"
            :now="now"
          />
        </ul>
      </section>
    </div>

    <div
      v-else-if="attention.length > 0"
      :class="css.mergeChecks_list"
    >
      <ul :class="css.mergeChecks_rows">
        <MergeCheckRow
          v-for="check in attention"
          :key="check.id"
          :check="check"
          :now="now"
          tagged
        />
      </ul>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.mergeChecks {
  display: flex;
  flex-direction: column;
}

.mergeChecks_line {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 22px;
  padding: 6px 10px 6px 14px;
  font-size: $font-size-sm;
  white-space: nowrap;
}

.mergeChecks_key {
  flex: none;
  width: 72px;
  color: $color-fg-dim;
}

.mergeChecks_text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg;
}

.mergeChecks_aside {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.mergeChecks_icon {
  flex: none;
  width: 13px;
  height: 13px;
}

.mergeChecks_icon_failing {
  color: $color-red;
}

.mergeChecks_icon_pending {
  color: $color-amber;
}

.mergeChecks_icon_passing {
  color: $color-green;
}

.mergeChecks_icon_skipped {
  color: $color-fg-3;
}

.mergeChecks_list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: 0 $spacing-6 $spacing-8;
}

.mergeChecks_group + .mergeChecks_group .mergeChecks_heading {
  padding-top: $spacing-6;
}

.mergeChecks_heading {
  padding: $spacing-2 $spacing-8;
  margin: 0;
  font-size: $font-size-2xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.mergeChecks_rows {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding-right: 0;
  padding-left: 0;
  margin: 0;
  list-style: none;
}
</style>
