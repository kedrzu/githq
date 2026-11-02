<!-- What a pattern matches of the branches and tags githq has seen runs on (`Workflow alerts / Pattern row`, the editor's preview): the refs as chips — branches first, then tags, the newest first — up to `limit` and "+n" for the rest, then "1 branch, 3 tags · Release and Deploy run on them", with an amber flag when it catches both kinds ("· v2-experiment is a branch"). Matching nothing it says so, without calling the pattern wrong; before the first read, that matches show later. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type { PatternMatches } from './buildWorkflowAlerts.js';
import * as l from './WorkflowPatternMatches.loc.js';
import WorkflowRefChip from './WorkflowRefChip.vue';

const props = defineProps<{
  matches: PatternMatches;
  /** githq has read the repository's runs. */
  read: boolean;
  /** How many chips show before "+n". */
  limit: number;
}>();

defineSlots<{
  /** What leads the chips' line: the pattern, or "Would alert on". */
  lead?(): unknown;
}>();

const t = useTranslate();
const LIST = new Intl.ListFormat(APP_LANGUAGE);

const shown = computed(() => props.matches.refs.slice(0, props.limit));
const summary = computed(() => {
  const { refs, branchCount, tagCount, workflows } = props.matches;
  const kinds: string[] = [];
  if (branchCount > 0) {
    kinds.push(t(l.branches, { count: branchCount }));
  }

  if (tagCount > 0) {
    kinds.push(t(l.tags, { count: tagCount }));
  }

  if (workflows.length === 0) {
    return kinds.join(', ');
  }

  const names = LIST.format(workflows);
  const ran = t(refs.length === 1 ? l.runOnIt : l.runOnThem, { count: workflows.length, names });
  return `${kinds.join(', ')} · ${ran}`;
});
const flag = computed(() => {
  const { flagged } = props.matches;
  if (!flagged) {
    return null;
  }

  const params = { count: flagged.names.length, names: LIST.format(flagged.names) };
  return t(flagged.kind === 'branch' ? l.flagBranches : l.flagTags, params);
});
</script>

<template>
  <div :class="css.workflowPatternMatches">
    <div :class="css.workflowPatternMatches_head">
      <slot name="lead" />
      <WorkflowRefChip
        v-for="ref in shown"
        :key="ref.name"
        :name="ref.name"
        :kind="ref.kind"
      />
      <span
        v-if="matches.refs.length > shown.length"
        :class="css.workflowPatternMatches_more"
        >{{ t(l.more, { count: matches.refs.length - shown.length }) }}</span
      >
    </div>
    <p
      v-if="matches.refs.length === 0"
      :class="css.workflowPatternMatches_summary"
    >
      {{ t(read ? l.nothing : l.notRead) }}
    </p>
    <p
      v-else
      :class="css.workflowPatternMatches_summary"
    >
      {{ summary }}
      <span
        v-if="flag"
        :class="css.workflowPatternMatches_flag"
        >{{ flag }}</span
      >
    </p>
  </div>
</template>

<style lang="scss" module="css">
.workflowPatternMatches {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
}

.workflowPatternMatches_head {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
}

.workflowPatternMatches_more {
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
}

.workflowPatternMatches_summary {
  font-size: $font-size-xs;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.workflowPatternMatches_flag {
  color: $color-amber;
}
</style>
