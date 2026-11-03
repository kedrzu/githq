<!-- A job's log, the document the run's page is read in (actions W4a, W4d, W4h). It opens with the cursor on the failed step's first error and the lines above it in view, or at the end with no error marker. Passed steps are folded but part of the document; moving the cursor into one opens it. Only the rows in view are in the DOM, so a log of 100,000 lines stays smooth (`useLogWindow`); a wrapped line's height is estimated, then measured once it shows. Log text is untrusted, shown as text only, and a very long line is cut. Keys: J/K line (and the arrows), ⇧J/⇧K step, E/⇧E error, Space fold, G/⇧G top/end, D/U half a page, W wrap, T times, Y a link to the line, in GitHub's form. A selection with the mouse stays, its start kept in the DOM while the view moves. -->
<script lang="ts" setup>
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleAlert } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, triggerRef, useTemplateRef, watch } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Kbd from '@/components/Kbd.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { getGitHubUrl, getWorkflowRunPath } from '@/tracking/trackingRoutes.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isScreenKey } from '@/utils/isScreenKey.js';

import {
  buildLogDocument,
  getAdjacentError,
  getAdjacentLine,
  getAdjacentStepLine,
  getErrorPosition,
  getLineSection,
  getLogOpening,
  getRowSection,
} from './buildLogDocument.js';
import type { LogDocumentRow, LogSection } from './buildLogDocument.js';
import { getJobMark } from './buildWorkflowRun.js';
import { useLogWindow } from './useLogWindow.js';
import type { LogRevealMode } from './useLogWindow.js';
import { getLogLineParts, MAX_SHOWN_CHARACTERS } from './utils/getLogLineParts.js';
import type { LogLineParts, LogTextRange } from './utils/getLogLineParts.js';
import { formatLogLineHash } from './utils/logLineHash.js';
import type { LogLineAddress } from './utils/logLineHash.js';
import type { JobLogLine, ParsedJobLog } from './utils/parseJobLog.js';
import * as l from './WorkflowJobLog.loc.js';
import WorkflowLogMap from './WorkflowLogMap.vue';
import WorkflowLogStepRow from './WorkflowLogStepRow.vue';
import WorkflowLogToolbar from './WorkflowLogToolbar.vue';

const props = defineProps<{
  /** Whose log it is; its steps name the log's. */
  job: GitHubWorkflowJob;
  log: ParsedJobLog;
  /** `owner/name`. */
  nameWithOwner: string;
  runId: number;
  /** "2,086 lines · 176 KB". */
  size: string;
  /** The line the address names: the cursor goes there, now and whenever it changes. */
  address: LogLineAddress | null;
  /** What to highlight in a line's text, by the line's `number`, sorted and apart. */
  highlights?: ReadonlyMap<number, readonly LogTextRange[]>;
}>();

/** A row as it is put on the screen. */
type ShownRow =
  | { readonly kind: 'step'; readonly row: number; readonly section: LogSection }
  | {
      readonly kind: 'line';
      readonly row: number;
      readonly index: number;
      readonly line: JobLogLine;
      readonly prefix: string;
      readonly time: string | null;
      readonly text: LogLineParts;
    }
  | { readonly kind: 'end'; readonly row: number };

