<!-- An opened workflow (actions D15, W30–W33, W42): the same view in the panel beside the screen or full screen. The header (`ItemHeader`) names it — its state's icon, the repository and the workflow — and holds the way through the list it was opened from (`⇧K`/`⇧J`), the other arrangement (`⇧Enter`), GitHub (`O`) and close (`Esc`). Under it the workflow's name, how it stands ("Broken on main" for 3h · last passed yesterday in #4812) and, when asked to offer it and the file has `workflow_dispatch`, "Run workflow…" at the heading's right. Its width below the header decides the layout, not the arrangement: from 1000px on a page, 1300px in the panel (as an issue's, `TWO_COLUMNS_WIDTH`), the runs (`WorkflowRuns`) beside the details (`WorkflowDetails`) at the right, their edge dragged or moved by the arrow keys from 320 to 640px, the width kept on this device (`ColumnSplit`); narrower, the tabs Runs and Details, the chosen one kept for the next workflow until the app reloads. The page fills the width: a list, not a text to read. Full screen, `j`/`k` walk the runs and `↵` opens one, `⇧J`/`⇧K` step to the next workflow, `F` opens its latest failure, and a key bar at the bottom says so; in the panel the list beside it keeps `j`/`k`. -->
<script lang="ts">
import { shallowRef } from 'vue';

/** A tab of the narrow layout. */
type WorkflowTab = 'runs' | 'details';

/** The tab chosen last: carried over to the next workflow opened, back to Runs when the app reloads. */
const chosenTab = shallowRef<WorkflowTab>('runs');
</script>

<script lang="ts" setup>
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CircleCheck, CircleDashed, CircleSlash, CircleX, GitPullRequest, Play } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import { closeItem, next, open, openOnGitHub, previous } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import ColumnSplit from '@/components/ColumnSplit.vue';
import Kbd from '@/components/Kbd.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import ItemHeader from '@/item/ItemHeader.vue';
import type { ItemArrangement } from '@/item/itemRoutes.js';
import { PANEL_TWO_COLUMNS_WIDTH, TWO_COLUMNS_WIDTH } from '@/item/ItemView.vue';
import { useItemKeys } from '@/item/useItemArrangement.js';
import type { ItemWalkPosition } from '@/item/useItemWalk.js';
import { Browser } from '@/services/Browser.js';
import { formatAge } from '@/utils/formatAge.js';

import type { WorkflowDetails as Details } from './buildWorkflowDetails.js';
import { useDescribeRunWhen } from './useDescribeRunWhen.js';
import { getBrokenGroupRef } from './utils/getBrokenGroupRef.js';
import { getRunVerdict } from './utils/getRunVerdict.js';
import { isPullRequestRun } from './utils/isPullRequestRun.js';
import { isRunInGroup } from './utils/isRunInGroup.js';
import WorkflowDetails from './WorkflowDetails.vue';
import type { WorkflowRunFilters, WorkflowRunsBrowse } from './WorkflowRunHistory.js';
import WorkflowRuns from './WorkflowRuns.vue';
import type { WorkflowRefGroup, WorkflowRunsGroupBy, WorkflowState } from './WorkflowTypes.js';
import * as l from './WorkflowView.loc.js';

const props = withDefaults(
  defineProps<{
    arrangement: ItemArrangement;
    /** Its place in the list it was opened from; `null` outside one. */
    position: ItemWalkPosition | null;
    /** `owner/name`. */
    nameWithOwner: string;
    state: WorkflowState;
    details: Details;
    runs: WorkflowRunsBrowse;
    /** The repository's counted groups, in their order. */
    refGroups: readonly WorkflowRefGroup[];
    /** The repository's tags, as last read. */
    tags: readonly string[];
    groupBy: WorkflowRunsGroupBy;
    /** Its latest failed run known, on any ref, which `F` opens; `null` without one. */
    latestFailure: GitHubWorkflowRun | null;
    /** Where Escape goes from full screen, for the key bar to say: back to the panel, or to the list. */
    escapeTo?: 'panel' | 'list';
    /** "Run workflow…" is offered for a workflow whose file has `workflow_dispatch`. */
    offerRun?: boolean;
    /** The command menu offers "Disable workflow" or "Enable workflow", which the details say. */
    offerToggle?: boolean;
    /** The user may re-run and cancel the repository's runs: the command menu offers it for the run under the cursor. */
    canChangeRuns?: boolean;
    /** Epoch ms the ages are counted to. */
    now: number;
  }>(),
  { escapeTo: 'list', offerRun: false, offerToggle: false, canChangeRuns: false },
);

