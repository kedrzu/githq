<!-- Where an opened pull request stands (F1–F4, PM38): the verdict in one line — "Can't merge yet", "Ready to merge", "Being merged" — then which condition holds it back (checks, reviews, conflicts), its branches and size, and the ways on: "Merge…" (`⇧M`, the merge panel; lit when it is ready) where the viewer may merge it, its label the way forward the panel leads to ("Update branch", "Resolve on GitHub", "Mark ready…") — without write access "You can't merge in this repository" in its place (K1b) — GitHub and the changed files. Being merged, the conditions fold and it waits for GitHub (PM33): nothing reads merged until GitHub says so (merging D3). Read from the row's status summary (`getPullRequestStanding`, the same as "my work"), so it shows before the detail arrives; once the merge options are read, its verdict weighs only the required checks — the same verdict as the merge panel's (`usePullRequestVerdict`). The conditions fold for a draft, as for a pull request merged or being merged. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowRight, FileDiff, GitBranch, GitMerge, Github } from 'lucide-vue-next';
import { computed } from 'vue';

import { EDIT_KEYS } from '@/commands/useEditCommands.js';
import Button from '@/components/Button.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { MergeCheckCounts } from '@/merge/countMergeChecks.js';
import { isStackedOnAnother } from '@/store/isStackedOnAnother.js';
import type { PullRequestDetail } from '@/store/ItemDetailTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import * as l from './PullRequestMerge.loc.js';
import PullRequestVerdictLine from './PullRequestVerdictLine.vue';
import { usePullRequestConditions } from './usePullRequestConditions.js';
import { usePullRequestVerdict } from './usePullRequestVerdict.js';

const props = defineProps<{
  pr: PullRequestItem;
  /** Read with the opened item; the branch's owner comes from it. */
  detail?: PullRequestDetail | null;
  /**
   * The viewer may merge it (`EditPermissions.mergePanel`): "Merge…" is offered while it is not being merged; `false`
   * says they can't, while it is open, not being merged and merges alone. `null` when not known: neither shows.
   */
  canMerge?: boolean | null;
  /**
   * Its checks counted by whether the base branch requires them, once the merge options are read: the verdict then
   * weighs only the required ones, as the merge panel does (PM38). `null` until then: the row's summary decides.
   */
  checks?: MergeCheckCounts | null;
}>();

