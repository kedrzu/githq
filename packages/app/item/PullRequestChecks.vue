<!-- The checks of an opened pull request's head commit (F1–F4): failing ones first, each with how long it ran and its log on GitHub — a required one tagged "Required" — then those still running; the ones that passed fold into one row that opens. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, ChevronDown, ChevronRight, CircleCheck } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemCheckState, PullRequestDetail } from '@/store/ItemDetailTypes.js';

import { compareChecks } from './compareChecks.js';
import { getCheckIcon } from './getCheckIcon.js';
import * as l from './PullRequestChecks.loc.js';
import RequiredTag from './RequiredTag.vue';
import { useCheckTexts } from './useCheckTexts.js';

const props = defineProps<{
  detail: PullRequestDetail;
  /** Epoch ms a running check's time is counted to. */
  now: number;
  /**
   * The checks the base branch requires to pass, by id: a failing one is tagged. Only the merge options say it
   * (`PullRequestMergeOptions`); none until they are read.
   */
  requiredIds?: readonly string[] | null;
}>();

const t = useTranslate();
const checkTexts = useCheckTexts();
const nameList = new Intl.ListFormat(APP_LANGUAGE, { style: 'narrow', type: 'unit' });
const expanded = ref(false);

const sorted = computed(() => props.detail.checks.toSorted(compareChecks));
const attention = computed(() => sorted.value.filter(check => check.state === 'failing' || check.state === 'pending'));
const settled = computed(() => sorted.value.filter(check => check.state === 'passing' || check.state === 'skipped'));
const counts = computed(() => {
  const result: Record<ItemCheckState, number> = { failing: 0, pending: 0, passing: 0, skipped: 0 };
  for (const check of props.detail.checks) {
    result[check.state]++;
  }

  return result;
});

const summary = computed(() => {
  const { failing, pending, passing, skipped } = counts.value;
  const parts: string[] = [];
  if (failing > 0) {
    parts.push(t(l.failingCount, { count: failing }));
  }

  if (pending > 0) {
    parts.push(t(l.runningCount, { count: pending }));
  }

  if (passing > 0) {
    parts.push(t(l.passedCount, { count: passing }));
  }

  if (skipped > 0) {
    parts.push(t(l.skippedCount, { count: skipped }));
  }

  return parts.join(' · ');
});

const settledTitle = computed(() => {
  const { passing, skipped } = counts.value;
  const parts: string[] = [];
  if (passing > 0) {
    parts.push(t(l.passedCount, { count: passing }));
  }

  if (skipped > 0) {
    parts.push(t(l.skippedCount, { count: skipped }));
  }

  return parts.join(' · ');
});

const more = computed(() => props.detail.checkCount - props.detail.checks.length);
</script>

<template>
  <section
    v-if="detail.checks.length > 0"
    :class="css.pullRequestChecks"
  >
    <h2 :class="css.pullRequestChecks_header">
      <span :class="css.pullRequestChecks_title">{{ t(l.checks) }}</span>
      <span :class="css.pullRequestChecks_summary">{{ summary }}</span>
    </h2>
    <ul :class="css.pullRequestChecks_list">
      <li
        v-for="check in attention"
        :key="check.id"
        :class="[css.pullRequestChecks_check, check.state === 'failing' && css.pullRequestChecks_check_failing]"
      >
        <component
          :is="getCheckIcon(check.state)"
          :class="[css.pullRequestChecks_icon, css[`pullRequestChecks_icon_${check.state}`]]"
          aria-hidden="true"
        />
        <span :class="css.pullRequestChecks_name">{{ checkTexts.name(check) }}</span>
        <RequiredTag v-if="check.state === 'failing' && requiredIds?.includes(check.id)" />
        <span :class="css.pullRequestChecks_detail">{{ checkTexts.describe(check, now) }}</span>
        <Button
          v-if="check.url"
          variant="link"
          size="sm"
          :icon="ArrowUpRight"
          :link="check.url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${t(l.log)} · ${checkTexts.name(check)}`"
        >
          {{ t(l.log) }}
        </Button>
      </li>
      <li
        v-if="settled.length > 0"
        :class="css.pullRequestChecks_check"
      >
        <CircleCheck
          :class="[css.pullRequestChecks_icon, css.pullRequestChecks_icon_passing]"
          aria-hidden="true"
        />
        <span :class="css.pullRequestChecks_count">{{ settledTitle }}</span>
        <span :class="css.pullRequestChecks_detail">{{ nameList.format(settled.map(check => check.name)) }}</span>
        <IconButton
          :icon="expanded ? ChevronDown : ChevronRight"
          :label="expanded ? t(l.hidePassed) : t(l.showPassed)"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        />
      </li>
      <template v-if="expanded">
        <li
          v-for="check in settled"
          :key="check.id"
          :class="[css.pullRequestChecks_check, css.pullRequestChecks_check_nested]"
        >
          <component
            :is="getCheckIcon(check.state)"
            :class="[css.pullRequestChecks_icon, css[`pullRequestChecks_icon_${check.state}`]]"
            aria-hidden="true"
          />
          <span :class="css.pullRequestChecks_name">{{ checkTexts.name(check) }}</span>
          <span :class="css.pullRequestChecks_detail">{{ checkTexts.describe(check, now) }}</span>
          <Button
            v-if="check.url"
            variant="link"
            size="sm"
            :icon="ArrowUpRight"
            :link="check.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${t(l.log)} · ${checkTexts.name(check)}`"
          >
            {{ t(l.log) }}
          </Button>
        </li>
      </template>
    </ul>
    <Button
      v-if="more > 0"
      variant="link"
      size="sm"
      :icon="ArrowUpRight"
      :link="`${detail.item.url}/checks`"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t(l.more, { count: more }) }}
    </Button>
  </section>
</template>

<style lang="scss" module="css">
.pullRequestChecks {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pullRequestChecks_header {
  display: flex;
  gap: $spacing-8;
  padding-bottom: $spacing-6;
  font-size: $font-size-xs;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.pullRequestChecks_title {
  font-weight: $font-weight-medium;
}

.pullRequestChecks_list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.pullRequestChecks_check {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 26px;
  padding: 2px $spacing-8;
  font-size: $font-size-xs;
  white-space: nowrap;
  border-radius: $radius-md;
}

.pullRequestChecks_check_failing {
  background: $color-bg-3;
}

.pullRequestChecks_check_nested {
  padding-left: 29px;
}

.pullRequestChecks_icon {
  flex: none;
  width: 13px;
  height: 13px;
}

.pullRequestChecks_icon_failing {
  color: $color-red;
}

.pullRequestChecks_icon_pending {
  color: $color-amber;
}

.pullRequestChecks_icon_passing {
  color: $color-green;
}

.pullRequestChecks_icon_skipped {
  color: $color-fg-3;
}

.pullRequestChecks_name {
  flex: none;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $font-family-mono;
  color: $color-fg;
}

.pullRequestChecks_count {
  flex: none;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.pullRequestChecks_detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-dim;
}
</style>
