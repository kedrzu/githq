<!-- An opened workflow's Details (actions W30, W42): what starts it (Triggers, from its file at the default branch: each event with its branches or tags — a pull request's never counting —, a dispatch with how many inputs; or why the file says nothing: GitHub generates the workflow, the file is being read, could not be read, is missing, not YAML or names no trigger), how it stands on each ref that counts (Counts on: broken or passing since which run, how many in a row, or no runs there yet), its runs (the last success, the typical run — the median of the last 20 successful ones —, the run going now), what a dispatch asks for (Dispatch inputs: name, type, default, choices) and the workflow itself (File, State). Each value has its icon; a dim line under it says more. -->
<script lang="ts" setup>
import type { GitHubWorkflowTrigger, WorkflowInput } from '@githq/github/workflows/parseWorkflowFile.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  FileCode,
  GitCommitHorizontal,
  GitPullRequest,
  Layers,
  List,
  LoaderCircle,
  Play,
  Timer,
  ToggleLeft,
  Type,
  Workflow,
  Zap,
} from 'lucide-vue-next';
import { computed } from 'vue';

import { formatDuration } from '@/utils/formatDuration.js';

import type { WorkflowCountedRef, WorkflowDetails } from './buildWorkflowDetails.js';
import { useDescribeRunWhen } from './useDescribeRunWhen.js';
import * as l from './WorkflowDetails.loc.js';

