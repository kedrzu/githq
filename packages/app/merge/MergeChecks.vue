<!-- The checks in the merge panel (PM4a, merging D13): one line while nothing holds the merge — "All 9 passed", "5 required" aside. What holds it shows as rows: a required check failing or still running, tagged "Required", first; one that isn't required and failed (or runs beside a required one) is grey and says it doesn't stop the merge. `C` or the chevron opens the full list — Required, then Others — each check with its state, time and log. Before the panel's read, the row's summary alone, with nothing to open. -->
<script lang="ts">
import type { MergeCheck } from './MergeTypes.js';

/**
 * The checks shown as rows while the list is folded: any required one failing or running, with those that aren't
 * required failing or running beside them; else only those that failed without being required.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getAttentionChecks(checks: readonly MergeCheck[]): MergeCheck[] {
  const holding = checks.some(check => check.isRequired && (check.state === 'failing' || check.state === 'pending'));
  const shown = checks.filter(check => check.state === 'failing' || (holding && check.state === 'pending'));
  return shown.toSorted((a, b) => Number(b.isRequired) - Number(a.isRequired) || rank(a) - rank(b));
}

const ORDER: readonly MergeCheck['state'][] = ['failing', 'pending', 'passing', 'skipped'];

function rank(check: MergeCheck) {
  return ORDER.indexOf(check.state);
}
</script>

<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleSlash,
  CircleX,
  LoaderCircle,
} from 'lucide-vue-next';
import { computed } from 'vue';

import IconButton from '@/components/IconButton.vue';
import type { ItemCheckState } from '@/store/ItemDetailTypes.js';
import type { ItemChecks } from '@/store/ItemTypes.js';
import { formatDuration } from '@/utils/formatDuration.js';

import { countMergeChecks } from './countMergeChecks.js';
import * as l from './MergeChecks.loc.js';

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

const counts = computed(() => (props.checks ? countMergeChecks(props.checks) : null));
const attention = computed(() => (props.checks ? getAttentionChecks(props.checks) : []));
const groups = computed(() => {
  const checks = props.checks ?? [];
  const required = checks.filter(check => check.isRequired).toSorted((a, b) => rank(a) - rank(b));
  const others = checks.filter(check => !check.isRequired).toSorted((a, b) => rank(a) - rank(b));
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

const line = computed((): { state: ItemCheckState; text: string } => {
  const current = counts.value;
  if (current) {
    return describeCounts();
  }

  const { summary } = props;
  if (!summary || summary.passing + summary.failing + summary.pending === 0) {
    return { state: 'skipped', text: t(l.noChecks) };
  }

  if (summary.failing === 0 && summary.pending === 0) {
    return { state: 'passing', text: t(l.allPassed, { count: summary.passing }) };
  }

  const parts: string[] = [];
  if (summary.failing > 0) {
    parts.push(t(l.failing, { count: summary.failing }));
  }

  if (summary.pending > 0) {
    parts.push(t(l.running, { count: summary.pending }));
  }

  if (summary.passing > 0) {
    parts.push(t(l.passed, { count: summary.passing }));
  }

  return { state: summary.failing > 0 ? 'failing' : 'pending', text: parts.join(', ') };
});

function describeCounts(): { state: ItemCheckState; text: string } {
  const current = counts.value;
  const total = props.checks?.length ?? 0;
  if (!current || total === 0) {
    return { state: 'skipped', text: t(l.noChecks) };
  }

  if (current.passing === total) {
    return { state: 'passing', text: t(l.allPassed, { count: total }) };
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

function nameOf(check: MergeCheck) {
  return check.workflow ? `${check.workflow} / ${check.name}` : check.name;
}

function describe(check: MergeCheck) {
  const ran = check.startedAt && check.completedAt ? Date.parse(check.completedAt) - Date.parse(check.startedAt) : null;
  switch (check.state) {
    case 'failing':
      return ran === null ? t(l.stateFailed) : t(l.stateFailedAfter, { duration: formatDuration(ran) });
    case 'pending':
      return check.startedAt
        ? t(l.stateRunningFor, { duration: formatDuration(props.now - Date.parse(check.startedAt)) })
        : t(l.stateQueued);
    case 'passing':
      return ran === null ? t(l.statePassed) : t(l.statePassedIn, { duration: formatDuration(ran) });
    case 'skipped':
      return t(l.stateSkipped);
    default:
      return assertNever(check.state);
  }
}

/** A folded row of a check that isn't required says it doesn't stop the merge. */
function describeAttention(check: MergeCheck) {
  return check.isRequired ? describe(check) : t(l.notStopping, { detail: describe(check) });
}