/** The run the user moved to or opened among the runs, by its row key: kept by the caller across visits. */
const selectedRun = defineModel<string | null>('selectedRun', { default: null });

const emit = defineEmits<{
  close: [];
  previous: [];
  next: [];
  arrange: [arrangement: ItemArrangement];
  openRun: [run: GitHubWorkflowRun];
  filter: [filters: WorkflowRunFilters];
  readMore: [];
  groupBy: [groupBy: WorkflowRunsGroupBy];
  runWorkflow: [];
  rerunAll: [run: GitHubWorkflowRun];
  cancel: [run: GitHubWorkflowRun];
}>();

/** The details' column: 400 px by default, dragged from 320 to 640 px. */
const DETAILS_WIDTH = { key: 'workflowDetails', default: 400, min: 320, max: 640 };

const t = useTranslate();
const browser = useService(Browser);
const describeRunWhen = useDescribeRunWhen();
const bodyRef = useTemplateRef<HTMLElement>('body');

/** The view's width below the header: it decides the layout, not the arrangement. */
const bodyWidth = ref(0);
const twoColumns = computed(
  () => bodyWidth.value >= (props.arrangement === 'panel' ? PANEL_TWO_COLUMNS_WIDTH : TWO_COLUMNS_WIDTH),
);
const page = computed(() => props.arrangement === 'page');
const tabs = computed((): SegmentedTabsOption<WorkflowTab>[] => [
  { value: 'runs', label: t(l.runs), count: props.runs.runs.length },
  { value: 'details', label: t(l.details) },
]);
const showsRuns = computed(() => twoColumns.value || chosenTab.value === 'runs');
const canRun = computed(
  () => props.offerRun && props.details.file.kind === 'parsed' && props.details.file.file.dispatch !== null,
);
const callOnly = computed(() => props.details.file.kind === 'parsed' && props.details.file.file.callOnly);
/** How it stands, as the pill and the sentence after it say. */
const standing = computed((): Standing => {
  const { state, now } = props;
  switch (state.state) {
    case 'broken': {
      const group = state.brokenGroups[0];
      const age = state.breakStartedAt === null ? null : formatAge(state.breakStartedAt, now);
      // The last pass where it is broken, among the runs shown: a pull request's elsewhere says nothing of it.
      const lastSuccess =
        props.runs.runs.find(run => getRunVerdict(run) === 'passed' && (!group || isRunInGroup(run, group.group))) ??
        null;
      const parts = [
        age === null ? null : t(state.breakStartKnown ? l.brokenFor : l.brokenForOrMore, { age }),
        lastSuccess &&
          t(l.lastPassed, { when: describeRunWhen(lastSuccess.createdAt, now), number: lastSuccess.runNumber }),
      ];
      return {
        tone: 'broken',
        icon: CircleX,
        label: t(l.brokenOn, { ref: group ? getBrokenGroupRef(group).name : '' }),
        sentence: parts.filter(part => part !== null).join(' · '),
      };
    }
    case 'passing': {
      const counted = props.details.countsOn.find(entry => entry.state === 'passing');
      const refName = counted ? getGroupName(counted.group) : '';
      return {
        tone: 'passing',
        icon: CircleCheck,
        label: t(l.passingOn, { ref: refName }),
        sentence: counted?.streak ? t(l.lastRunsPassed, { count: counted.streak.count, ref: refName }) : '',
      };
    }
    case 'unknown': {
      // As the Workflows list says it (`buildRepositoryWorkflows`): runs only pull requests started never count.
      const known = props.runs.runs;
      if (known.length > 0 && known.every(isPullRequestRun)) {
        return { tone: 'muted', icon: GitPullRequest, label: t(l.pullRequestsOnly), sentence: t(l.neverCounts) };
      }

      return {
        tone: 'muted',
        icon: CircleDashed,
        label: t(l.noVerdict),
        sentence: state.groups.length === 0 ? t(l.nothingCounts) : '',
      };
    }
    case 'disabled':
      return { tone: 'muted', icon: CircleSlash, label: t(l.disabled), sentence: '' };
    default:
      return assertNever(state.state);
  }
});

