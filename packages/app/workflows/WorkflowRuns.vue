<!-- An opened workflow's runs (actions W43–W45): the toolbar — the filters Ref, Event, Status and Actor (`WorkflowRunFilters`), a divider, how many runs are loaded ("48 runs · newest first", "48+" while older ones remain) and the grouping ("Group: None", one setting for every workflow), each following the one before, nothing pinned to the end — then the runs, the newest first (`WorkflowRunRow`), in the grouping's groups, each folded or unfolded by its heading. They show at once from what is known; older ones are read as the end comes near ("Reading older runs…"), and a read GitHub fails is said under them, asked again by a click. With `keys`, `j`/`k` (and ↓/↑) select a run and `↵` opens it (`useRowSelection`), and where the user may change the repository's runs ⌘K re-runs all the jobs of the run under the cursor, or cancels it while it goes, with no key (D10); without, the keys are someone else's (the list beside the panel) and no run is drawn selected. -->
<script lang="ts" setup>
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  Ban,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleStop,
  CircleX,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  Rows3,
  TriangleAlert,
  User,
  Zap,
} from 'lucide-vue-next';
import { computed, ref, useTemplateRef } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import MenuRadioGroup from '@/components/MenuRadioGroup.vue';
import MenuRadioItem from '@/components/MenuRadioItem.vue';
import ListEndSentinel from '@/lists/ListEndSentinel.vue';
import { useRowSelection } from '@/utils/useRowSelection.js';

import { groupWorkflowRuns } from './groupWorkflowRuns.js';
import type { WorkflowRunGroup, WorkflowRunGroupLabel } from './groupWorkflowRuns.js';
import { getWorkflowRunFilterChoices } from './utils/getWorkflowRunFilterChoices.js';
import { NO_WORKFLOW_RUN_FILTERS } from './WorkflowRunHistory.js';
import type { WorkflowRunFilters as Filters, WorkflowRunsBrowse } from './WorkflowRunHistory.js';
import WorkflowRunFilters from './WorkflowRunFilters.vue';
import WorkflowRunRow from './WorkflowRunRow.vue';
import * as l from './WorkflowRuns.loc.js';
import type { WorkflowRefGroup, WorkflowRowRef, WorkflowRunsGroupBy } from './WorkflowTypes.js';

const props = defineProps<{
  runs: WorkflowRunsBrowse;
  groupBy: WorkflowRunsGroupBy;
  /** The repository's counted groups, in their order: the Ref grouping and filter show them first. */
  refGroups: readonly WorkflowRefGroup[];
  /** The repository's tags, as last read: a ref named here is a tag. */
  tags: readonly string[];
  /** Epoch ms the ages are counted to. */
  now: number;
  /** Only other workflows run it: no runs of its own to wait for. */
  callOnly: boolean;
  /** `j`/`k` and `↵` are the runs'. */
  keys: boolean;
  /**
   * The user may re-run and cancel the repository's runs (`getRepositoryDispatchBlock`, as for re-running the failed jobs):
   * with `keys`, ⌘K offers "Re-run all jobs" or "Cancel run" for the run under the cursor.
   */
  canChangeRuns?: boolean;
}>();

const emit = defineEmits<{
  /** Filters set or cleared: every filter as it now is. */
  filter: [filters: Filters];
  groupBy: [groupBy: WorkflowRunsGroupBy];
  /** The end came near, or the failed read's line was clicked: the caller reads older runs. */
  readMore: [];
  openRun: [run: GitHubWorkflowRun];
  /** "Re-run all jobs" in ⌘K, for the run under the cursor. */
  rerunAll: [run: GitHubWorkflowRun];
  /** "Cancel run" in ⌘K, for the run under the cursor. */
  cancel: [run: GitHubWorkflowRun];
}>();

/** A row the keys move through: one run. */
interface RunRow {
  readonly key: string;
  readonly run: GitHubWorkflowRun;
}

/** One grouping on offer, in the menu's order. */
interface GroupingChoice {
  readonly value: WorkflowRunsGroupBy;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly detail?: string;
}

const STATUS_ICONS = {
  inProgress: LoaderCircle,
  failed: CircleX,
  succeeded: CircleCheck,
  cancelled: CircleSlash,
  other: CircleDashed,
} as const;

/** The run the user moved to or opened, by its row key; held here when the caller keeps none. */
const chosenRun = defineModel<string | null>('selectedRun', { default: null });

const t = useTranslate();
const list = useTemplateRef<HTMLElement>('list');
/** The groups folded by their heading. */
const folded = ref<ReadonlySet<string>>(new Set());