const props = defineProps<{
  details: WorkflowDetails;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

/** One row of a section: a name, a value with its icon, a dim line under it. */
interface DetailRow {
  readonly key: string;
  readonly name: string;
  /** The name is code (an event, a ref, an input): in mono. */
  readonly code: boolean;
  readonly icon: LucideIcon;
  readonly tone?: 'red' | 'green' | 'amber';
  readonly value: string;
  /** The value is code (a path, a default): in mono. */
  readonly valueCode?: boolean;
  readonly hint?: string;
}

/** A section of the details: its heading and rows, or a sentence in place of rows. */
interface DetailSection {
  readonly key: string;
  readonly title: string;
  readonly rows: readonly DetailRow[];
  readonly note?: string;
}

const t = useTranslate();
const describeRunWhen = useDescribeRunWhen();

const sections = computed((): DetailSection[] => {
  const sectionList: DetailSection[] = [getTriggers(), getCountsOn(), getRuns()];
  const { file } = props.details;
  const inputs = file.kind === 'parsed' ? (file.file.dispatch?.inputs ?? []) : [];
  if (inputs.length > 0) {
    sectionList.push({ key: 'inputs', title: t(l.dispatchInputs), rows: inputs.map(getInputRow) });
  }

  sectionList.push(getWorkflow());
  return sectionList;
});

function getTriggers(): DetailSection {
  const { file } = props.details;
  const base = { key: 'triggers', title: t(l.triggers) };
  switch (file.kind) {
    case 'parsed':
      return {
        ...base,
        rows: file.file.triggers.map(getTriggerRow),
        note: file.file.callOnly ? t(l.calledOnlyHint) : undefined,
      };
    case 'generated':
      return { ...base, rows: [], note: t(l.generated) };
    case 'loading':
      return { ...base, rows: [], note: t(l.reading) };
    case 'failed':
      return { ...base, rows: [], note: t(l.readFailed) };
    case 'missing':
      return { ...base, rows: [], note: t(l.missing) };
    case 'notYaml':
      return { ...base, rows: [], note: t(l.notYaml) };
    case 'noTriggers':
      return { ...base, rows: [], note: t(l.noTriggers) };
    default:
      return assertNever(file);
  }
}

function getTriggerRow(trigger: GitHubWorkflowTrigger, index: number): DetailRow {
  const base = { key: `${index}:${trigger.event}`, name: trigger.event, code: true };
  switch (trigger.event) {
    case 'push':
      return { ...base, icon: GitCommitHorizontal, value: describeRefs(trigger) };
    case 'pull_request':
    case 'pull_request_target':
      return {
        ...base,
        icon: GitPullRequest,
        value: trigger.branches ? t(l.intoBranches, { patterns: trigger.branches.join(', ') }) : t(l.anyPullRequest),
        hint: t(l.neverCounts),
      };
    case 'schedule':
      return { ...base, icon: CalendarClock, value: t(l.onSchedule) };
    case 'workflow_dispatch': {
      const { file } = props.details;
      const count = file.kind === 'parsed' ? (file.file.dispatch?.inputs.length ?? 0) : 0;
      return { ...base, icon: Play, value: count === 0 ? t(l.manually) : t(l.inputs, { count }) };
    }
    case 'workflow_call':
      return { ...base, icon: Workflow, value: t(l.calledOnly) };
    default:
      return { ...base, icon: Zap, value: describeRefs(trigger) };
  }
}

function describeRefs(trigger: GitHubWorkflowTrigger) {
  const parts: string[] = [];
  if (trigger.branches) {
    parts.push(t(l.branches, { patterns: trigger.branches.join(', ') }));
  }

  if (trigger.tags) {
    parts.push(t(l.tags, { patterns: trigger.tags.join(', ') }));
  }

  if (trigger.branchesIgnore) {
    parts.push(t(l.branchesIgnore, { patterns: trigger.branchesIgnore.join(', ') }));
  }

  if (trigger.tagsIgnore) {
    parts.push(t(l.tagsIgnore, { patterns: trigger.tagsIgnore.join(', ') }));
  }

  return parts.length > 0 ? parts.join(' · ') : t(l.anyRef);
}

function getCountsOn(): DetailSection {
  const { countsOn } = props.details;
  return {
    key: 'countsOn',
    title: t(l.countsOn),
    rows: countsOn.map(getCountedRow),
    note: countsOn.length === 0 ? t(l.nothingCounts) : undefined,
  };
}

function getCountedRow(counted: WorkflowCountedRef): DetailRow {
  const { group, state, refKind, streak } = counted;
  const name = group.kind === 'defaultBranch' ? group.branch : group.pattern;
  const hint =
    streak &&
    t(streak.verdict === 'failed' ? l.failedStreak : l.passedStreak, {
      count: streak.count,
      number: streak.since.runNumber,
    });
  const base = { key: name, name, code: true, hint: hint ?? undefined };
  switch (state) {
    case 'broken':
      return { ...base, icon: CircleX, tone: 'red', value: t(l.broken) };
    case 'passing':
      return { ...base, icon: CircleCheck, tone: 'green', value: t(l.passing) };
    case 'unknown':
      return { ...base, icon: CircleDashed, value: t(l.noRunsOn, { kind: t(refKind === 'tag' ? l.tag : l.branch) }) };
    default:
      return assertNever(state);
  }
}

function getRuns(): DetailSection {
  const { lastSuccess, typicalDurationMs, running } = props.details;
  const rows: DetailRow[] = [
    lastSuccess
      ? {
          key: 'lastSuccess',
          name: t(l.lastSuccess),
          code: false,
          icon: CircleCheck,
          tone: 'green',
          value: t(l.runWhen, {
            number: lastSuccess.runNumber,
            when: describeRunWhen(lastSuccess.createdAt, props.now),
          }),
          hint: lastSuccess.displayTitle,
        }
      : { key: 'lastSuccess', name: t(l.lastSuccess), code: false, icon: CircleDashed, value: t(l.noSuccess) },
  ];
  if (typicalDurationMs !== null) {
    rows.push({
      key: 'typical',
      name: t(l.typicalRun),
      code: false,
      icon: Timer,
      value: formatDuration(typicalDurationMs),
      hint: t(l.typicalRunHint),
    });
  }

  if (running) {
    const started = Date.parse(running.runStartedAt ?? running.createdAt);
    rows.push({
      key: 'running',
      name: t(l.running),
      code: false,
      icon: LoaderCircle,
      tone: 'amber',
      value: t(l.runWhen, { number: running.runNumber, when: formatDuration(Math.max(0, props.now - started)) }),
      hint: running.displayTitle,
    });
  }

  return { key: 'runs', title: t(l.runs), rows };
}

function getInputRow(input: WorkflowInput): DetailRow {
  const value = input.default === undefined ? '—' : String(input.default);
  const hint =
    input.type === 'choice' && input.options
      ? t(l.choice, { options: input.options.join(', ') })
      : t(input.required ? l.required : l.optional, { type: input.type });
  return { key: input.name, name: input.name, code: true, icon: getInputIcon(input), value, valueCode: true, hint };
}

function getInputIcon(input: WorkflowInput): LucideIcon {
  switch (input.type) {
    case 'choice':
      return List;
    case 'boolean':
      return ToggleLeft;
    case 'environment':
      return Layers;
    case 'string':
    case 'number':
      return Type;
    default:
      return assertNever(input.type);
  }
}

function getWorkflow(): DetailSection {
  const { workflow, active } = props.details;
  return {
    key: 'workflow',
    title: t(l.workflow),
    rows: [
      { key: 'file', name: t(l.file), code: false, icon: FileCode, value: workflow.path, valueCode: true },
      {
        key: 'state',
        name: t(l.state),
        code: false,
        icon: active ? CircleCheck : CircleSlash,
        value: active ? t(l.enabled) : t(l.disabled),
      },
    ],
  };
}
</script>

<template>
  <div
    :class="css.workflowDetails"
    :aria-label="t(l.label)"
    role="region"
  >
    <section
      v-for="section in sections"
      :key="section.key"
      :class="css.workflowDetails_section"
    >
      <h2 :class="css.workflowDetails_title">{{ section.title }}</h2>
      <dl
        v-if="section.rows.length > 0"
        :class="css.workflowDetails_rows"
      >
        <div
          v-for="row in section.rows"
          :key="row.key"
          :class="css.workflowDetails_row"
        >
          <dt :class="[css.workflowDetails_name, row.code && css.workflowDetails_code]">{{ row.name }}</dt>
          <dd :class="css.workflowDetails_value">
            <span :class="css.workflowDetails_line">
              <component
                :is="row.icon"
                :class="[css.workflowDetails_icon, row.tone && css[`workflowDetails_icon_${row.tone}`]]"
                aria-hidden="true"
              />
              <span :class="row.valueCode && css.workflowDetails_code">{{ row.value }}</span>
            </span>
            <span
              v-if="row.hint"
              :class="css.workflowDetails_hint"
              >{{ row.hint }}</span
            >
          </dd>
        </div>
      </dl>
      <p
        v-if="section.note"
        :class="css.workflowDetails_note"
      >
        {{ section.note }}
      </p>
    </section>
  </div>
</template>

<style lang="scss" module="css">
.workflowDetails {
  display: flex;
  flex-direction: column;
  gap: $spacing-24;
  padding: $spacing-20 $spacing-24 $spacing-32;
}

.workflowDetails_title {
  margin: 0 0 $spacing-10;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.workflowDetails_rows {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  margin: 0;
}

.workflowDetails_row {
  display: grid;
  grid-template-columns: minmax(96px, 2fr) 5fr;
  gap: $spacing-12;
  font-size: $font-size-sm;
}

.workflowDetails_name {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowDetails_code {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
}

.workflowDetails_value {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
  margin: 0;
}

.workflowDetails_line {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
  color: $color-fg;
  overflow-wrap: anywhere;
}

.workflowDetails_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.workflowDetails_icon_red {
  color: $color-red;
}

.workflowDetails_icon_green {
  color: $color-green;
}

.workflowDetails_icon_amber {
  color: $color-amber;
}

.workflowDetails_hint,
.workflowDetails_note {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.workflowDetails_note {
  margin: 0;
}
</style>