// `⇧K`/`⇧J` step through the list it was opened from; Escape closes it.
const keys = useItemKeys({
  place: 'workflow',
  arrangement: () => props.arrangement,
  closesToPanel: () => props.escapeTo === 'panel',
  close: () => emit('close'),
  arrange: arrangement => emit('arrange', arrangement),
  previous: () => emit('previous'),
  next: () => emit('next'),
});

const hints = computed(() => [
  { id: 'run', keys: [keyOf(next), keyOf(previous)], label: t(l.hintRun) },
  { id: 'workflow', keys: [keys.stepKeys.next, keys.stepKeys.previous], label: t(l.hintWorkflow) },
  { id: 'open', keys: [keyOf(open)], label: t(l.hintOpenRun) },
  ...(props.latestFailure ? [{ id: 'failure', keys: ['F'], label: t(l.hintLatestFailure) }] : []),
  { id: 'escape', keys: [keyOf(closeItem)], label: props.escapeTo === 'panel' ? t(l.backToPanel) : t(l.backToList) },
]);

useCommands(() => {
  const { commands } = keys;
  return [
    commands.next,
    commands.previous,
    // `J`/`K` and Enter are the runs' own (`WorkflowRuns`), full screen.
    // In the panel the list beside it owns `F`, for the workflow under its cursor.
    {
      id: 'workflow.openLatestFailure',
      title: t(l.openLatestFailure),
      section: 'item',
      key: 'F',
      icon: CircleX,
      when: () => page.value && props.latestFailure !== null,
      run: () => {
        if (props.latestFailure) {
          emit('openRun', props.latestFailure);
        }
      },
    },
    commands.close,
    bindCommand(
      openOnGitHub,
      { place: 'workflow', section: 'item', run: () => browser.openInNewTab(props.state.workflow.htmlUrl) },
      t,
    ),
    commands.closeFullScreen,
    ...(commands.openFullScreen ? [commands.openFullScreen] : []),
  ];
});

// Measured before the first paint, so a wide view opens in two columns rather than tabs for a frame.
let bodyObserver: ResizeObserver | undefined;
onMounted(() => {
  const body = bodyRef.value;
  if (!body) {
    return;
  }

  bodyWidth.value = body.clientWidth;
  bodyObserver = new ResizeObserver(() => {
    bodyWidth.value = body.clientWidth;
  });
  bodyObserver.observe(body);
});
onBeforeUnmount(() => bodyObserver?.disconnect());

function getGroupName(group: WorkflowRefGroup) {
  return group.kind === 'defaultBranch' ? group.branch : group.pattern;
}

/** How the workflow stands, as its heading says it. */
interface Standing {
  readonly tone: 'broken' | 'passing' | 'muted';
  readonly icon: LucideIcon;
  readonly label: string;
  /** What follows the pill; empty with nothing to add. */
  readonly sentence: string;
}
</script>

