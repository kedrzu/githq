<!-- The checks in the merge panel (PM4a, merging D13): one line while nothing holds the merge — "All 9 passed", "5 required" aside. What holds it shows as rows: a required check failing or still running, tagged "Required", first; one that isn't required and failed (or runs beside a required one) is grey and says it doesn't stop the merge. `C` or the chevron opens the full list — Required, then Others — each check with its state, time and log, and those that don't stop the merge saying so the same way. Before the panel's read, the row's summary alone, with nothing to open. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import { computed } from 'vue';

import IconButton from '@/components/IconButton.vue';
import { compareChecks } from '@/item/compareChecks.js';
import { getCheckIcon } from '@/item/getCheckIcon.js';
import type { CheckSummary } from '@/item/useCheckTexts.js';
import { useCheckTexts } from '@/item/useCheckTexts.js';
import type { PullRequestVerdictTone } from '@/item/usePullRequestVerdict.js';
import type { ItemCheckState } from '@/store/ItemDetailTypes.js';
import type { ItemChecks } from '@/store/ItemTypes.js';

import { countMergeChecks } from './countMergeChecks.js';
import { getAttentionChecks } from './getAttentionChecks.js';
import MergeCheckRow from './MergeCheckRow.vue';
import * as l from './MergeChecks.loc.js';
import MergeCondition from './MergeCondition.vue';
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
  /** They will run again: the branch is to be updated (PM20). */
  runAgain?: boolean;
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

function toneOf(state: ItemCheckState): PullRequestVerdictTone {
  switch (state) {
    case 'failing':
      return 'danger';
    case 'pending':
      return 'warning';
    case 'passing':
      return 'success';
    case 'skipped':
      return 'muted';
    default:
      return assertNever(state);
  }
}

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
    <MergeCondition
      :icon="getCheckIcon(line.state)"
      :tone="toneOf(line.state)"
      :label="t(l.checks)"
      :text="runAgain ? t(l.willRunAgain, { checks: line.text }) : line.text"
      :aside="counts && counts.required > 0 && !open ? t(l.requiredCount, { count: counts.required }) : null"
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
    </MergeCondition>

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