const LINE_HEIGHT = 18;
const STEP_HEIGHT = 26;
const END_HEIGHT = 42;
/** The gutter: the line's number and the gap after it. */
const NUMBER_WIDTH = 66;
/** The line's time and the gap after it. */
const TIME_WIDTH = 70;
const TEXT_END_PADDING = 12;
/** JetBrains Mono at 12px, until it is measured. */
const DEFAULT_CHARACTER_WIDTH = 7.2;
const MONO_FONT = '12px "JetBrains Mono", ui-monospace, monospace';
const TIME_FORMAT = new Intl.DateTimeFormat(APP_LANGUAGE, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const t = useTranslate();
const preferences = useService(LocalPreferences);
const scroller = useTemplateRef<HTMLElement>('scroller');
const list = useTemplateRef<HTMLElement>('list');

const wrap = preferences.logWrap;
const showTimes = preferences.logTimes;
const jobFailed = computed(() => getJobMark(props.job) === 'failed');
const noMarker = computed(() => jobFailed.value && !props.log.hasErrorMarker);

const opening = getLogOpening({
  log: props.log,
  steps: props.job.steps,
  jobFailed: jobFailed.value,
  address: props.address,
});
const cursor = ref(opening.cursor);
const folded = shallowRef(opening.folded);
/** Lines whose height differs from the estimate, by index: a wrapped line once seen. */
const measured = shallowRef(new Map<number, number>());
const characterWidth = ref(DEFAULT_CHARACTER_WIDTH);
const pinnedRow = ref<number | null>(null);

const logDocument = computed(() =>
  buildLogDocument({ log: props.log, steps: props.job.steps, folded: folded.value, endNote: noMarker.value }),
);
const textWidth = computed(
  () => view.viewportWidth.value - NUMBER_WIDTH - (showTimes.value ? TIME_WIDTH : 0) - TEXT_END_PADDING,
);
const heights = computed(() => {
  const { rows } = logDocument.value;
  const known = measured.value;
  const perLine = wrap.value ? Math.max(1, Math.floor(textWidth.value / characterWidth.value)) : null;
  const result = new Float64Array(rows.length);
  for (const [row, entry] of rows.entries()) {
    result[row] = getRowHeight(entry, perLine, known);
  }

  return result;
});
const view = useLogWindow({ element: scroller, heights, pinnedRow, coveredTop: STEP_HEIGHT });
let selecting = false;

/** What the widest line needs without wrapping: rows stay this wide, so the sideways scroll stands still. */
const contentWidth = computed(() => {
  let longest = 0;
  for (const line of props.log.lines) {
    longest = Math.max(longest, Math.min(line.text.length, MAX_SHOWN_CHARACTERS));
  }

  const gutter = NUMBER_WIDTH + (showTimes.value ? TIME_WIDTH : 0);
  return gutter + Math.ceil(longest * characterWidth.value) + TEXT_END_PADDING;
});
const shownRows = computed(() => {
  const { rows } = logDocument.value;
  const shown: ShownRow[] = [];
  for (let row = view.start.value; row < view.end.value; row++) {
    const entry = rows[row];
    if (entry) {
      shown.push(toShownRow(entry, row));
    }
  }

  return shown;
});
const cursorRow = computed(() => (cursor.value === null ? null : (logDocument.value.lineRows[cursor.value] ?? null)));
const cursorStepNumber = computed(() => (cursor.value === null ? null : props.log.lines[cursor.value]?.stepNumber));
const errorPosition = computed(() => (cursor.value === null ? 1 : getErrorPosition(props.log, cursor.value)));

/** What the sticky header names: the step the top of the view is in, once that step's head has left the view. */
const stickySection = computed(() => {
  const section = getRowSection(logDocument.value, view.firstVisible.value);
  return section?.headRow != null && view.scrollTop.value > view.getRowTop(section.headRow) ? section : null;
});
/** The next step's head pushes the sticky header out as it comes up to it. */
const stickyOffset = computed(() => {
  const section = stickySection.value;
  if (!section) {
    return 0;
  }

  const next = logDocument.value.sections[logDocument.value.sections.indexOf(section) + 1];
  return next?.headRow == null ? 0 : Math.min(0, view.getRowTop(next.headRow) - view.scrollTop.value - STEP_HEIGHT);
});
const mapSteps = computed(() =>
  logDocument.value.sections.flatMap(({ headRow }) => (headRow === null ? [] : [view.getRowTop(headRow)])),
);
const mapErrors = computed(() => logDocument.value.errorRows.map(row => view.getRowTop(row)));
const mapCursor = computed(() => (cursorRow.value === null ? null : view.getRowTop(cursorRow.value)));

useCommands(() => [
  {
    id: 'workflowLog.nextLine',
    title: t(l.nextLine),
    section: 'view',
    key: 'J',
    otherKeys: ['ArrowDown'],
    menu: false,
    run: () => moveByLine(1),
  },
  {
    id: 'workflowLog.previousLine',
    title: t(l.previousLine),
    section: 'view',
    key: 'K',
    otherKeys: ['ArrowUp'],
    menu: false,
    run: () => moveByLine(-1),
  },
  {
    id: 'workflowLog.nextStep',
    title: t(l.nextStep),
    section: 'view',
    key: 'Shift+J',
    menu: false,
    run: () => moveByStep(1),
  },
  {
    id: 'workflowLog.previousStep',
    title: t(l.previousStep),
    section: 'view',
    key: 'Shift+K',
    menu: false,
    run: () => moveByStep(-1),
  },
  {
    id: 'workflowLog.nextError',
    title: t(l.nextError),
    section: 'view',
    key: 'E',
    menu: false,
    run: () => moveByError(1),
  },
  {
    id: 'workflowLog.previousError',
    title: t(l.previousError),
    section: 'view',
    key: 'Shift+E',
    menu: false,
    run: () => moveByError(-1),
  },
  // Not from a button, which Space presses.
  {
    id: 'workflowLog.fold',
    title: t(l.fold),
    section: 'view',
    key: 'Space',
    menu: false,
    when: () => !isActivatableTarget(window.document.activeElement),
    run: foldCursorStep,
  },
  {
    id: 'workflowLog.top',
    title: t(l.top),
    section: 'view',
    key: 'G',
    menu: false,
    run: () => {
      moveCursor(0, 'nearest');
      view.scrollTo(0);
    },
  },
  {
    id: 'workflowLog.end',
    title: t(l.end),
    section: 'view',
    key: 'Shift+G',
    menu: false,
    run: () => {
      moveCursor(props.log.lines.length - 1, 'nearest');
      view.scrollTo(view.totalHeight.value);
    },
  },
  {
    id: 'workflowLog.halfPageDown',
    title: t(l.halfPageDown),
    section: 'view',
    key: 'D',
    menu: false,
    run: () => moveByHalfPage(1),
  },
  {
    id: 'workflowLog.halfPageUp',
    title: t(l.halfPageUp),
    section: 'view',
    key: 'U',
    menu: false,
    run: () => moveByHalfPage(-1),
  },
  {
    id: 'workflowLog.wrap',
    title: t(l.wrapLines),
    section: 'view',
    key: 'W',
    run: toggleWrap,
  },
  {
    id: 'workflowLog.times',
    title: t(l.showTimes),
    section: 'view',
    key: 'T',
    run: toggleTimes,
  },
  {
    id: 'workflowLog.copyLineLink',
    title: t(l.copyLineLink),
    section: 'view',
    key: 'Y',
    when: () => cursor.value !== null,
    run: copyLineLink,
  },
]);

// The rows moved: what was kept for a selection is another row now.
watch(logDocument, () => {
  pinnedRow.value = null;
});
watch(
  () => props.address,
  address => {
    if (address) {
      const { cursor: target } = getLogOpening({
        log: props.log,
        steps: props.job.steps,
        jobFailed: jobFailed.value,
        address,
      });
      moveCursor(target, 'context');
    }
  },
);
// What shows is laid out by now; a wrapped line says how high it really is.
watch([shownRows, wrap, view.viewportWidth], measureRows, { flush: 'post' });
// Within the change, so that `keepInPlace` around it sees the heights before and after.
watch(
  [wrap, showTimes, view.viewportWidth],
  () => {
    measured.value = new Map();
  },
  { flush: 'sync' },
);

onMounted(() => {
  characterWidth.value = measureCharacterWidth();
  if (cursorRow.value !== null) {
    view.reveal(cursorRow.value, 'context');
  }

  // Opened at the end: what the end says shows too, past any step that never got to run.
  if (noMarker.value && !props.address) {
    view.reveal(logDocument.value.rows.length - 1, 'nearest');
  }

  window.addEventListener('keydown', onKeydown);
  window.addEventListener('mouseup', stopSelecting);
  window.document.addEventListener('selectionchange', onSelectionChange);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('mouseup', stopSelecting);
  window.document.removeEventListener('selectionchange', onSelectionChange);
});

function getRowHeight(entry: LogDocumentRow, perLine: number | null, known: ReadonlyMap<number, number>) {
  switch (entry.kind) {
    case 'step':
      return STEP_HEIGHT;
    case 'end':
      return END_HEIGHT;
    case 'line': {
      if (perLine === null) {
        return LINE_HEIGHT;
      }

      const height = known.get(entry.index);
      if (height !== undefined) {
        return height;
      }

      const characters = Math.min(entry.line.text.length, MAX_SHOWN_CHARACTERS);
      return Math.max(1, Math.ceil(characters / perLine)) * LINE_HEIGHT;
    }
    default:
      return assertNever(entry);
  }
}

function toShownRow(entry: LogDocumentRow, row: number): ShownRow {
  switch (entry.kind) {
    case 'step':
      return { kind: 'step', row, section: entry.section };
    case 'end':
      return { kind: 'end', row };
    case 'line': {
      const { line, index } = entry;
      return {
        kind: 'line',
        row,
        index,
        line,
        prefix: getLinePrefix(line),
        time: showTimes.value && line.time !== null ? TIME_FORMAT.format(line.time) : null,
        text: getLogLineParts(line.text, props.highlights?.get(line.number)),
      };
    }
    default:
      return assertNever(entry);
  }
}

function getLinePrefix(line: JobLogLine) {
  switch (line.kind) {
    case 'error':
      return `${t(l.errorPrefix)} `;
    case 'warning':
      return `${t(l.warningPrefix)} `;
    default:
      return '';
  }
}

function getRange(section: LogSection) {
  const { lines } = section;
  const first = lines && props.log.lines[lines.first];
  const last = lines && props.log.lines[lines.last];
  return first && last ? { first: first.number, last: last.number } : null;
}

function moveCursor(index: number | null, mode: LogRevealMode) {
  const line = index === null ? null : props.log.lines[index];
  if (index === null || !line) {
    return;
  }

  cursor.value = index;
  if (line.stepNumber !== null && folded.value.has(line.stepNumber)) {
    const next = new Set(folded.value);
    next.delete(line.stepNumber);
    folded.value = next;
  }

  const row = logDocument.value.lineRows[index];
  if (row !== undefined) {
    view.reveal(row, mode);
  }
}

function moveByLine(by: 1 | -1) {
  if (cursor.value !== null) {
    moveCursor(getAdjacentLine(logDocument.value, cursor.value, by), 'nearest');
  }
}

function moveByStep(by: 1 | -1) {
  if (cursor.value === null) {
    return;
  }

  const target = getAdjacentStepLine(logDocument.value, cursor.value, by);
  moveCursor(target, 'nearest');
  const headRow = target === null ? null : getLineSection(logDocument.value, target)?.headRow;
  if (headRow != null) {
    view.reveal(headRow, 'top');
  }
}

function moveByError(by: 1 | -1) {
  if (cursor.value !== null) {
    moveCursor(getAdjacentError(props.log, cursor.value, by), 'context');
  }
}

function moveByHalfPage(by: 1 | -1) {
  if (cursor.value === null || cursorRow.value === null) {
    return;
  }

  const distance = (view.viewportHeight.value / 2) * by;
  const row = view.getRowAt(view.getRowTop(cursorRow.value) + distance);
  const top = view.scrollTop.value + distance;
  moveCursor(findLineFrom(row, by), 'nearest');
  view.scrollTo(top);
  revealCursor();
}

/** The line a row stands for, the way the cursor is going: past a head to its step's line, or past one with none. */
function findLineFrom(start: number, by: 1 | -1) {
  const { rows } = logDocument.value;
  for (let row = start; row >= 0 && row < rows.length; row += by) {
    const entry = rows[row];
    if (entry?.kind === 'line') {
      return entry.index;
    }

    if (entry?.kind === 'step' && entry.section.folded && entry.section.lines) {
      return by > 0 ? entry.section.lines.first : entry.section.lines.last;
    }
  }

  return by > 0 ? props.log.lines.length - 1 : 0;
}

function foldCursorStep() {
  const section = cursor.value === null ? null : getLineSection(logDocument.value, cursor.value);
  if (section?.step) {
    toggleSection(section);
    revealCursor();
  }
}

function toggleSection(section: LogSection) {
  const number = section.step?.number;
  if (number === undefined) {
    return;
  }

  const next = new Set(folded.value);
  if (!next.delete(number)) {
    next.add(number);
  }

  folded.value = next;
}

/** A head pressed, in the document or stuck on top: the keys stay the log's, and a fold from above shows its head. */
function pressHead(section: LogSection) {
  const wasAbove = section.headRow !== null && view.getRowTop(section.headRow) < view.scrollTop.value;
  toggleSection(section);
  focusLog();
  if (wasAbove && section.headRow !== null) {
    view.reveal(section.headRow, 'top');
  }
}

function toggleWrap() {
  wrap.value = !wrap.value;
  revealCursor();
}

function toggleTimes() {
  showTimes.value = !showTimes.value;
  revealCursor();
}

function revealCursor() {
  if (cursorRow.value !== null) {
    view.reveal(cursorRow.value, 'nearest');
  }
}

/** A toolbar's button pressed gives the keys back: Space folds rather than pressing it again. */
function focusLog() {
  scroller.value?.focus({ preventScroll: true });
}

function copyLineLink() {
  const line = cursor.value === null ? null : props.log.lines[cursor.value];
  if (!line) {
    return;
  }

  const hash =
    line.stepNumber !== null && line.stepLine !== null
      ? formatLogLineHash({ stepNumber: line.stepNumber, stepLine: line.stepLine })
      : '';
  void navigator.clipboard.writeText(
    `${getGitHubUrl(getWorkflowRunPath(props.nameWithOwner, props.runId, props.job.id))}${hash}`,
  );
}

function moveToMapped(y: number) {
  const entry = logDocument.value.rows[view.getRowAt(y)];
  if (entry?.kind === 'line') {
    cursor.value = entry.index;
  }

  view.scrollTo(y - view.viewportHeight.value / 2);
}

/** A line clicked takes the cursor, unless the click ended a selection. */
function clickLine(index: number) {
  if (window.getSelection()?.isCollapsed !== false) {
    cursor.value = index;
  }
}

function startSelecting(row: number) {
  pinnedRow.value = row;
  selecting = true;
}

// A press collapses any selection first: only once the button is up does a collapsed one mean there is none.
function stopSelecting() {
  selecting = false;
  onSelectionChange();
}

function onSelectionChange() {
  if (!selecting && window.getSelection()?.isCollapsed !== false) {
    pinnedRow.value = null;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!isScreenKey(event) || event.shiftKey) {
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveByLine(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveByLine(-1);
      break;
  }
}

function measureRows() {
  const rowElements = list.value?.children;
  if (!wrap.value || !rowElements) {
    return;
  }

  const rows = heights.value;
  const known = measured.value;
  let changed = false;
  for (const [position, shown] of shownRows.value.entries()) {
    const element = rowElements[position];
    if (shown.kind === 'line' && element instanceof HTMLElement) {
      const height = element.offsetHeight;
      if (height > 0 && height !== rows[shown.row]) {
        known.set(shown.index, height);
        changed = true;
      }
    }
  }

  if (changed) {
    view.keepInPlace(() => triggerRef(measured));
  }
}

function measureCharacterWidth() {
  const context = window.document.createElement('canvas').getContext('2d');
  if (!context) {
    return DEFAULT_CHARACTER_WIDTH;
  }

  context.font = MONO_FONT;
  return context.measureText('M').width;
}
</script>

<template>
  <div :class="css.workflowJobLog">
    <WorkflowLogToolbar
      :job="job.name"
      :size="size"
    >
      <span
        v-if="noMarker"
        :class="css.workflowJobLog_noMarker"
        tid="workflow-log-errors"
        >{{ t(l.noErrorMarker) }}</span
      >
      <span
        v-else-if="log.hasErrorMarker"
        :class="css.workflowJobLog_errors"
        tid="workflow-log-errors"
      >
        {{ t(l.errorPosition, { position: errorPosition, total: log.errors.length }) }}
        <Kbd keys="E" />
      </span>
      <button
        type="button"
        :class="[css.workflowJobLog_toggle, wrap && css.workflowJobLog_toggle_on]"
        :aria-pressed="wrap"
        aria-keyshortcuts="W"
        tid="workflow-log-wrap"
        @click="
          toggleWrap();
          focusLog();
        "
      >
        {{ t(l.wrap) }}
        <Kbd keys="W" />
      </button>
      <button
        type="button"
        :class="[css.workflowJobLog_toggle, showTimes && css.workflowJobLog_toggle_on]"
        :aria-pressed="showTimes"
        aria-keyshortcuts="T"
        tid="workflow-log-times"
        @click="
          toggleTimes();
          focusLog();
        "
      >
        {{ t(l.times) }}
        <Kbd keys="T" />
      </button>
    </WorkflowLogToolbar>
    <div :class="css.workflowJobLog_body">
      <div :class="css.workflowJobLog_main">
        <div
          ref="scroller"
          :class="css.workflowJobLog_scroller"
          tabindex="0"
          tid="workflow-job-log"
          @scroll.passive="view.onScroll()"
        >
          <ol
            ref="list"
            :class="[css.workflowJobLog_list, wrap && css.workflowJobLog_list_wrapped]"
            :style="{
              paddingTop: `${view.getRowTop(view.start.value)}px`,
              paddingBottom: `${view.totalHeight.value - view.getRowTop(view.end.value)}px`,
            }"
            :aria-label="job.name"
          >
            <template
              v-for="shown in shownRows"
              :key="shown.kind === 'line' ? shown.line.number : `${shown.kind}${shown.row}`"
            >
              <li
                v-if="shown.kind === 'step'"
                :class="css.workflowJobLog_step"
                :style="{ width: `${view.viewportWidth.value}px` }"
                tid="workflow-log-step"
              >
                <WorkflowLogStepRow
                  :section="shown.section"
                  :range="getRange(shown.section)"
                  :cursor="shown.section.folded && shown.section.step?.number === cursorStepNumber"
                  @toggle="pressHead(shown.section)"
                />
              </li>
              <li
                v-else-if="shown.kind === 'line'"
                :class="[
                  css.workflowJobLog_line,
                  css[`workflowJobLog_line_${shown.line.kind}`],
                  shown.row === cursorRow && css.workflowJobLog_line_cursor,
                ]"
                :style="wrap ? undefined : { width: `${contentWidth}px` }"
                :aria-current="shown.row === cursorRow ? 'true' : undefined"
                tid="workflow-log-line"
                @mousedown="startSelecting(shown.row)"
                @click="clickLine(shown.index)"
              >
                <span :class="css.workflowJobLog_gutter">
                  <span :class="css.workflowJobLog_number">{{ shown.line.number }}</span>
                  <span
                    v-if="showTimes"
                    :class="css.workflowJobLog_time"
                    >{{ shown.time }}</span
                  >
                </span>
                <span
                  :class="css.workflowJobLog_text"
                  tid="workflow-log-text"
                  >{{ shown.prefix
                  }}<template
                    v-for="(part, position) in shown.text.parts"
                    :key="position"
                    ><mark
                      v-if="part.highlighted"
                      :class="css.workflowJobLog_highlight"
                      >{{ part.text }}</mark
                    ><template v-else>{{ part.text }}</template></template
                  ><span
                    v-if="shown.text.hidden > 0"
                    :class="css.workflowJobLog_cut"
                    >{{ t(l.moreCharacters, { count: shown.text.hidden }) }}</span
                  ></span
                >
              </li>
              <li
                v-else
                :class="css.workflowJobLog_end"
                :style="{ width: `${view.viewportWidth.value}px` }"
                tid="workflow-log-end"
              >
                <CircleAlert
                  :class="css.workflowJobLog_endIcon"
                  aria-hidden="true"
                />
                {{ t(l.logEnd) }}
              </li>
            </template>
          </ol>
        </div>
        <div
          v-if="stickySection"
          :class="css.workflowJobLog_sticky"
          :style="{
            width: `${view.viewportWidth.value}px`,
            transform: stickyOffset < 0 ? `translateY(${stickyOffset}px)` : undefined,
          }"
          tid="workflow-log-sticky"
        >
          <WorkflowLogStepRow
            :section="stickySection"
            :range="getRange(stickySection)"
            @toggle="stickySection && pressHead(stickySection)"
          />
        </div>
      </div>
      <WorkflowLogMap
        :total="view.totalHeight.value"
        :view-top="view.scrollTop.value"
        :view-height="view.viewportHeight.value"
        :steps="mapSteps"
        :errors="mapErrors"
        :cursor="mapCursor"
        @move="moveToMapped"
      />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.workflowJobLog {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.workflowJobLog_noMarker {
  flex: none;
  color: $color-fg-dim;
}

.workflowJobLog_errors {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  color: $color-fg-2;
}

.workflowJobLog_toggle {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  padding: 0;
  font: inherit;
  color: $color-fg-dim;
  cursor: pointer;
  background: none;
  border: 0;
}

.workflowJobLog_toggle_on {
  color: $color-fg;
}

.workflowJobLog_body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.workflowJobLog_main {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.workflowJobLog_scroller {
  height: 100%;
  overflow: auto;
  outline: none;
}

.workflowJobLog_list {
  margin: 0;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  line-height: 18px;
  color: $color-fg-2;
  list-style: none;
  padding-inline: 0;
}

.workflowJobLog_step {
  position: sticky;
  left: 0;
  height: 26px;
}

// Exactly: a glyph from a fallback font (✓, ℹ) would make the line box a pixel higher, and every row's place is counted.
.workflowJobLog_line {
  display: flex;
  min-width: 100%;
  height: 18px;
  background: $color-bg;
}

.workflowJobLog_list_wrapped .workflowJobLog_line {
  height: auto;
  min-height: 18px;
}

.workflowJobLog_line_error {
  color: $color-fg;
  background: linear-gradient(rgba($color-red, 0.06), rgba($color-red, 0.06)), $color-bg;

  .workflowJobLog_text {
    font-weight: $font-weight-medium;
  }
}

.workflowJobLog_line_warning {
  color: $color-amber;
}

.workflowJobLog_line_group {
  color: $color-fg;
}

.workflowJobLog_line_plain {
  color: $color-fg-2;
}

.workflowJobLog_line_cursor {
  color: $color-fg;
  background: $color-sel;

  .workflowJobLog_gutter {
    box-shadow: inset 2px 0 0 $color-accent;
  }

  .workflowJobLog_number {
    color: $color-fg-2;
  }

  &.workflowJobLog_line_error {
    background: linear-gradient(rgba($color-red, 0.12), rgba($color-red, 0.12)), $color-bg;

    .workflowJobLog_gutter {
      box-shadow: inset 2px 0 0 $color-red;
    }
  }
}

// Over the text as it scrolls sideways, so the numbers stay; out of what a selection copies.
.workflowJobLog_gutter {
  position: sticky;
  left: 0;
  display: flex;
  flex: none;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  user-select: none;
  background: inherit;
}

.workflowJobLog_number {
  flex: none;
  width: 52px;
  margin-right: 14px;
  text-align: right;
}

.workflowJobLog_time {
  flex: none;
  width: 56px;
  margin-right: 14px;
}

.workflowJobLog_text {
  flex: 1;
  min-width: 0;
  padding-right: 12px;
  white-space: pre;
}

.workflowJobLog_list_wrapped .workflowJobLog_text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.workflowJobLog_highlight {
  color: $color-fg;
  background: rgba($color-amber, 0.3);
}

.workflowJobLog_cut {
  color: $color-fg-dim;
}

.workflowJobLog_end {
  position: sticky;
  left: 0;
  display: flex;
  gap: $spacing-8;
  align-items: center;
  box-sizing: border-box;
  height: 42px;
  padding: 0 $spacing-14 0 18px;
  font-family: $font-family-sans;
  color: $color-fg-2;
  background: $color-bg-2;
  border-top: 1px solid $color-border;
}

.workflowJobLog_endIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-dim;
}

.workflowJobLog_sticky {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}
</style>