const groupings = computed((): GroupingChoice[] => [
  { value: 'none', label: t(l.groupNone), icon: Ban },
  { value: 'status', label: t(l.groupStatus), icon: CircleDashed },
  { value: 'ref', label: t(l.groupRef), icon: GitBranch, detail: t(l.groupRefDetail) },
  { value: 'event', label: t(l.groupEvent), icon: Zap },
  { value: 'day', label: t(l.groupDay), icon: Calendar },
  { value: 'actor', label: t(l.groupActor), icon: User },
]);
const grouping = computed(() => groupings.value.find(choice => choice.value === props.groupBy));
const groups = computed(() =>
  groupWorkflowRuns({
    runs: props.runs.runs,
    groupBy: props.groupBy,
    refGroups: props.refGroups,
    tags: props.tags,
    now: props.now,
  }),
);
const rows = computed((): RunRow[] =>
  groups.value.flatMap(group =>
    folded.value.has(group.key) ? [] : group.runs.map(run => ({ key: getRunKey(run), run })),
  ),
);
const choices = computed(() =>
  getWorkflowRunFilterChoices({ runs: props.runs.runs, refGroups: props.refGroups, filters: props.runs.filters }),
);
const countedRefs = computed(() =>
  props.refGroups.map(group => (group.kind === 'defaultBranch' ? group.branch : group.pattern)),
);
const filtered = computed(() => Object.values(props.runs.filters).some(value => value !== null));
const countText = computed(() => {
  const count = props.runs.runs.length;
  return props.runs.complete || count === 0 ? t(l.count, { count }) : t(l.countSoFar, { count });
});
/** What shows in place of runs once there is none to show; `null` while there are some, or they may still come. */
const empty = computed(() => {
  const { runs, complete } = props.runs;
  if (runs.length > 0) {
    return null;
  }

  if (props.callOnly) {
    return t(l.callOnly);
  }

  if (!complete) {
    return null;
  }

  return filtered.value ? t(l.noRunsFiltered) : t(l.noRuns);
});
const selection = useRowSelection({
  rows,
  getKey: row => row.key,
  root: list,
  keyAttribute: 'data-run-key',
  selectFirst: true,
  chosenKey: chosenRun,
  open: row => emit('openRun', row.run),
  enabled: () => props.keys,
});

// No key starts or stops a run (D10): ⌘K only.
useCommands(() => {
  const run = props.keys && props.canChangeRuns ? (selection.selectedRow?.run ?? null) : null;
  if (!run) {
    return [];
  }

  const detail = t(l.runNumber, { number: run.runNumber });
  return [
    run.status === 'completed'
      ? {
          id: 'workflow.rerunAllJobs',
          title: t(l.rerunAllJobs),
          section: 'view',
          actsOnRow: true,
          icon: RefreshCw,
          detail,
          run: () => emit('rerunAll', run),
        }
      : {
          id: 'workflow.cancelRun',
          title: t(l.cancelRun),
          section: 'view',
          actsOnRow: true,
          icon: CircleStop,
          detail,
          run: () => emit('cancel', run),
        },
  ];
});

function getRunKey(run: GitHubWorkflowRun) {
  return `run:${run.id}`;
}

function getRunRef(run: GitHubWorkflowRun): WorkflowRowRef | null {
  const name = run.headBranch;
  return name === null ? null : { name, kind: props.tags.includes(name) ? 'tag' : 'branch' };
}

function openRun(run: GitHubWorkflowRun) {
  selection.select(getRunKey(run));
  emit('openRun', run);
}

function toggle(group: WorkflowRunGroup) {
  const next = new Set(folded.value);
  if (!next.delete(group.key)) {
    next.add(group.key);
  }

  folded.value = next;
}

/** The end is near: the next page, only one at a time, until there are none. */
function readOlder() {
  if (props.runs.status === 'idle' && !props.runs.complete) {
    emit('readMore');
  }
}

function chooseGrouping(value: unknown) {
  const choice = groupings.value.find(candidate => candidate.value === value);
  if (choice) {
    emit('groupBy', choice.value);
  }
}

function describeGroup(label: WorkflowRunGroupLabel): { text: string; icon: LucideIcon | null; mono: boolean } {
  switch (label.kind) {
    case 'all':
      return { text: '', icon: null, mono: false };
    case 'status':
      return { text: t(l[label.status]), icon: STATUS_ICONS[label.status], mono: false };
    case 'countedRef':
      return {
        text: label.group.kind === 'defaultBranch' ? label.group.branch : label.group.pattern,
        icon: GitBranch,
        mono: true,
      };
    case 'otherBranches':
    case 'otherTags':
    case 'pullRequests':
      return { text: t(l[label.kind]), icon: GitBranch, mono: false };
    case 'event':
      return { text: label.event.replaceAll('_', ' '), icon: Zap, mono: false };
    case 'day':
      return { text: t(l[label.day]), icon: Calendar, mono: false };
    case 'actor':
      return { text: label.actor?.login ?? t(l.noOne), icon: User, mono: false };
    default:
      return assertNever(label);
  }
}
</script>

