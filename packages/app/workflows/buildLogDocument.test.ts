/// <reference types="bun" />
import type { GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import { expect, test } from 'bun:test';

import {
    buildLogDocument,
    findLineAt,
    getAdjacentError,
    getAdjacentLine,
    getAdjacentStepLine,
    getErrorPosition,
    getLineSection,
    getLogOpening,
    getNearestShownLine,
    getRowLines,
    getRowSection,
} from './buildLogDocument.js';
import type { LogDocument } from './buildLogDocument.js';
import { findLogMatches } from './utils/findLogMatches.js';
import { parseJobLog } from './utils/parseJobLog.js';

const STEPS = [
    step(1, 'Set up job', 'success'),
    step(2, 'Lint', 'failure'),
    step(3, 'Upload', 'skipped'),
    step(4, 'Build', 'failure'),
    step(5, 'Complete job', 'success'),
];
const TEXT = [
    line(1, 'a'),
    line(1, '##[group]b'),
    line(1, '##[endgroup]'),
    line(1, 'c'),
    line(2, 'd'),
    line(2, 'e'),
    line(4, 'f'),
    line(4, '##[error]g'),
    line(4, 'h'),
    line(4, '##[error]i'),
    line(5, 'j'),
].join('\n');
const LOG = parseJobLog(TEXT, STEPS);

test('every step has its head where it ran, its lines under it unless folded; a skipped step has a head with no lines', () => {
    expect(describe(document(new Set([1, 5])))).toEqual([
        'step 1 folded',
        'step 2',
        'd',
        'e',
        'step 3',
        'step 4',
        'f',
        'g',
        'h',
        'i',
        'step 5 folded',
    ]);
    expect(getLineSection(document(new Set()), 0)?.lines).toEqual({ first: 0, last: 2 });
    expect(document(new Set()).sections[2]?.lines).toBeNull();
});

test('a line folded away shows at its step’s head', () => {
    const folded = document(new Set([4]));

    expect(folded.lineRows[7]).toBe(folded.sections[3]?.headRow ?? -1);
});

test('a row stands for its line, by the whole log’s numbers; a folded head for all its step’s; any other head for nothing, at what comes next', () => {
    const built = document(new Set([1, 5]));
    const linesOf = (row: number) => getRowLines({ log: LOG, document: built, row });

    // Step 1 is lines 1 to 4, the third being the `##[endgroup]`, not shown but counted.
    expect(linesOf(0)).toEqual({ from: 0, to: 4 });
    // The head of step 2 stands where its first line starts.
    expect(linesOf(1)).toEqual({ from: 4, to: 4 });
    expect(linesOf(2)).toEqual({ from: 4, to: 5 });
    // The skipped step has no lines: it stands where step 4's start.
    expect(linesOf(4)).toEqual({ from: 6, to: 6 });
    expect(linesOf(10)).toEqual({ from: 10, to: 11 });
    expect(linesOf(11)).toEqual({ from: 11, to: 11 });
});

test('the end note and a head with nothing after it stand at the end of the log', () => {
    const steps = [step(1, 'Set up job', 'success'), step(2, 'Upload', 'skipped')];
    const log = parseJobLog(line(1, 'a'), steps);
    const built = buildLogDocument({ log, steps, folded: new Set(), endNote: true });

    expect(getRowLines({ log, document: built, row: 2 })).toEqual({ from: 1, to: 1 });
    expect(getRowLines({ log, document: built, row: 3 })).toEqual({ from: 1, to: 1 });
});

test('a place on the map is the line there, the next one in a gap of the numbers, the last past the end; none in a log with no lines', () => {
    const textAt = (position: number) => LOG.lines[findLineAt(LOG, position) ?? -1]?.text;

    expect(textAt(0)).toBe('a');
    expect(textAt(0.5)).toBe('a');
    expect(textAt(1)).toBe('b');
    // Line 3 is the `##[endgroup]`.
    expect(textAt(2.5)).toBe('c');
    expect(textAt(10.5)).toBe('j');
    expect(textAt(99)).toBe('j');
    expect(findLineAt(parseJobLog('', STEPS), 0)).toBeNull();
});

test('lines before any step have no head and do not fold; a log with no steps is all such lines', () => {
    const text = ['2026-11-02T09:59:00Z early', line(1, 'a')].join('\n');
    const built = buildLogDocument({
        log: parseJobLog(text, STEPS),
        steps: STEPS,
        folded: new Set([1]),
        endNote: false,
    });
    expect(describe(built).slice(0, 2)).toEqual(['early', 'step 1 folded']);
    expect(getRowSection(built, 0)?.headRow).toBeNull();

    const noSteps = buildLogDocument({
        log: parseJobLog('2026-11-02T09:59:00Z only', []),
        steps: [],
        folded: new Set(),
        endNote: false,
    });
    expect(describe(noSteps)).toEqual(['only']);
});

test('a failed job with no marker ends in the note saying why', () => {
    const log = parseJobLog(line(1, 'a'), STEPS);
    const built = buildLogDocument({ log, steps: STEPS, folded: new Set(), endNote: true });
    expect(built.rows.at(-1)).toEqual({ kind: 'end' });
});

test('a row belongs to the section whose head is last above it', () => {
    const built = document(new Set());
    const row = built.lineRows[6] ?? -1;
    expect(getRowSection(built, row)?.step?.name).toBe('Build');
    expect(getRowSection(built, built.sections[3]?.headRow ?? -1)?.step?.name).toBe('Build');
});

test('a log opens at the failed step’s first error, passed steps folded and failed ones open', () => {
    const opening = getLogOpening({ log: LOG, steps: STEPS, jobFailed: true, address: null });

    expect(LOG.lines[opening.cursor ?? -1]?.text).toBe('g');
    expect([...opening.folded]).toEqual([1, 5]);
});

test('with no error in the failed step it opens at the log’s first error, opening that step', () => {
    const steps = [step(1, 'Set up job', 'success'), step(2, 'Lint', 'failure')];
    const log = parseJobLog([line(1, '##[error]early'), line(2, 'lint')].join('\n'), steps);
    const opening = getLogOpening({ log, steps, jobFailed: true, address: null });

    expect(log.lines[opening.cursor ?? -1]?.text).toBe('early');
    expect([...opening.folded]).toEqual([]);
});

test('W4h: a failed job with no marker opens on its last line; a passed one at its top with its steps folded', () => {
    const steps = [step(1, 'Set up job', 'success'), step(2, 'Lint', 'success')];
    const log = parseJobLog([line(1, 'a'), line(2, 'b')].join('\n'), steps);

    const failed = getLogOpening({ log, steps, jobFailed: true, address: null });
    expect(failed.cursor).toBe(1);
    expect([...failed.folded]).toEqual([1]);

    const passed = getLogOpening({ log, steps, jobFailed: false, address: null });
    expect(passed.cursor).toBe(0);
    expect([...passed.folded]).toEqual([1, 2]);
});

test('a log with no lines has no cursor', () => {
    const empty = parseJobLog('', STEPS);
    expect(getLogOpening({ log: empty, steps: STEPS, jobFailed: true, address: null }).cursor).toBeNull();
});

test('an address lands on its line by GitHub’s counting, which includes lines not shown, opening its step', () => {
    const open = (stepNumber: number, stepLine: number) =>
        getLogOpening({ log: LOG, steps: STEPS, jobFailed: true, address: { stepNumber, stepLine } });

    expect(LOG.lines[open(1, 4).cursor ?? -1]?.text).toBe('c');
    // The third of the step is the `##[endgroup]`, not shown: the line above it.
    expect(LOG.lines[open(1, 3).cursor ?? -1]?.text).toBe('b');
    expect([...open(1, 4).folded]).toEqual([5]);
    // No such step: as if none was named.
    expect(LOG.lines[open(9, 1).cursor ?? -1]?.text).toBe('g');
});

test('J/K go line by line across steps, stop at the ends, and from a folded step go to its neighbours', () => {
    const open = document(new Set());
    const textOf = (index: number | null) => (index === null ? null : (LOG.lines[index]?.text ?? null));

    expect(textOf(getAdjacentLine({ document: open, index: 3, by: 1 }))).toBe('e');
    expect(textOf(getAdjacentLine({ document: open, index: 4, by: 1 }))).toBe('f');
    expect(textOf(getAdjacentLine({ document: open, index: 5, by: -1 }))).toBe('e');
    expect(getAdjacentLine({ document: open, index: 0, by: -1 })).toBeNull();
    expect(getAdjacentLine({ document: open, index: LOG.lines.length - 1, by: 1 })).toBeNull();

    const folded = document(new Set([2]));
    expect(textOf(getAdjacentLine({ document: folded, index: 3, by: 1 }))).toBe('f');
    expect(textOf(getAdjacentLine({ document: folded, index: 4, by: -1 }))).toBe('c');
});

test('⇧J/⇧K go to the first line of the next or previous step with lines, skipping a skipped one', () => {
    const built = document(new Set());
    const textOf = (index: number | null) => (index === null ? null : (LOG.lines[index]?.text ?? null));

    expect(textOf(getAdjacentStepLine({ document: built, index: 3, by: 1 }))).toBe('f');
    expect(textOf(getAdjacentStepLine({ document: built, index: 5, by: -1 }))).toBe('d');
    expect(getAdjacentStepLine({ document: built, index: 9, by: 1 })).toBeNull();
    expect(getAdjacentStepLine({ document: built, index: 0, by: -1 })).toBeNull();
});

test('E/⇧E go to the next or previous error, none past the ends; the toolbar counts where the cursor is', () => {
    const first = 6;
    const second = 8;

    expect(getAdjacentError({ log: LOG, index: 0, by: 1 })).toBe(first);
    expect(getAdjacentError({ log: LOG, index: first, by: 1 })).toBe(second);
    expect(getAdjacentError({ log: LOG, index: second, by: 1 })).toBeNull();
    expect(getAdjacentError({ log: LOG, index: second, by: -1 })).toBe(first);
    expect(getAdjacentError({ log: LOG, index: first, by: -1 })).toBeNull();

    expect(getErrorPosition(LOG, 0)).toBe(1);
    expect(getErrorPosition(LOG, first)).toBe(1);
    expect(getErrorPosition(LOG, 7)).toBe(1);
    expect(getErrorPosition(LOG, second)).toBe(2);
});

test('W4c: only the matches: lines by step, gaps between them, the steps with none left out', () => {
    const matches = findLogMatches(LOG, 'g');

    const built = buildLogDocument({
        log: LOG,
        steps: STEPS,
        folded: new Set(),
        endNote: true,
        only: { matches, openedGaps: new Set() },
    });

    // Line "g" in step 4; "f" before it, "h" and "i" after it.
    expect(describe(built)).toEqual(['step 4', 'gap 5-5', 'g', 'gap 7-8', 'end']);
});

test('W4c: a gap holds the row of each of its lines, opens in place, and tells the map what it stands for', () => {
    const matches = findLogMatches(LOG, 'g');
    const closed = buildLogDocument({
        log: LOG,
        steps: STEPS,
        folded: new Set(),
        endNote: false,
        only: { matches, openedGaps: new Set() },
    });
    const opened = buildLogDocument({
        log: LOG,
        steps: STEPS,
        folded: new Set(),
        endNote: false,
        only: { matches, openedGaps: new Set([7]) },
    });

    expect(closed.lineRows[7]).toBe(3);
    expect(closed.lineRows[8]).toBe(3);
    expect(getRowLines({ log: LOG, document: closed, row: 3 })).toEqual({
        from: (LOG.lines[7]?.number ?? 0) - 1,
        to: LOG.lines[8]?.number ?? 0,
    });
    expect(describe(opened)).toEqual(['step 4', 'gap 5-5', 'g', 'h', 'i']);
});

test('W4c: a step folded among the matches stays a head; every step stays a section, for the map', () => {
    const matches = findLogMatches(LOG, 'g');
    const built = buildLogDocument({
        log: LOG,
        steps: STEPS,
        folded: new Set([4]),
        endNote: false,
        only: { matches, openedGaps: new Set() },
    });

    expect(describe(built)).toEqual(['step 4 folded']);
    expect(built.sections.map(section => section.step?.number)).toEqual(STEPS.map(entry => entry.number));
    // A line of a step left out points at a row that exists.
    expect(built.lineRows[0]).toBe(0);
    expect(built.lineRows.at(-1)).toBe(0);
});

test('W4c: moving by step passes over the steps left out', () => {
    const lines = [line(1, 'hit'), line(2, 'none'), line(4, 'hit')].join('\n');
    const log = parseJobLog(lines, STEPS);
    const built = buildLogDocument({
        log,
        steps: STEPS,
        folded: new Set(),
        endNote: false,
        only: { matches: findLogMatches(log, 'hit'), openedGaps: new Set() },
    });

    expect(getAdjacentStepLine({ document: built, index: 0, by: 1 })).toBe(2);
});

test('W4c: a line in a step left out gives way to the nearest that shows: the way the cursor is going, else the closest', () => {
    const steps = [...STEPS, step(6, 'After', 'success')];
    const log = parseJobLog(
        [
            line(1, 'top'),
            line(2, 'hit'),
            line(2, 'after the first hit'),
            line(4, 'left out'),
            line(4, 'left out too'),
            line(4, 'left out still'),
            line(5, 'hit'),
            line(5, 'after the last hit'),
            line(6, 'bottom'),
        ].join('\n'),
        steps,
    );
    const built = buildLogDocument({
        log,
        steps,
        folded: new Set(),
        endNote: false,
        only: { matches: findLogMatches(log, 'hit'), openedGaps: new Set() },
    });
    const nearest = (index: number, by?: 1 | -1) => getNearestShownLine({ document: built, index, by });

    expect(nearest(3, 1)).toBe(6);
    expect(nearest(3, -1)).toBe(2);
    // Nothing further that way: back to what there is.
    expect(nearest(0, -1)).toBe(1);
    expect(nearest(8, 1)).toBe(7);
    // No way given: whichever is fewer lines off.
    expect(nearest(3)).toBe(2);
    expect(nearest(5)).toBe(6);
    expect(nearest(0)).toBe(1);
    expect(nearest(8)).toBe(7);
    // A line that shows, or stands in a gap, stays.
    expect(nearest(1, 1)).toBe(1);
    expect(nearest(2, -1)).toBe(2);
});

test('nothing is left out of the full log: every line stays itself', () => {
    expect(getNearestShownLine({ document: document(new Set([1])), index: 0, by: -1 })).toBe(0);
    expect(getNearestShownLine({ document: document(new Set()), index: 10 })).toBe(10);
});

test('W4c: the lines before any step show, whatever they hold', () => {
    const log = parseJobLog(['2026-11-02T09:59:00Z before', line(1, 'none'), line(2, 'hit')].join('\n'), STEPS);
    const built = buildLogDocument({
        log,
        steps: STEPS,
        folded: new Set(),
        endNote: false,
        only: { matches: findLogMatches(log, 'hit'), openedGaps: new Set() },
    });

    expect(getNearestShownLine({ document: built, index: 0 })).toBe(0);
    expect(getNearestShownLine({ document: built, index: 1, by: -1 })).toBe(0);
});

test('W4c: 100,000 matching lines build one row each, well within the timeout a quadratic path would run past', () => {
    const count = 100_000;
    const big = parseJobLog(Array.from({ length: count }, () => line(4, 'hit')).join('\n'), STEPS);
    const matches = findLogMatches(big, 'hit');

    const built = buildLogDocument({
        log: big,
        steps: STEPS,
        folded: new Set(),
        endNote: false,
        only: { matches, openedGaps: new Set() },
    });

    expect(built.rows).toHaveLength(count + 1);
});

function document(folded: ReadonlySet<number>) {
    return buildLogDocument({ log: LOG, steps: STEPS, folded, endNote: false });
}

function describe(built: LogDocument) {
    return built.rows.map(row => {
        switch (row.kind) {
            case 'step':
                return `step ${row.section.step?.number}${row.section.folded ? ' folded' : ''}`;
            case 'line':
                return row.line.text;
            case 'gap':
                return `gap ${row.first}-${row.last}`;
            default:
                return 'end';
        }
    });
}

/** A line of the log in step `number`'s time. */
function line(number: number, text: string) {
    return `2026-11-02T10:0${number}:10.0000000Z ${text}`;
}

function step(number: number, name: string, conclusion: string): GitHubWorkflowStep {
    return {
        name,
        number,
        status: 'completed',
        conclusion,
        startedAt: conclusion === 'skipped' ? null : `2026-11-02T10:0${number}:00Z`,
        completedAt: conclusion === 'skipped' ? null : `2026-11-02T10:0${number}:50Z`,
    };
}
