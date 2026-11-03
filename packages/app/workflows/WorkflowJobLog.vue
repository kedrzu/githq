<!-- A job's log, the document the run's page is read in (actions W4a, W4d, W4h). It opens with the cursor on the failed step's first error and the lines above it in view, or at the end with no error marker. Passed steps are folded but part of the document; moving the cursor into one opens it. Only the rows in view are in the DOM, so a log of 100,000 lines stays smooth (`useLogWindow`); a wrapped line's height is estimated, then measured once it shows. Log text is untrusted: shown as text only, its bidi and invisible characters as what they are, each isolated from the text around it, in the DOM as they were so that they copy; and a very long line is cut, "… N more characters" opening the rest of it, wrapped, whichever way the others go. Keys: J/K line (and the arrows), ⇧J/⇧K step, E/⇧E error, Space fold, G/⇧G top/end, D/U half a page, Enter the rest of a line cut, Y a link to the line, in GitHub's form; W and T are `WorkflowLogToolbar`'s. A selection with the mouse stays, its start kept in the DOM while the view moves. -->
<script lang="ts" setup>
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
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
  findLineAt,
  getAdjacentError,
  getAdjacentLine,
  getAdjacentStepLine,
  getErrorPosition,
  getLineSection,
  getLogOpening,
  getRowLines,
  getRowSection,
} from './buildLogDocument.js';
import type { LogDocumentRow, LogSection } from './buildLogDocument.js';
import { useLogWindow } from './useLogWindow.js';
import type { LogRevealMode } from './useLogWindow.js';
import { getJobMark } from './utils/getJobMark.js';
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
      /** It shows whole, past the cut: wrapped, whatever the others do. */
      readonly whole: boolean;
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
const noMarker = computed(() => jobFailed.value && props.log.errors.length === 0);

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
/** The lines shown past the cut, by index. */
const wholeLines = shallowRef(new Set<number>());

const logDocument = computed(() =>
  buildLogDocument({ log: props.log, steps: props.job.steps, folded: folded.value, endNote: noMarker.value }),
);
const gutterWidth = computed(() => NUMBER_WIDTH + (showTimes.value ? TIME_WIDTH : 0));
const textWidth = computed(() => view.viewportWidth - gutterWidth.value - TEXT_END_PADDING);
const heights = computed(() => {
  const { rows } = logDocument.value;
  const known = measured.value;
  const perLine = Math.max(1, Math.floor(textWidth.value / characterWidth.value));
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

  return gutterWidth.value + Math.ceil(longest * characterWidth.value) + TEXT_END_PADDING;
});
const shownRows = computed(() => {
  const { rows } = logDocument.value;
  const shown: ShownRow[] = [];
  for (let row = view.start; row < view.end; row++) {
    const entry = rows[row];
    if (entry) {
      shown.push(toShownRow(entry, row));
    }
  }

  return shown;
});
const cursorRow = computed(() => (cursor.value === null ? null : (logDocument.value.lineRows[cursor.value] ?? null)));
const cursorLineCut = computed(() => {
  const index = cursor.value;
  return (
    index !== null && (props.log.lines[index]?.text.length ?? 0) > MAX_SHOWN_CHARACTERS && !wholeLines.value.has(index)
  );
});
const cursorStepNumber = computed(() => (cursor.value === null ? null : props.log.lines[cursor.value]?.stepNumber));
const errorPosition = computed(() => (cursor.value === null ? 1 : getErrorPosition(props.log, cursor.value)));

