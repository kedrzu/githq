<!-- Where an opened pull request stands (F1–F4, PM38): the verdict in one line — "Can't merge yet", "Ready to merge", "Being merged" — then which condition holds it back (checks, reviews, conflicts), its branches and size, and the ways on: "Merge pull request" (`⇧M`, the merge panel; lit when it is ready) where the viewer may merge it, its label the way forward the panel leads to ("Update branch", "Resolve on GitHub", "Mark ready", "Queue", "Auto-merge") — without write access "You can't merge in this repository" in its place (K1b) — GitHub and the changed files. Being merged, the conditions fold and it waits for GitHub (PM33): nothing reads merged until GitHub says so (merging D3). Read from the row's status summary (`getPullRequestStanding`, the same as "my work"), so it shows before the detail arrives; once the merge options are read, its verdict weighs only the required checks — the same verdict as the merge panel's (`usePullRequestVerdict`). The conditions fold for a draft, as for a pull request merged or being merged. A merge this session sent that did not end merged (`MergeRecord`) speaks instead of the verdict: refused, or a new commit, says nothing merged and "Merge pull request" reads "Back to the merge"; no answer in time is grey, "Outcome not known yet", until the next refresh settles it. The ordinary commands of the moment stand beside their reason (merging D16): behind, "Update branch" updates by `U`, with no panel; closed or merged, "Delete branch" or "Restore branch" by `⇧D`. Under 560px — the panel at its default width too — its buttons drop their icons, as on a phone; narrow — an opened item's summary column, a phone — also their key hints and the conditions' asides, and "Merge pull request" says "Merge"; where the buttons still get no room on one line, the last goes under. On a phone (mobile D52, MB260), which has no merging or code review yet (D4), "Merge pull request" links to the pull request on github.com and "Review files" keeps its address, which the phone hands off to github.com (D3), both marked ↗ (D11); the three buttons drop their icons and are a phone screen's actions, `lg`. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowRight, FileDiff, GitBranch, GitMerge, GitPullRequestArrow, Github } from 'lucide-vue-next';
import { computed } from 'vue';

import { branch, merge, openOnGitHub, review, updateBranch } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import Button from '@/components/Button.vue';
import type { ButtonSize } from '@/components/Button.vue';
import ExternalMark from '@/components/ExternalMark.vue';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import PullRequestSize from '@/lists/PullRequestSize.vue';
import type { MergeCheckCounts } from '@/merge/countMergeChecks.js';
import { getMergeEnd } from '@/merge/getMergeEnd.js';
import { getMergeEndLook } from '@/merge/getMergeEndLook.js';
import { getReasonTitle } from '@/merge/getReasonTitle.js';
import type { MergeRecord, PullRequestCommand } from '@/merge/MergeTypes.js';
import type { PullRequestDetail } from '@/store/ItemDetailTypes.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { getItemReference, getReviewPath } from './itemRoutes.js';
import * as l from './PullRequestMerge.loc.js';
import PullRequestVerdictLine from './PullRequestVerdictLine.vue';
import { usePullRequestConditions } from './usePullRequestConditions.js';
import { usePullRequestVerdict } from './usePullRequestVerdict.js';
import * as verdictTexts from './usePullRequestVerdict.loc.js';
import type { PullRequestVerdict } from './usePullRequestVerdict.js';

const props = defineProps<{
  pr: PullRequestItem;
  /** Read with the opened item; the branch's owner comes from it. */
  detail?: PullRequestDetail | null;
  /**
   * The viewer may merge it (`EditPermissions.mergePanel`): "Merge pull request" is offered while it is not being merged; `false`
   * says they can't, while it is open, not being merged and merges alone. `null` when not known: neither shows.
   */
  canMerge?: boolean | null;
  /**
   * Its checks counted by whether the base branch requires them, once the merge options are read: the verdict then
   * weighs only the required ones, as the merge panel does (PM38). `null` until then: the row's summary decides.
   */
  checks?: MergeCheckCounts | null;
  /** What this session knows of its last merge that did not end merged, while it speaks for it (merging D15). */
  record?: MergeRecord | null;
  /** Auto-merge may wait for what is not met (`isAutoMergeAllowed`): the verdict's way forward says so, as the panel's does. */
  autoMergeAllowed?: boolean;
  /** Its ordinary commands that apply now (merging D16): those of the moment show here, beside the reason (PM38). */
  commands?: readonly PullRequestCommand[];
}>();