function iconOf(state: ItemCheckState) {
  switch (state) {
    case 'failing':
      return CircleX;
    case 'pending':
      return LoaderCircle;
    case 'passing':
      return CircleCheck;
    case 'skipped':
      return CircleSlash;
    default:
      return assertNever(state);
  }
}
</script>

<template>
  <div :class="css.mergeChecks">
    <div :class="css.mergeChecks_line">
      <component
        :is="iconOf(line.state)"
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
          <li
            v-for="check in group.checks"
            :key="check.id"
            :class="[
              css.mergeChecks_check,
              check.isRequired && check.state === 'failing' && css.mergeChecks_check_blocking,
            ]"
          >
            <component
              :is="iconOf(check.state)"
              :class="[css.mergeChecks_icon, css[`mergeChecks_icon_${check.state}`]]"
              aria-hidden="true"
            />
            <span :class="css.mergeChecks_name">{{ nameOf(check) }}</span>
            <span :class="css.mergeChecks_detail">{{ describe(check) }}</span>
            <a
              v-if="check.url"
              :class="css.mergeChecks_log"
              :href="check.url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="t(l.logOf, { name: nameOf(check) })"
            >
              {{ t(l.log) }}
              <ArrowUpRight
                :class="css.mergeChecks_logIcon"
                aria-hidden="true"
              />
            </a>
          </li>
        </ul>
      </section>
    </div>

    <div
      v-else-if="attention.length > 0"
      :class="css.mergeChecks_list"
    >
      <ul :class="css.mergeChecks_rows">
        <li
          v-for="check in attention"
          :key="check.id"
          :class="[
            css.mergeChecks_check,
            check.isRequired && check.state === 'failing' && css.mergeChecks_check_blocking,
          ]"
        >
          <component
            :is="iconOf(check.state)"
            :class="[
              css.mergeChecks_icon,
              check.isRequired ? css[`mergeChecks_icon_${check.state}`] : css.mergeChecks_icon_skipped,
            ]"
            aria-hidden="true"
          />
          <span :class="[css.mergeChecks_name, !check.isRequired && css.mergeChecks_name_optional]">{{
            nameOf(check)
          }}</span>
          <span
            v-if="check.isRequired"
            :class="css.mergeChecks_tag"
            >{{ t(l.required) }}</span
          >
          <span :class="css.mergeChecks_detail">{{ describeAttention(check) }}</span>
          <a
            v-if="check.url"
            :class="css.mergeChecks_log"
            :href="check.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t(l.logOf, { name: nameOf(check) })"
          >
            {{ t(l.log) }}
            <ArrowUpRight
              :class="css.mergeChecks_logIcon"
              aria-hidden="true"
            />
          </a>
        </li>
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

.mergeChecks_check {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 26px;
  padding: $spacing-4 $spacing-8;
  font-size: $font-size-xs;
  white-space: nowrap;
  border-radius: $radius-md;
}

.mergeChecks_check_blocking {
  background: $color-bg-3;
}

.mergeChecks_name {
  flex: none;
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $font-family-mono;
  color: $color-fg;
}

.mergeChecks_name_optional {
  color: $color-fg-2;
}

.mergeChecks_tag {
  flex: none;
  padding: 0 5px;
  font-size: 10.5px;
  color: $color-fg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.mergeChecks_detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-dim;
}

.mergeChecks_log {
  @include focus-ring;

  display: inline-flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  color: $color-fg-2;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}

.mergeChecks_logIcon {
  width: 12px;
  height: 12px;
}
</style>
