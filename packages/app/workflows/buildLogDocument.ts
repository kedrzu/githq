import type { GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { findMatchFrom } from './utils/findLogMatches.js';
import type { LogMatches } from './utils/findLogMatches.js';
import { getJobMark } from './utils/getJobMark.js';
import type { LogLineAddress } from './utils/logLineHash.js';
import type { JobLogLine, ParsedJobLog } from './utils/parseJobLog.js';

/** A row of what the log viewer shows. */
export type LogDocumentRow =
    | { readonly kind: 'step'; readonly section: LogSection }
    | {
          readonly kind: 'line';
          /** Its index in the log's `lines`. */
          readonly index: number;
          readonly line: JobLogLine;
      }
    /** Lines left out between a search's matches (W4c), as indexes into the log's `lines`, both included. */
    | { readonly kind: 'gap'; readonly first: number; readonly last: number }
    /** The note under the last row of a failed job with no error marker (W4h). */
    | { readonly kind: 'end' };

/** A step in the document, or the lines before any step, which have no head and don't fold. */
export interface LogSection {
    /** `null`: the lines before any step. */
    readonly step: GitHubWorkflowStep | null;
    /** Indexes into the log's `lines`, both included; `null` for a step with no lines, as a skipped one. */
    readonly lines: { readonly first: number; readonly last: number } | null;
    readonly folded: boolean;
    /** The row of its head; `null` with no head, or left out for having no match (W4c). */
    readonly headRow: number | null;
    /** The first row that belongs to it. */
    readonly firstRow: number;
}

/** A job's log as rows, with its folded steps' lines left out. */
export interface LogDocument {
    readonly rows: readonly LogDocumentRow[];
    readonly sections: readonly LogSection[];
    /**
     * The row each line shows in, by its index: the head of its step while that is folded, its gap while left out; past
     * a step left out for having no match, the row after where it would be.
     */
    readonly lineRows: Int32Array;
}

/** What a document is built from. */
export interface BuildLogDocumentParams {
    readonly log: ParsedJobLog;
    readonly steps: readonly GitHubWorkflowStep[];
    /** The numbers of the steps folded. */
    readonly folded: ReadonlySet<number>;
    /** The job failed with no error marker: the end of the log says why it stops there (W4h). */
    readonly endNote: boolean;
    /** Only the lines with a match, the rest as gaps and steps with none left out (W4c). */
    readonly only?: LogDocumentOnly | null;
}

/** What shows of a log that shows only a search's matches. */
export interface LogDocumentOnly {
    readonly matches: LogMatches;
    /** The gaps opened in place, by the index of their first line. */
    readonly openedGaps: ReadonlySet<number>;
}

/** Where a log opens, and how. */
export interface LogOpening {
    /** The index of the line the cursor is on; `null` in a log with no lines. */
    readonly cursor: number | null;
    /** The numbers of the steps folded. */
    readonly folded: ReadonlySet<number>;
}

/** What decides where a log opens. */
export interface GetLogOpeningParams {
    readonly log: ParsedJobLog;
    readonly steps: readonly GitHubWorkflowStep[];
    readonly jobFailed: boolean;
    /** The line the address names; `null` with none. */
    readonly address: LogLineAddress | null;
}

/** From which line, and which way, the cursor moves by one. */
export interface GetAdjacentLineParams {
    readonly document: LogDocument;
    /** The line's index in the log's `lines`. */
    readonly index: number;
    readonly by: 1 | -1;
}

/** From which line, and which way, the cursor moves by a step. */
export interface GetAdjacentStepLineParams {
    readonly document: LogDocument;
    /** The line's index in the log's `lines`. */
    readonly index: number;
    readonly by: 1 | -1;
}

/** From which line, and which way, the cursor moves to an error. */
export interface GetAdjacentErrorParams {
    readonly log: ParsedJobLog;
    /** The line's index in the log's `lines`. */
    readonly index: number;
    readonly by: 1 | -1;
}

/** Which row's lines to tell. */
export interface GetRowLinesParams {
    readonly log: ParsedJobLog;
    readonly document: LogDocument;
    readonly row: number;
}

/** A stretch of the whole log, in lines from its top by their `number`s: the first line is 0 to 1. */
export interface LogLineStretch {
    readonly from: number;
    readonly to: number;
}

/**
 * The rows of a job's log: every step's head where it ran, then its lines unless it is folded. Steps stay part of the
 * document folded; only their lines leave it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildLogDocument(params: BuildLogDocumentParams): LogDocument {
    const { log, steps, folded, endNote, only } = params;
    const positions = new Map(log.steps.map(step => [step.number, step]));
    const lineRows = new Int32Array(log.lines.length);
    const rows: LogDocumentRow[] = [];
    const sections: LogSection[] = [];

    const firstInStep = log.lines.findIndex(line => line.stepNumber !== null);
    const leading = firstInStep === -1 ? log.lines.length : firstInStep;
    if (leading > 0) {
        sections.push({
            step: null,
            lines: { first: 0, last: leading - 1 },
            folded: false,
            headRow: null,
            firstRow: 0,
        });
        addSectionLines(0, leading - 1);
    }

    for (const step of steps) {
        const position = positions.get(step.number);
        const first = position?.firstLine != null ? findLineIndex(log.lines, position.firstLine) : -1;
        const last = position?.lastLine != null ? findLineIndex(log.lines, position.lastLine) : -1;
        const lines = first === -1 || last === -1 ? null : { first, last };
        if (only && !hasMatch(lines)) {
            // Still a section: the map divides steps whatever shows.
            sections.push({ step, lines, folded: false, headRow: null, firstRow: rows.length });
            if (lines) {
                lineRows.fill(rows.length, lines.first, lines.last + 1);
            }

            continue;
        }

        const isFolded = lines !== null && folded.has(step.number);
        const headRow = rows.length;
        const section: LogSection = { step, lines, folded: isFolded, headRow, firstRow: headRow };
        sections.push(section);
        rows.push({ kind: 'step', section });

        if (lines && isFolded) {
            lineRows.fill(headRow, lines.first, lines.last + 1);
        } else if (lines) {
            addSectionLines(lines.first, lines.last);
        }
    }

    if (endNote) {
        rows.push({ kind: 'end' });
    }

    // Steps left out at the end point past the last row.
    const lastRow = Math.max(0, rows.length - 1);
    return { rows, sections, lineRows: only ? lineRows.map(row => Math.min(row, lastRow)) : lineRows };

    function hasMatch(lines: LogSection['lines']) {
        const first = lines && only ? findMatchFrom(only.matches, lines.first) : null;
        return lines !== null && first !== null && (only?.matches.lines[first] ?? Infinity) <= lines.last;
    }

    function addSectionLines(first: number, last: number) {
        if (!only) {
            addLines(first, last);
            return;
        }

        const { matches } = only;
        let at = first;
        let position = findMatchFrom(matches, first);
        while (position !== null && position < matches.lines.length) {
            const index = matches.lines[position] ?? 0;
            if (index > last) {
                break;
            }

            // A line's further matches.
            if (index >= at) {
                addGap(at, index - 1);
                addLines(index, index);
                at = index + 1;
            }

            position++;
        }

        addGap(at, last);
    }

    function addGap(first: number, last: number) {
        if (first > last) {
            return;
        }

        if (only?.openedGaps.has(first)) {
            addLines(first, last);
        } else {
            lineRows.fill(rows.length, first, last + 1);
            rows.push({ kind: 'gap', first, last });
        }
    }

    function addLines(first: number, last: number) {
        for (let index = first; index <= last; index++) {
            const line = log.lines[index];
            if (line) {
                lineRows[index] = rows.length;
                rows.push({ kind: 'line', index, line });
            }
        }
    }
}

/**
 * Where a log opens: at the first error of the failed step, else the log's first error; a failed job with no marker at
 * its end (W4h); else at its top. Passed steps are folded, except the one the cursor opens on — unless it merely
 * stands at the top of a job with nothing to show.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getLogOpening(params: GetLogOpeningParams): LogOpening {
    const { log, steps, jobFailed, address } = params;
    const folded = new Set(steps.filter(step => getJobMark(step) === 'passed').map(step => step.number));
    const named = address ? findAddressedLine(log, address) : null;
    const target = named ?? getFailureLine(log, steps, jobFailed);
    if (target === null) {
        return { cursor: log.lines.length > 0 ? 0 : null, folded };
    }

    const stepNumber = log.lines[target]?.stepNumber;
    if (stepNumber != null) {
        folded.delete(stepNumber);
    }

    return { cursor: target, folded };
}

/**
 * The section a line is in.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getLineSection(document: LogDocument, index: number) {
    return document.sections.find(({ lines }) => lines !== null && lines.first <= index && index <= lines.last) ?? null;
}

/**
 * The section a row is in: what the sticky header names for the row at the top of the view.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRowSection(document: LogDocument, row: number) {
    return document.sections.findLast(section => section.firstRow <= row) ?? null;
}

/**
 * What of the whole log a row stands for, as the log map counts it: a line itself, a folded head all its step's lines,
 * anything else nothing, at the place of what comes after it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRowLines(params: GetRowLinesParams): LogLineStretch {
    const { log, document, row } = params;
    const entry = document.rows[row];
    if (!entry) {
        const end = log.lines.at(-1)?.number ?? 0;
        return { from: end, to: end };
    }

    switch (entry.kind) {
        case 'line':
            return { from: entry.line.number - 1, to: entry.line.number };
        case 'step': {
            const { lines, folded } = entry.section;
            const first = lines && log.lines[lines.first];
            const last = lines && log.lines[lines.last];
            if (folded && first && last) {
                return { from: first.number - 1, to: last.number };
            }

            const { from } = getRowLines({ log, document, row: row + 1 });
            return { from, to: from };
        }
        case 'gap': {
            const first = log.lines[entry.first];
            const last = log.lines[entry.last];
            return first && last
                ? { from: first.number - 1, to: last.number }
                : getRowLines({ log, document, row: row + 1 });
        }
        case 'end':
            return getRowLines({ log, document, row: row + 1 });
        default:
            return assertNever(entry);
    }
}

/**
 * The line at a place of the whole log, as an index, counted as {@link getRowLines} does: the next one where a line isn't
 * shown, the last past the end, `null` in a log with no lines.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findLineAt(log: ParsedJobLog, position: number) {
    const { lines } = log;
    if (lines.length === 0) {
        return null;
    }

    let low = 0;
    let high = lines.length - 1;
    while (low < high) {
        const middle = (low + high) >> 1;
        if ((lines[middle]?.number ?? 0) > position) {
            high = middle;
        } else {
            low = middle + 1;
        }
    }

    return low;
}

/**
 * The line a cursor moves to by one (J/K): the next or previous line, from a folded step the nearest line of another
 * step, since its own are not there to step through. `null` at the end of the log.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getAdjacentLine(params: GetAdjacentLineParams) {
    const { document, index, by } = params;
    const section = getLineSection(document, index);
    if (section?.folded && section.lines) {
        return getLineNextTo(document, by > 0 ? section.lines.last : section.lines.first, by);
    }

    return getLineNextTo(document, index, by);
}

/**
 * The first line of the next or previous step that has lines (⇧J/⇧K); `null` past the last or the first.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getAdjacentStepLine(params: GetAdjacentStepLineParams) {
    const { document, index, by } = params;
    const steps = document.sections.filter(
        section => section.step !== null && section.lines !== null && section.headRow !== null,
    );
    const at = steps.findIndex(({ lines }) => lines !== null && lines.first <= index && index <= lines.last);
    // Before the first step: its next is the first, and it has no previous.
    const next = steps[at === -1 ? (by > 0 ? 0 : -1) : at + by];
    return next?.lines?.first ?? null;
}

/**
 * The next or previous error from a line (E/⇧E), as an index; `null` when there is none that way.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getAdjacentError(params: GetAdjacentErrorParams) {
    const { log, index, by } = params;
    const from = log.lines[index]?.number ?? 0;
    const number = by > 0 ? log.errors.find(error => error > from) : log.errors.findLast(error => error < from);
    return number === undefined ? null : findLineIndex(log.lines, number);
}

/**
 * Which error the toolbar counts at a line: "Error 2 of 5" from the second error up to the third, the first before it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getErrorPosition(log: ParsedJobLog, index: number) {
    const number = log.lines[index]?.number ?? 0;
    let position = 0;
    for (const error of log.errors) {
        if (error > number) {
            break;
        }

        position++;
    }

    return Math.max(position, 1);
}

function getLineNextTo(document: LogDocument, index: number, by: 1 | -1) {
    const next = index + by;
    return next >= 0 && next < document.lineRows.length ? next : null;
}

/** The line an address names, or the nearest one above it: GitHub counts lines of a step this log doesn't show. */
function findAddressedLine(log: ParsedJobLog, address: LogLineAddress) {
    let found: number | null = null;
    for (const [index, line] of log.lines.entries()) {
        if (line.stepNumber === address.stepNumber && line.stepLine !== null && line.stepLine <= address.stepLine) {
            found = index;
        }
    }

    return found;
}

function getFailureLine(log: ParsedJobLog, steps: readonly GitHubWorkflowStep[], jobFailed: boolean) {
    if (log.errors.length > 0) {
        const failedStep = log.steps.find(({ number }) =>
            steps.some(step => step.number === number && getJobMark(step) === 'failed'),
        );
        const { firstLine, lastLine } = failedStep ?? { firstLine: null, lastLine: null };
        const inStep =
            firstLine !== null && lastLine !== null
                ? log.errors.find(error => firstLine <= error && error <= lastLine)
                : undefined;
        return findLineIndex(log.lines, inStep ?? log.errors[0] ?? 0);
    }

    return jobFailed && log.lines.length > 0 ? log.lines.length - 1 : null;
}

/** The index of the line of this `number`, which have gaps; -1 with none. */
function findLineIndex(lines: readonly JobLogLine[], number: number) {
    let low = 0;
    let high = lines.length - 1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        const found = lines[middle]?.number ?? 0;
        if (found === number) {
            return middle;
        }

        if (found < number) {
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }

    return -1;
}