/** What the sticky header names: the step the top of the view is in, once that step's head has left the view. */
const stickySection = computed(() => {
  const section = getRowSection(logDocument.value, view.firstVisible);
  return section?.headRow != null && view.scrollTop > view.getRowTop(section.headRow) ? section : null;
});
/** The next step's head pushes the sticky header out as it comes up to it. */
const stickyOffset = computed(() => {
  const section = stickySection.value;
  if (!section) {
    return 0;
  }

  const next = logDocument.value.sections[logDocument.value.sections.indexOf(section) + 1];
  return next?.headRow == null ? 0 : Math.min(0, view.getRowTop(next.headRow) - view.scrollTop - STEP_HEIGHT);
});
// The map shows the whole log, in lines by their numbers: what is folded keeps its place on it. A log shorter than the
// view takes the height of its lines, not the map's whole.
const mapTotal = computed(() => Math.max(props.log.lines.at(-1)?.number ?? 0, view.viewportHeight / LINE_HEIGHT));
const mapViewTop = computed(() => getMapPlace(view.scrollTop));
const mapViewBottom = computed(() => getMapPlace(view.scrollTop + view.viewportHeight));
// Where one step gives way to the next: nothing above the log's first line.
const mapSteps = computed(() =>
  logDocument.value.sections.flatMap(({ lines }) => {
    const line = lines && lines.first > 0 ? props.log.lines[lines.first] : null;
    return line ? [line.number - 1] : [];
  }),
);
const mapErrors = computed(() => props.log.errors.map(number => number - 1));
const mapCursor = computed(() => {
  const line = cursor.value === null ? null : props.log.lines[cursor.value];
  return line ? line.number - 1 : null;
});

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
      view.scrollTo(view.totalHeight);
      revealCursor();
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
  // Not from a button, which Enter presses.
  {
    id: 'workflowLog.wholeLine',
    title: t(l.showWholeLine),
    section: 'view',
    key: 'Enter',
    menu: false,
    when: () => cursorLineCut.value && !isActivatableTarget(window.document.activeElement),
    run: () => {
      if (cursor.value !== null) {
        showWholeLine(cursor.value);
      }
    },
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

// The rows moved: what was kept for a selection is another row now. Not on the document, which each 200 on the jobs'
// poll builds anew with every row where it was.
watch(folded, () => {
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
watch([shownRows, wrap, () => view.viewportWidth], measureRows, { flush: 'post' });
// Within the change, so that `keepInPlace` around it sees the heights before and after.
watch(() => view.viewportWidth, forgetMeasured, { flush: 'sync' });
watch(
  [wrap, showTimes],
  () => {
    forgetMeasured();
    revealCursor();
  },
  { flush: 'sync' },
);

onWindowEvent('keydown', onKeydown);
onWindowEvent('mouseup', stopSelecting);
onMounted(() => {
  characterWidth.value = measureCharacterWidth();
  if (cursorRow.value !== null) {
    view.reveal(cursorRow.value, 'context');
  }

  // Opened at the end: what the end says shows too, past any step that never got to run.
  if (noMarker.value && !props.address) {
    view.reveal(logDocument.value.rows.length - 1, 'nearest');
  }

  window.document.addEventListener('selectionchange', onSelectionChange);
});
onBeforeUnmount(() => window.document.removeEventListener('selectionchange', onSelectionChange));

function forgetMeasured() {
  measured.value = new Map();
}

function getRowHeight(entry: LogDocumentRow, perLine: number, known: ReadonlyMap<number, number>) {
  switch (entry.kind) {
    case 'step':
      return STEP_HEIGHT;
    case 'end':
      return END_HEIGHT;
    case 'line': {
      const whole = wholeLines.value.has(entry.index);
      if (!wrap.value && !whole) {
        return LINE_HEIGHT;
      }

      const height = known.get(entry.index);
      if (height !== undefined) {
        return height;
      }

      const characters = whole ? entry.line.text.length : Math.min(entry.line.text.length, MAX_SHOWN_CHARACTERS);
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
      const whole = wholeLines.value.has(index);
      return {
        kind: 'line',
        row,
        index,
        line,
        prefix: getLinePrefix(line),
        time: showTimes.value && line.time !== null ? TIME_FORMAT.format(line.time) : null,
        text: getLogLineParts(line.text, { ranges: props.highlights?.get(line.number), whole }),
        whole,
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
    case 'group':
    case 'plain':
      return '';
    default:
      return assertNever(line.kind);
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
    moveCursor(getAdjacentLine({ document: logDocument.value, index: cursor.value, by }), 'nearest');
  }
}

function moveByStep(by: 1 | -1) {
  if (cursor.value === null) {
    return;
  }

  const target = getAdjacentStepLine({ document: logDocument.value, index: cursor.value, by });
  moveCursor(target, 'nearest');
  const headRow = target === null ? null : getLineSection(logDocument.value, target)?.headRow;
  if (headRow != null) {
    view.reveal(headRow, 'top');
  }
}

function moveByError(by: 1 | -1) {
  if (cursor.value !== null) {
    moveCursor(getAdjacentError({ log: props.log, index: cursor.value, by }), 'context');
  }
}

function moveByHalfPage(by: 1 | -1) {
  if (cursor.value === null || cursorRow.value === null) {
    return;
  }

  const distance = (view.viewportHeight / 2) * by;
  const row = view.getRowAt(view.getRowTop(cursorRow.value) + distance);
  const top = view.scrollTop + distance;
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
  const wasAbove = section.headRow !== null && view.getRowTop(section.headRow) < view.scrollTop;
  toggleSection(section);
  focusLog();
  // The rows below it are others now: what was brought into view last would be taken for another line.
  view.scrollTo(view.scrollTop);
  if (wasAbove && section.headRow !== null) {
    view.reveal(section.headRow, 'top');
  }
}

/**
 * Shows a line past the cut, the view staying where it is. What is to bring a search's hit past the cut into the open
 * calls this too.
 */
function showWholeLine(index: number) {
  measured.value.delete(index);
  wholeLines.value = new Set(wholeLines.value).add(index);
  // It is laid out from the view's left edge now.
  if (!wrap.value) {
    scroller.value?.scrollTo({ left: 0 });
  }

  // A row this tall has no "nearest" place: what was brought into view last would be taken to the line's far end.
  view.scrollTo(view.scrollTop);
}

function revealCursor() {
  if (cursorRow.value !== null) {
    view.reveal(cursorRow.value, 'nearest');
  }
}

/** A button pressed gives the keys back: Space folds rather than pressing it again. */
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
  const { nameWithOwner, runId, job } = props;
  void navigator.clipboard.writeText(
    `${getGitHubUrl(getWorkflowRunPath({ nameWithOwner, runId, jobId: job.id }))}${hash}`,
  );
}

/** The place in the whole log of a place in the document. */
function getMapPlace(y: number) {
  const row = view.getRowAt(y);
  const { from, to } = getRowLines({ log: props.log, document: logDocument.value, row });
  const top = view.getRowTop(row);
  const height = view.getRowTop(row + 1) - top;
  return height > 0 ? from + (to - from) * Math.min(1, (y - top) / height) : from;
}

/** A click on the map: the line there takes the cursor, its step opening, in the middle of the view. */
function moveToMapped(place: number) {
  const index = findLineAt(props.log, place);
  moveCursor(index, 'nearest');
  const row = index === null ? undefined : logDocument.value.lineRows[index];
  if (row !== undefined) {
    view.scrollTo(view.getRowTop(row) - view.viewportHeight / 2);
  }
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
  if (!rowElements) {
    return;
  }

  const rows = heights.value;
  const known = measured.value;
  let changed = false;
  for (const [position, shown] of shownRows.value.entries()) {
    const element = rowElements[position];
    if (shown.kind === 'line' && (wrap.value || shown.whole) && element instanceof HTMLElement) {
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
      @pressed="focusLog"
    >
      <span
        v-if="noMarker"
        :class="css.workflowJobLog_noMarker"
        tid="workflow-log-errors"
        >{{ t(l.noErrorMarker) }}</span
      >
      <span
        v-else-if="log.errors.length > 0"
        :class="css.workflowJobLog_errors"
        tid="workflow-log-errors"
      >
        {{ t(l.errorPosition, { position: errorPosition, total: log.errors.length }) }}
        <Kbd keys="E" />
      </span>
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
              paddingTop: `${view.getRowTop(view.start)}px`,
              paddingBottom: `${view.totalHeight - view.getRowTop(view.end)}px`,
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
                :style="{ width: `${view.viewportWidth}px` }"
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
                  shown.whole && css.workflowJobLog_line_whole,
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
                  :class="[css.workflowJobLog_text, shown.whole && css.workflowJobLog_text_whole]"
                  :style="
                    shown.whole ? { width: `${textWidth + TEXT_END_PADDING}px`, left: `${gutterWidth}px` } : undefined
                  "
                  tid="workflow-log-text"
                  >{{ shown.prefix
                  }}<span
                    v-for="(chunk, chunkIndex) in shown.text.chunks"
                    :key="chunkIndex"
                    :class="shown.text.chunks.length > 1 && css.workflowJobLog_chunk"
                    ><template
                      v-for="(part, position) in chunk"
                      :key="position"
                      ><span
                        v-if="part.control"
                        :class="[css.workflowJobLog_control, part.highlighted && css.workflowJobLog_highlight]"
                        :data-control="part.control"
                        >{{ part.text }}</span
                      ><mark
                        v-else-if="part.highlighted"
                        :class="css.workflowJobLog_highlight"
                        >{{ part.text }}</mark
                      ><template v-else>{{ part.text }}</template></template
                    ></span
                  ><button
                    v-if="shown.text.hidden > 0"
                    type="button"
                    :class="css.workflowJobLog_cut"
                    aria-keyshortcuts="Enter"
                    tid="workflow-log-more"
                    @click="
                      showWholeLine(shown.index);
                      focusLog();
                    "
                  >
                    {{ t(l.moreCharacters, { count: shown.text.hidden }) }}
                    <Kbd
                      v-if="shown.row === cursorRow"
                      keys="Enter"
                      size="sm"
                    /></button
                ></span>
              </li>
              <li
                v-else
                :class="css.workflowJobLog_end"
                :style="{ width: `${view.viewportWidth}px` }"
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
            width: `${view.viewportWidth}px`,
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
        :total="mapTotal"
        :view-top="mapViewTop"
        :view-height="mapViewBottom - mapViewTop"
        :height="view.viewportHeight"
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

// The focus ring of the scroller, over it: Chromium paints its own outline under the sticky rows and heads, and clips
// one outside it here. A click on a line, which focuses it too, is not `:focus-visible`.
.workflowJobLog_main:has(> .workflowJobLog_scroller:focus-visible)::after {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  content: '';
  box-shadow: inset 0 0 0 2px $color-focus;
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

.workflowJobLog_line_whole {
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
  margin-right: $spacing-14;
  text-align: right;
}

.workflowJobLog_time {
  flex: none;
  width: 56px;
  margin-right: $spacing-14;
}

.workflowJobLog_text {
  flex: 1;
  min-width: 0;
  padding-right: $spacing-12;
  white-space: pre;
}

.workflowJobLog_list_wrapped .workflowJobLog_text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

// Held still by the sides of the view while the other lines scroll sideways; its size is set from what the view has.
.workflowJobLog_text_whole {
  position: sticky;
  flex: none;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.workflowJobLog_chunk {
  display: block;
}

.workflowJobLog_highlight {
  color: $color-fg;
  background: rgba($color-amber, 0.3);
}

// Held at the edge of the view: the end of a line cut lies thousands of pixels off to the side, or below, if wrapped.
.workflowJobLog_cut {
  @include focus-ring;

  position: sticky;
  right: 0;
  bottom: 0;
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  height: 18px;
  padding: 0 $spacing-6;
  font: inherit;
  color: $color-fg-dim;
  vertical-align: top;
  cursor: pointer;
  user-select: none;
  background: $color-bg-2;
  border: 0;

  &:hover {
    color: $color-fg-2;
  }
}

// `isolate`: what the character does to the direction of text ends at the end of this element, which it is alone in.
.workflowJobLog_control {
  padding-inline: $spacing-2;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  background: $color-bg-3;
  border-radius: $radius-sm;
  unicode-bidi: isolate;

  &::before {
    content: attr(data-control);
  }
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
