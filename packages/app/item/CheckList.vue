<!-- A list of checks, of a pull request's head commit or of a commit: failing ones first, each with how long it ran and its log — a required one tagged "Required" — then those still running; the ones that passed fold into one row that opens, and those GitHub did not give are a link to it. In a narrow panel a check's name gives way before how long it ran, and the folded row's names give way before its chevron. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, ChevronDown, ChevronRight, CircleCheck } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemCheck } from '@/store/ItemDetailTypes.js';
import { getWorkflowRunPathOfUrl } from '@/tracking/trackingRoutes.js';

import * as l from './CheckList.loc.js';
import { compareChecks } from './compareChecks.js';
import { getCheckIcon } from './getCheckIcon.js';
import RequiredTag from './RequiredTag.vue';
import { useCheckTexts } from './useCheckTexts.js';

const props = defineProps<{
  checks: readonly ItemCheck[];
  /** How many there are in all; more than {@link checks} holds when GitHub cut the list. */
  checkCount: number;
  /** Where all of them are listed on GitHub. */
  moreUrl: string;
  /** Epoch ms a running check's time is counted to. */
  now: number;
  /**
   * The checks the base branch requires to pass, by id: a failing one is tagged. Only the merge options say it
   * (`PullRequestMergeOptions`); none until they are read.
   */
  requiredIds?: readonly string[] | null;
  /** The app has a page for the repository's runs: a check that is an Actions run or job links there, not to GitHub. */
  runsInApp?: boolean;
}>();

const t = useTranslate();
const checkTexts = useCheckTexts();
const nameList = new Intl.ListFormat(APP_LANGUAGE, { style: 'narrow', type: 'unit' });
const expanded = ref(false);

const sorted = computed(() => props.checks.toSorted(compareChecks));
const attention = computed(() => sorted.value.filter(check => check.state === 'failing' || check.state === 'pending'));
const settled = computed(() => sorted.value.filter(check => check.state === 'passing' || check.state === 'skipped'));

const settledTitle = computed(() => {
  const passing = settled.value.filter(check => check.state === 'passing').length;
  const skipped = settled.value.length - passing;
  const parts: string[] = [];
  if (passing > 0) {
    parts.push(t(l.passedCount, { count: passing }));
  }

  if (skipped > 0) {
    parts.push(t(l.skippedCount, { count: skipped }));
  }

  return parts.join(' · ');
});

const more = computed(() => props.checkCount - props.checks.length);

function getLogLink(url: string) {
  const path = props.runsInApp ? getWorkflowRunPathOfUrl(url) : null;
  return path === null
    ? { link: url, icon: ArrowUpRight, target: '_blank', rel: 'noopener noreferrer' }
    : { link: path };
}
</script>

<template>
  <div :class="css.checkList">
    <ul :class="css.checkList_list">
      <li
        v-for="check in attention"
        :key="check.id"
        :class="[css.checkList_check, check.state === 'failing' && css.checkList_check_failing]"
      >
        <component
          :is="getCheckIcon(check.state)"
          :class="[css.checkList_icon, css[`checkList_icon_${check.state}`]]"
          aria-hidden="true"
        />
        <span :class="css.checkList_name">{{ checkTexts.name(check) }}</span>
        <RequiredTag v-if="check.state === 'failing' && requiredIds?.includes(check.id)" />
        <span :class="css.checkList_ran">{{ checkTexts.describe(check, now) }}</span>
        <Button
          v-if="check.url"
          v-bind="getLogLink(check.url)"
          variant="link"
          size="sm"
          :aria-label="`${t(l.log)} · ${checkTexts.name(check)}`"
        >
          {{ t(l.log) }}
        </Button>
      </li>
      <li
        v-if="settled.length > 0"
        :class="css.checkList_check"
      >
        <CircleCheck
          :class="[css.checkList_icon, css.checkList_icon_passing]"
          aria-hidden="true"
        />
        <span :class="css.checkList_count">{{ settledTitle }}</span>
        <span :class="css.checkList_names">{{ nameList.format(settled.map(check => check.name)) }}</span>
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
          :class="[css.checkList_check, css.checkList_check_nested]"
        >
          <component
            :is="getCheckIcon(check.state)"
            :class="[css.checkList_icon, css[`checkList_icon_${check.state}`]]"
            aria-hidden="true"
          />
          <span :class="css.checkList_name">{{ checkTexts.name(check) }}</span>
          <span :class="css.checkList_ran">{{ checkTexts.describe(check, now) }}</span>
          <Button
            v-if="check.url"
            v-bind="getLogLink(check.url)"
            variant="link"
            size="sm"
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
      :link="moreUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t(l.more, { count: more }) }}
    </Button>
  </div>
</template>

<style lang="scss" module="css">
.checkList {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checkList_list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.checkList_check {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 26px;
  padding: 2px $spacing-8;
  font-size: $font-size-xs;
  white-space: nowrap;
  border-radius: $radius-md;
}

.checkList_check_failing {
  background: $color-bg-3;
}

.checkList_check_nested {
  padding-left: 29px;
}

.checkList_icon {
  flex: none;
  width: 13px;
  height: 13px;
}

.checkList_icon_failing {
  color: $color-red;
}

.checkList_icon_pending {
  color: $color-amber;
}

.checkList_icon_passing {
  color: $color-green;
}

.checkList_icon_skipped {
  color: $color-fg-3;
}

// The one thing in a check's row that gives way.
.checkList_name {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $font-family-mono;
  color: $color-fg;
}

.checkList_count {
  flex: none;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

// How long it ran never shrinks; it grows to keep the log at the row's end.
.checkList_ran {
  flex: 1 0 auto;
  color: $color-fg-dim;
}

.checkList_names {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-dim;
}
</style>