<template>
  <article
    :class="[css.workflowView, css[`workflowView_${arrangement}`]]"
    :aria-label="state.workflow.name"
  >
    <ItemHeader
      :position="position"
      :other-arrangement="keys.otherArrangement"
      :url="state.workflow.htmlUrl"
      :step-keys="keys.stepKeys"
      @previous="emit('previous')"
      @next="emit('next')"
      @arrange="emit('arrange', $event)"
      @close="emit('close')"
    >
      <template #identity>
        <span :class="css.workflowView_identity">
          <component
            :is="standing.icon"
            :class="[css.workflowView_stateIcon, css[`workflowView_tone_${standing.tone}`]]"
            aria-hidden="true"
          />
          <span :class="css.workflowView_repository">{{ nameWithOwner }}</span>
          <span :class="css.workflowView_name">{{ state.workflow.name }}</span>
        </span>
      </template>
    </ItemHeader>

    <div
      ref="body"
      :class="css.workflowView_body"
    >
      <ColumnSplit
        :shown="twoColumns"
        side="right"
        :width="DETAILS_WIDTH"
        :label="t(l.resizeDetails)"
      >
        <template #column>
          <div :class="css.workflowView_scroll">
            <WorkflowDetails
              :details="details"
              :now="now"
              :offer-run="canRun"
              :offer-toggle="offerToggle"
            />
          </div>
        </template>
        <div :class="css.workflowView_main">
          <div :class="css.workflowView_heading">
            <div :class="css.workflowView_headingText">
              <h1 :class="css.workflowView_title">{{ state.workflow.name }}</h1>
              <p :class="css.workflowView_standing">
                <span :class="[css.workflowView_pill, css[`workflowView_pill_${standing.tone}`]]">
                  <component
                    :is="standing.icon"
                    :class="css.workflowView_pillIcon"
                    aria-hidden="true"
                  />
                  {{ standing.label }}
                </span>
                <span
                  v-if="standing.sentence"
                  :class="css.workflowView_sentence"
                  >{{ standing.sentence }}</span
                >
              </p>
            </div>
            <Button
              v-if="canRun"
              variant="outline"
              size="sm"
              :icon="Play"
              @click="emit('runWorkflow')"
            >
              {{ t(l.runWorkflow) }}
            </Button>
          </div>
          <div
            v-if="!twoColumns"
            :class="css.workflowView_tabs"
          >
            <SegmentedTabs
              v-model="chosenTab"
              :options="tabs"
              :label="t(l.sections)"
            />
          </div>
          <WorkflowRuns
            v-if="showsRuns"
            v-model:selected-run="selectedRun"
            :runs="runs"
            :group-by="groupBy"
            :ref-groups="refGroups"
            :tags="tags"
            :now="now"
            :call-only="callOnly"
            :keys="page"
            :can-change-runs="canChangeRuns"
            @filter="emit('filter', $event)"
            @group-by="emit('groupBy', $event)"
            @read-more="emit('readMore')"
            @open-run="emit('openRun', $event)"
            @rerun-all="emit('rerunAll', $event)"
            @cancel="emit('cancel', $event)"
          />
          <div
            v-else
            :class="css.workflowView_scroll"
          >
            <WorkflowDetails
              :details="details"
              :now="now"
              :offer-run="canRun"
              :offer-toggle="offerToggle"
            />
          </div>
        </div>
      </ColumnSplit>
    </div>

    <footer
      v-if="page"
      :class="css.workflowView_keys"
      aria-hidden="true"
    >
      <span
        v-for="hint in hints"
        :key="hint.id"
        :class="css.workflowView_hint"
      >
        <Kbd
          v-for="key in hint.keys"
          :key="key"
          :keys="key"
        />
        {{ hint.label }}
      </span>
    </footer>
  </article>
</template>

<style lang="scss" module="css">
.workflowView {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: $color-fg;
  background: $color-bg-item;
}

.workflowView_identity {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  min-width: 0;
}

.workflowView_stateIcon {
  flex: none;
  width: 14px;
  height: 14px;
}

.workflowView_tone_broken {
  color: $color-red;
}

.workflowView_tone_passing {
  color: $color-green;
}

.workflowView_tone_muted {
  color: $color-fg-3;
}

.workflowView_repository {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowView_name {
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowView_body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.workflowView_main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.workflowView_scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.workflowView_heading {
  display: flex;
  flex: none;
  gap: $spacing-16;
  align-items: flex-start;
  justify-content: space-between;
  padding: $spacing-20 $spacing-24 $spacing-16;
}

.workflowView_headingText {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  min-width: 0;
}

.workflowView_title {
  margin: 0;
  overflow: hidden;
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowView_standing {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-10;
  align-items: center;
  margin: 0;
  font-size: $font-size-sm;
}

.workflowView_pill {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  padding: $spacing-2 $spacing-8;
  border-radius: 999px;
}

.workflowView_pill_broken {
  color: $color-red;
  background: rgba($color-red, 0.12);
}

.workflowView_pill_passing {
  color: $color-green;
  background: rgba($color-green, 0.12);
}

.workflowView_pill_muted {
  color: $color-fg-2;
  background: $color-bg-3;
}

.workflowView_pillIcon {
  width: 13px;
  height: 13px;
}

.workflowView_sentence {
  color: $color-fg-dim;
}

.workflowView_tabs {
  flex: none;
  padding: 0 $spacing-24 $spacing-8;
  border-bottom: 1px solid $color-border;
}

.workflowView_keys {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: $spacing-16;
  align-items: center;
  padding: $spacing-8 $spacing-16;
  border-top: 1px solid $color-border;
}

.workflowView_hint {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  white-space: nowrap;
}
</style>