const emit = defineEmits<{
  /** "Merge pull request": the merge panel is wanted. */
  merge: [];
  /** One of its ordinary commands, from its button. */
  command: [command: PullRequestCommand];
}>();

const t = useTranslate();
const phone = useService(PhoneLayout);
/** A card's actions (`md`); on a phone a screen's (`lg`). */
const actionSize = computed((): ButtonSize => (phone.active ? 'lg' : 'md'));
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

const mergeVerdict = usePullRequestVerdict({
  pr: () => props.pr,
  checks: () => props.checks ?? null,
  autoMergeAllowed: () => props.autoMergeAllowed,
});
const lines = usePullRequestConditions(() => props.pr);
const open = computed(() => props.pr.state === 'OPEN');
const merging = computed(() => props.pr.merging !== undefined);
/** How its last merge ended, while it still says something: open, and not being merged again. */
const ended = computed(() => getMergeEnd(props.record ?? null, props.pr, null));
const verdict = computed((): PullRequestVerdict => {
  const record = ended.value;
  if (!record) {
    return mergeVerdict.verdict;
  }

  const look = getMergeEndLook(record.kind);
  switch (record.kind) {
    case 'refused': {
      return { ...look, text: t(l.refused), aside: refusedAside(record.reason) };
    }
    case 'methodNotAllowed':
      return { ...look, text: t(l.refused), aside: t(l.nothingMerged) };
    case 'headMoved': {
      const author = record.commit?.author;
      const aside = author ? t(l.newCommitFrom, { author }) : t(l.newCommit);
      return { ...look, text: t(l.notMerged), aside };
    }
    case 'unknown':
      return {
        ...look,
        text: t(l.outcomeUnknown),
        aside: record.refusal ? refusedAside(record.refusal) : t(l.notAnswered),
      };
    default:
      return assertNever(record);
  }
});
/** What stands in "Merge pull request"'s place when it is not offered: waiting for GitHub, or why the viewer can't. */
const note = computed(() => {
  if (!open.value || props.pr.merged) {
    return null;
  }

  if (merging.value) {
    return t(l.waitingForGitHub);
  }

  if (ended.value?.kind === 'unknown') {
    return t(l.nextRefreshSettles);
  }

  return props.canMerge === false ? t(l.cannotMerge) : null;
});
/** "Merge pull request" opens the panel, and says the way forward it leads to (PM38). */
const mergeLabel = computed(() => {
  if (ended.value && ended.value.kind !== 'unknown') {
    return t(l.backToMerge);
  }

  return mergeVerdict.forwardTitle;
});
/** Narrow — the summary column, a phone — "Merge pull request" leaves the other two buttons no room: it says "Merge". */
const mergeShortLabel = computed(() => (mergeLabel.value === t(verdictTexts.merge) ? t(l.mergeShort) : null));

/** Behind, it updates by its own key, no panel needed (PM38), whether or not that is the way forward: something else may hold it too. */
const updateCommand = computed(() =>
  !ended.value && props.pr.mergeStateStatus === 'BEHIND'
    ? (props.commands?.find(command => command.kind === 'updateBranch' && command.method === 'MERGE') ?? null)
    : null,
);
/** What deleting or restoring its branch offers, once its pull request closed (PM26, PM26b). */
const branchCommand = computed(() =>
  props.commands?.find(command => command.kind === 'deleteBranch' || command.kind === 'restoreBranch'),
);

/** "Merge pull request" is offered: the viewer may merge it, it isn't being merged, and updating isn't the way forward, which its button above says all "Merge pull request" would. */
const mergeOffered = computed(
  () => props.canMerge === true && !merging.value && !(updateCommand.value && mergeVerdict.forward === 'updateBranch'),
);

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

const reviewPath = computed(() => getReviewPath(getItemReference(props.pr)));

/** Why GitHub refused it, in a few words: GitHub's own title, or the organisation that has not approved githq (G5). */
function refusedAside(reason: EditFailureReason) {
  switch (reason.kind) {
    case 'refused':
      return getReasonTitle(reason.message) || t(l.nothingMerged);
    case 'organizationRestricted':
      return t(l.organizationRestricted, { organization: reason.organization });
    default:
      return t(l.nothingMerged);
  }
}
</script>