const emit = defineEmits<{
  /** "Merge…": the merge panel is wanted. */
  merge: [];
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

const mergeVerdict = usePullRequestVerdict(
  () => props.pr,
  () => props.checks ?? null,
);
const lines = usePullRequestConditions(() => props.pr);
const open = computed(() => props.pr.state === 'OPEN');
const merging = computed(() => props.pr.merging !== undefined);
/** What stands in "Merge…"'s place when it is not offered: waiting for GitHub, or why the viewer can't. */
const note = computed(() => {
  if (!open.value || props.pr.merged) {
    return null;
  }

  if (merging.value) {
    return t(l.waitingForGitHub);
  }

  // Stacked on another, it merges with its stack (stacked PRs D11), not offered yet — whatever the role.
  return props.canMerge === false && !isStackedOnAnother(props.pr) ? t(l.cannotMerge) : null;
});
/** "Merge…" opens the panel, and says the way forward it leads to (PM38). */
const mergeLabel = computed(() => {
  const forward = mergeVerdict.forward;
  switch (forward) {
    case 'merge':
    case null:
      return t(l.merge);
    case 'markReady':
      return t(l.markReady);
    case 'updateBranch':
      return t(l.updateBranch);
    case 'resolveConflicts':
      return t(l.resolveConflicts);
    default:
      return assertNever(forward);
  }
});

const conditions = computed(() => [
  { label: t(l.checks), line: lines.checks },
  { label: t(l.reviews), line: lines.reviews },
  { label: t(l.conflictsLabel), line: lines.conflicts },
]);

const head = computed(() => {
  const { pr, detail } = props;
  const owner = detail?.headRepository ? parseRepositoryName(detail.headRepository).owner : null;
  return owner && owner !== pr.repository.owner ? `${owner}:${pr.headRefName}` : pr.headRefName;
});

const filesUrl = computed(() => `${props.pr.url}/files`);
</script>

<template>
  <section :class="css.pullRequestMerge">
    <PullRequestVerdictLine
      :verdict="mergeVerdict.verdict"
      tag="h2"
    />
    <dl
      v-if="open && !pr.isDraft && !merging"
      :class="css.pullRequestMerge_conditions"
    >
      <div
        v-for="condition in conditions"
        :key="condition.label"
        :class="[css.pullRequestMerge_condition, css[`pullRequestMerge_condition_${condition.line.tone}`]]"
      >
        <dt :class="css.pullRequestMerge_conditionLabel">
          <component
            :is="condition.line.icon"
            :class="css.pullRequestMerge_conditionIcon"
            aria-hidden="true"
          />
          {{ condition.label }}
        </dt>
        <dd :class="css.pullRequestMerge_conditionValue">
          <span :class="css.pullRequestMerge_conditionText">{{ condition.line.text }}</span>
          <span
            v-if="condition.line.aside"
            :class="css.pullRequestMerge_conditionAside"
            >{{ condition.line.aside }}</span
          >
        </dd>
      </div>
    </dl>
    <p :class="css.pullRequestMerge_branches">
      <GitBranch
        :class="css.pullRequestMerge_branchIcon"
        aria-hidden="true"
      />
      <span :class="css.pullRequestMerge_hidden">{{ t(l.branchInto, { head, base: pr.baseRefName }) }}</span>
      <span
        :class="css.pullRequestMerge_branch"
        aria-hidden="true"
        >{{ head }}</span
      >
      <ArrowRight
        :class="css.pullRequestMerge_branchIcon"
        aria-hidden="true"
      />
      <span
        :class="css.pullRequestMerge_branch"
        aria-hidden="true"
        >{{ pr.baseRefName }}</span
      >
      <span :class="css.pullRequestMerge_spacer" />
      <span :class="css.pullRequestMerge_added">+{{ numbers.format(pr.additions) }}</span>
      <span :class="css.pullRequestMerge_removed">−{{ numbers.format(pr.deletions) }}</span>
      <span :class="css.pullRequestMerge_files">{{ t(l.files, { count: pr.changedFiles }) }}</span>
    </p>
    <div :class="css.pullRequestMerge_actions">
      <Button
        v-if="canMerge && !merging"
        :variant="mergeVerdict.mergeable ? 'light' : 'secondary'"
        size="sm"
        :icon="GitMerge"
        :kbd="EDIT_KEYS.merge"
        :aria-keyshortcuts="EDIT_KEYS.merge"
        @click="emit('merge')"
      >
        {{ mergeLabel }}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        :icon="Github"
        :link="pr.url"
        kbd="O"
        target="_blank"
        rel="noopener noreferrer"
        aria-keyshortcuts="O"
      >
        {{ t(l.openOnGitHub) }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :icon="FileDiff"
        :link="filesUrl"
        kbd="Shift+O"
        target="_blank"
        rel="noopener noreferrer"
        aria-keyshortcuts="Shift+O"
      >
        {{ t(l.reviewFiles) }}
      </Button>
      <span :class="css.pullRequestMerge_spacer" />
      <span
        v-if="note"
        :class="css.pullRequestMerge_note"
        >{{ note }}</span
      >
    </div>
  </section>
</template>

<style lang="scss" module="css">
.pullRequestMerge {
  overflow: hidden;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.pullRequestMerge_conditions {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: $spacing-10 $spacing-12;
  margin: 0;
}

.pullRequestMerge_condition {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-sm;
  line-height: 15px;
}

.pullRequestMerge_conditionLabel {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  width: 92px;
  color: $color-fg-dim;
}

.pullRequestMerge_conditionIcon {
  width: 13px;
  height: 13px;

  .pullRequestMerge_condition_danger & {
    color: $color-red;
  }

  .pullRequestMerge_condition_success & {
    color: $color-green;
  }

  .pullRequestMerge_condition_warning & {
    color: $color-amber;
  }

  .pullRequestMerge_condition_muted & {
    color: $color-fg-3;
  }
}

.pullRequestMerge_conditionValue {
  display: flex;
  flex: 1;
  gap: $spacing-8;
  min-width: 0;
  margin: 0;
}

.pullRequestMerge_conditionText {
  flex: 1;
  min-width: 0;
  color: $color-fg;
}

.pullRequestMerge_conditionAside {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.pullRequestMerge_branches {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 9px $spacing-12;
  margin: 0;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  white-space: nowrap;
  border-top: 1px solid $color-border;
}

.pullRequestMerge_branchIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.pullRequestMerge_branch {
  overflow: hidden;
  text-overflow: ellipsis;
}

.pullRequestMerge_hidden {
  @include visually-hidden;
}

.pullRequestMerge_spacer {
  flex: 1;
}

.pullRequestMerge_added {
  color: $color-green;
}

.pullRequestMerge_removed {
  color: $color-red;
}

.pullRequestMerge_files {
  font-family: $font-family-sans;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.pullRequestMerge_actions {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-10 $spacing-12;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.pullRequestMerge_note {
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