<template>
  <section
    :class="css.workflowRuns"
    :aria-label="t(l.label)"
  >
    <div :class="css.workflowRuns_toolbar">
      <WorkflowRunFilters
        :filters="runs.filters"
        :choices="choices"
        :counted-refs="countedRefs"
        @change="emit('filter', $event)"
      />
      <span
        :class="css.workflowRuns_divider"
        aria-hidden="true"
      />
      <!-- The count and the grouping wrap together, onto a line of their own under the filters when narrow (W32). -->
      <span :class="css.workflowRuns_summary">
        <span :class="css.workflowRuns_count">{{ countText }}</span>
        <Menu align="start">
          <template #trigger>
            <Button
              variant="outline"
              size="sm"
              :icon="Rows3"
            >
              {{ t(l.group, { grouping: grouping?.label ?? '' }) }}
            </Button>
          </template>
          <MenuLabel>{{ t(l.groupRunsBy) }}</MenuLabel>
          <MenuRadioGroup
            :model-value="groupBy"
            @update:model-value="chooseGrouping"
          >
            <MenuRadioItem
              v-for="choice in groupings"
              :key="choice.value"
              :value="choice.value"
              :icon="choice.icon"
              :detail="choice.detail"
            >
              {{ choice.label }}
            </MenuRadioItem>
          </MenuRadioGroup>
        </Menu>
      </span>
    </div>

    <div
      ref="list"
      :class="css.workflowRuns_list"
      tabindex="-1"
    >
      <template
        v-for="group in groups"
        :key="group.key"
      >
        <h2
          v-if="group.label.kind !== 'all'"
          :class="css.workflowRuns_heading"
        >
          <button
            type="button"
            :class="css.workflowRuns_toggle"
            :aria-expanded="!folded.has(group.key)"
            @click="toggle(group)"
          >
            <component
              :is="folded.has(group.key) ? ChevronRight : ChevronDown"
              :class="css.workflowRuns_chevron"
              aria-hidden="true"
            />
            <component
              :is="describeGroup(group.label).icon"
              v-if="describeGroup(group.label).icon"
              :class="[
                css.workflowRuns_headingIcon,
                group.label.kind === 'status' && css[`workflowRuns_status_${group.label.status}`],
              ]"
              aria-hidden="true"
            />
            <span :class="describeGroup(group.label).mono && css.workflowRuns_mono">{{
              describeGroup(group.label).text
            }}</span>
            <span :class="css.workflowRuns_headingCount">{{ group.runs.length }}</span>
          </button>
        </h2>
        <template v-if="!folded.has(group.key)">
          <WorkflowRunRow
            v-for="run in group.runs"
            :key="run.id"
            :data-run-key="getRunKey(run)"
            :run="run"
            :git-ref="getRunRef(run)"
            :now="now"
            :selected="keys && selection.selectedKey === getRunKey(run)"
            @open="openRun(run)"
          />
        </template>
      </template>

      <div
        v-if="empty"
        :class="css.workflowRuns_note"
      >
        {{ empty }}
        <Button
          v-if="filtered && !callOnly"
          variant="link"
          size="sm"
          @click="emit('filter', NO_WORKFLOW_RUN_FILTERS)"
        >
          {{ t(l.clearFilters) }}
        </Button>
      </div>
      <button
        v-if="runs.status === 'failed'"
        type="button"
        :class="css.workflowRuns_failed"
        @click="emit('readMore')"
      >
        <TriangleAlert
          :class="css.workflowRuns_failedIcon"
          aria-hidden="true"
        />
        {{ t(l.readFailed) }}
        <span :class="css.workflowRuns_retry">{{ t(l.retry) }}</span>
      </button>
      <ListEndSentinel
        v-else-if="!runs.complete && !callOnly"
        :position="`${runs.runs.length}:${runs.status}`"
        @reach="readOlder"
      >
        <template v-if="runs.status === 'reading'">
          {{ runs.runs.length === 0 ? t(l.reading) : t(l.readingOlder) }}
        </template>
      </ListEndSentinel>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.workflowRuns {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.workflowRuns_toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-16;
  border-bottom: 1px solid $color-border;
}

.workflowRuns_divider {
  flex: none;
  width: 1px;
  height: 16px;
  background: $color-border-2;
}

.workflowRuns_summary {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
}

.workflowRuns_count {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.workflowRuns_list {
  flex: 1;
  min-height: 0;
  padding: $spacing-4 0 $spacing-8;
  overflow-y: auto;
  container-type: inline-size;
  outline: none;
}

.workflowRuns_heading {
  margin: 0;
  font-size: $font-size-xs;
  font-weight: $font-weight-normal;
}

.workflowRuns_toggle {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  width: 100%;
  height: 32px;
  padding: 0 $spacing-16;
  font: inherit;
  color: $color-fg-2;
  cursor: default;
  background: none;
  border: none;

  @include workflow-line-button;
}

.workflowRuns_chevron,
.workflowRuns_headingIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.workflowRuns_status_inProgress {
  color: $color-amber;
}

.workflowRuns_status_failed {
  color: $color-red;
}

.workflowRuns_status_succeeded {
  color: $color-green;
}

.workflowRuns_mono {
  font-family: $font-family-mono;
}

.workflowRuns_headingCount {
  color: $color-fg-dim;
}

.workflowRuns_note {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-12 $spacing-16;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.workflowRuns_failed {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  height: 36px;
  padding: 0 $spacing-16;
  font: inherit;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-align: left;
  cursor: default;
  background: none;
  border: none;

  @include workflow-line-button;
}

.workflowRuns_failedIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-amber;
}

.workflowRuns_retry {
  color: $color-fg-dim;
}
</style>