<template>
  <section
    :class="css.pullRequestMerge"
    tid="pull-request-merge"
  >
    <PullRequestVerdictLine
      :verdict="verdict"
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
      <PullRequestSize
        :additions="pr.additions"
        :deletions="pr.deletions"
      />
      <span :class="css.pullRequestMerge_files">{{ t(l.files, { count: pr.changedFiles }) }}</span>
    </p>
    <div :class="css.pullRequestMerge_actions">
      <Button
        v-if="branchCommand"
        variant="secondary"
        :size="actionSize"
        :icon="GitBranch"
        :kbd="keyOf(branch)"
        :keyshortcuts="keyOf(branch)"
        @click="emit('command', branchCommand)"
      >
        {{ branchCommand.kind === 'deleteBranch' ? t(l.deleteBranch) : t(l.restoreBranch) }}
      </Button>
      <Button
        v-if="updateCommand"
        variant="secondary"
        :size="actionSize"
        :icon="GitPullRequestArrow"
        :kbd="keyOf(updateBranch)"
        :keyshortcuts="keyOf(updateBranch)"
        @click="emit('command', updateCommand)"
      >
        {{ t(updateBranch.title) }}
      </Button>
      <!-- A phone has no merge panel yet: the same pull request on github.com. -->
      <Button
        v-if="mergeOffered && phone.active"
        :variant="mergeVerdict.mergeable ? 'primary' : 'secondary'"
        :size="actionSize"
        :link="pr.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span :class="mergeShortLabel && css.pullRequestMerge_wideLabel">{{ mergeLabel }}</span>
        <span
          v-if="mergeShortLabel"
          :class="css.pullRequestMerge_narrowLabel"
          >{{ mergeShortLabel }}</span
        ><ExternalMark />
      </Button>
      <Button
        v-else-if="mergeOffered"
        :variant="mergeVerdict.mergeable ? 'primary' : 'secondary'"
        :size="actionSize"
        :icon="GitMerge"
        :kbd="keyOf(merge)"
        :keyshortcuts="keyOf(merge)"
        @click="emit('merge')"
      >
        <span :class="mergeShortLabel && css.pullRequestMerge_wideLabel">{{ mergeLabel }}</span>
        <span
          v-if="mergeShortLabel"
          :class="css.pullRequestMerge_narrowLabel"
          >{{ mergeShortLabel }}</span
        >
      </Button>
      <Button
        variant="secondary"
        :size="actionSize"
        :icon="phone.active ? undefined : Github"
        :link="pr.url"
        :kbd="keyOf(openOnGitHub)"
        target="_blank"
        rel="noopener noreferrer"
        :keyshortcuts="keyOf(openOnGitHub)"
      >
        {{ t(openOnGitHub.title) }}
      </Button>
      <!-- On a phone the address of the review is handed off to github.com's changed files (mobile D3). -->
      <Button
        variant="secondary"
        :size="actionSize"
        :icon="phone.active ? undefined : FileDiff"
        :link="reviewPath"
        :kbd="keyOf(review)"
        :keyshortcuts="keyOf(review)"
      >
        {{ t(review.title) }}<ExternalMark />
      </Button>
      <span
        v-if="note"
        :class="css.pullRequestMerge_note"
        >{{ note }}</span
      >
    </div>
  </section>
</template>

<style lang="scss" module="css">
// Under this width (an opened item's summary column, a phone) the block gives up what it can do without: the
// aside of a condition (approvals by name), so the conditions stay unwrapped, and "Merge pull request" says "Merge".
$narrow: 480px;
// Under this width (the panel at its default 560px, so its block at 512px) the buttons give up their leading icons, as on
// a phone, and keep their key hints: three 32px buttons with both need about 545px, without the icons about 480px.
$no-icons: 560px;

.pullRequestMerge {
  overflow: hidden;
  container-type: inline-size;
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

.pullRequestMerge_files {
  flex: none;
  font-family: $font-family-sans;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

// Where even the narrow buttons get no room on one line (the summary column at its narrowest, a phone, a fourth button),
// the last goes under, never cut off.
.pullRequestMerge_actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-10 $spacing-12;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.pullRequestMerge_narrowLabel {
  display: none;
}

.pullRequestMerge_note {
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

@container (width < #{$no-icons}) {
  // A button's leading icon: the first in its content (`Button`'s `icon`), never a mark in the label.
  .pullRequestMerge_actions [data-button-size] > span:first-child > svg:first-child {
    display: none;
  }
}

@container (width < #{$narrow}) {
  // The hints only: `aria-keyshortcuts` still names the keys.
  .pullRequestMerge_actions kbd,
  .pullRequestMerge_conditionAside,
  .pullRequestMerge_wideLabel {
    display: none;
  }

  .pullRequestMerge_narrowLabel {
    display: inline;
  }
}
</style>
