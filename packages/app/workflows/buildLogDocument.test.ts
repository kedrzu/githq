/// <reference types="bun" />
import type { GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import { expect, test } from 'bun:test';

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
import type { LogDocument } from './buildLogDocument.js';
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

test('a line folded away shows at its step’s head; an error too, on the map', () => {
    const open = document(new Set());
    const folded = document(new Set([4]));
    const head = folded.sections[3]?.headRow ?? -1;

    expect(folded.lineRows[7]).toBe(head);
    expect(open.errorRows).toEqual([open.lineRows[6], open.lineRows[8]].map(row => row ?? -1));
    expect(folded.errorRows).toEqual([head]);
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
