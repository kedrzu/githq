/// <reference types="bun" />
import { readFileSync } from 'node:fs';

import type { GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import { describe, expect, test } from 'bun:test';

import { parseJobLog } from './parseJobLog.js';
import type { ParsedJobLog } from './parseJobLog.js';

// Both fixtures are trimmed from the jobs of kedrzu/githq's run 41507834451, with the steps the jobs endpoint gave them.
const DEPLOY_STEPS = realSteps(
    ['Set up job', 1, 'success', '19:14:19', '19:14:20'],
    ['Run actions/checkout@v5', 2, 'success', '19:14:20', '19:14:23'],
    ['Run oven-sh/setup-bun@v2', 3, 'success', '19:14:23', '19:14:25'],
    ['Build', 4, 'success', '19:14:25', '19:15:02'],
    ['Install Chromium dependencies', 5, 'success', '19:15:02', '19:15:16'],
    ['Codegen is up to date', 6, 'success', '19:15:16', '19:15:20'],
    ['TypeScript', 7, 'success', '19:15:20', '19:15:42'],
    ['Lint', 8, 'success', '19:15:42', '19:15:50'],
    ['Format', 9, 'success', '19:15:50', '19:15:57'],
    ['Tests', 10, 'success', '19:15:57', '19:17:09'],
    ['Component tests', 11, 'failure', '19:17:09', '19:18:33'],
    ['E2E', 12, 'skipped', '19:18:33', '19:18:33'],
    ['Upload e2e results', 13, 'success', '19:18:33', '19:18:33'],
    ['Build the app', 14, 'skipped', '19:18:33', '19:18:33'],
    ['Deploy', 15, 'skipped', '19:18:33', '19:18:33'],
    ['Post Run oven-sh/setup-bun@v2', 29, 'skipped', '19:18:33', '19:18:33'],
    ['Post Run actions/checkout@v5', 30, 'success', '19:18:33', '19:18:33'],
    ['Complete job', 31, 'success', '19:18:33', '19:18:33'],
);

const DESKTOP_STEPS = realSteps(
    ['Set up job', 1, 'success', '19:12:54', '19:12:56'],
    ['Run actions/checkout@v5', 2, 'success', '19:12:56', '19:12:57'],
    ['Install the Linux build dependencies', 3, 'success', '19:12:57', '19:13:22'],
    ['Run dtolnay/rust-toolchain@stable', 4, 'success', '19:13:22', '19:13:22'],
    ['Run swatinem/rust-cache@v2', 5, 'success', '19:13:22', '19:13:44'],
    ["The app's desktop build folder", 6, 'success', '19:13:44', '19:13:44'],
    ['Format', 7, 'success', '19:13:44', '19:13:45'],
    ['Clippy', 8, 'success', '19:13:45', '19:13:48'],
    ['Tests', 9, 'success', '19:13:48', '19:13:54'],
    ['Post Run swatinem/rust-cache@v2', 17, 'success', '19:13:54', '19:13:54'],
    ['Post Run actions/checkout@v5', 18, 'success', '19:13:54', '19:13:54'],
    ['Complete job', 19, 'success', '19:13:54', '19:13:54'],
);

describe('a real log of a failed job', () => {
    const log = parseJobLog(readFixture('deploy'), DEPLOY_STEPS);

    test('tells each step where it begins, those without a `##[group]Run` line too', () => {
        expect(getStepStarts(log)).toEqual({
            1: "Current runner version: '2.338.2'",
            2: 'Run actions/checkout@v5',
            3: 'Run oven-sh/setup-bun@v2',
            4: 'Run bash setup.build.sh',
            5: 'Run bunx playwright install-deps chromium',
            6: 'Run bun run codegen',
            7: "Run bun nx run-many -t typecheck --exclude='@nzyme/*' --skip-nx-cache",
            8: 'Run bun run lint:check',
            9: 'Run bun run format:check',
            10: 'Run bun run tests',
            11: "Run bun nx run-many -t test:stories --exclude='@nzyme/*' --skip-nx-cache",
            12: null,
            13: 'Run actions/upload-artifact@v4',
            14: null,
            15: null,
            29: null,
            30: 'Post job cleanup.',
            31: 'Evaluate and set environment url',
        });
    });

    test('keeps the error in the failed step, though the next steps start in its second', () => {
        expect(log.hasErrorMarker).toBe(true);
        expect(log.errors).toHaveLength(1);
        const error = log.lines.find(line => line.number === log.errors[0]);
        expect(error).toMatchObject({ text: 'Process completed with exit code 1.', kind: 'error', stepNumber: 11 });
    });

    test('counts within a step as GitHub’s annotation does: its warning is `Complete job`’s line 4', () => {
        const warning = log.lines.find(line => line.kind === 'warning');
        expect(warning).toMatchObject({ stepNumber: 31, stepLine: 4 });
    });

    test('shows no BOM, timestamp, ANSI sequence or marker', () => {
        for (const { text } of log.lines) {
            expect(text.includes('\uFEFF') || text.includes('\u001B')).toBe(false);
            expect(text).not.toMatch(/^##\[|^\d{4}-\d{2}-\d{2}T/);
        }

        expect(readFixture('deploy')).toContain('\u001B[');
        expect(readFixture('deploy').startsWith('\uFEFF')).toBe(true);
    });
});

test('a real log with steps sharing a second: a composite action’s inner steps stay in it, post steps split', () => {
    const log = parseJobLog(readFixture('desktop'), DESKTOP_STEPS);

    expect(getStepStarts(log)).toEqual({
        1: "Current runner version: '2.338.2'",
        2: 'Run actions/checkout@v5',
        3: 'Run sudo apt-get update',
        4: 'Run dtolnay/rust-toolchain@stable',
        5: 'Run swatinem/rust-cache@v2',
        6: 'Run mkdir -p ../../app/.output-desktop/public',
        7: 'Run cargo fmt --check',
        8: 'Run cargo clippy --all-targets -- -D warnings',
        9: 'Run cargo test',
        17: 'Post job cleanup.',
        18: 'Post job cleanup.',
        19: 'Cleaning up orphan processes',
    });
    expect(log.lines.find(line => line.text === 'Run if [[ -z $toolchain ]]; then')?.stepNumber).toBe(4);
});

test('with no `##[error]` the result says so', () => {
    const log = parseJobLog(readFixture('desktop'), DESKTOP_STEPS);

    expect(log.hasErrorMarker).toBe(false);
    expect(log.errors).toEqual([]);
});

describe('lines and steps', () => {
    const STEPS = [
        step({ name: 'First', number: 1, start: 10, end: 12 }),
        step({ name: 'Skipped', number: 2, start: 12, end: 12, conclusion: 'skipped' }),
        step({ name: 'Second', number: 5, start: 12, end: 14 }),
    ];

    test('a line in a second its step shares with the next stays in it until the next one’s `##[group]Run`', () => {
        const log = parseJobLog(
            [
                at(10, '##[group]Run first'),
                at(12, 'last of first'),
                at(12, '##[group]Run second'),
                at(13, 'in second'),
            ].join('\n'),
            STEPS,
        );

        expect(log.lines.map(line => line.stepNumber)).toEqual([1, 1, 5, 5]);
        expect(log.steps).toEqual([
            { number: 1, firstLine: 1, lastLine: 2 },
            { number: 2, firstLine: null, lastLine: null },
            { number: 5, firstLine: 3, lastLine: 4 },
        ]);
    });

    test('a step without a `##[group]Run` line begins once the step before it is over', () => {
        const log = parseJobLog(
            [at(10, 'first'), at(12, 'still first'), at(13, 'no group here'), at(14, 'more')].join('\n'),
            STEPS,
        );

        expect(log.lines.map(line => line.stepNumber)).toEqual([1, 1, 5, 5]);
    });

    test('a step named `Run …` that no line says the name of begins at any `##[group]Run` line', () => {
        const steps = [
            step({ name: 'First', number: 1, start: 10, end: 12 }),
            step({ name: 'Run benchmarks', number: 2, start: 12, end: 14 }),
        ];

        const log = parseJobLog([at(12, 'first'), at(12, '##[group]Run args=()')].join('\n'), steps);

        expect(log.lines.map(line => line.stepNumber)).toEqual([1, 2]);
    });

    test('`Set up job`’s own `Prepare all required actions` does not begin the next step; a later step’s does', () => {
        const steps = [
            step({ name: 'Set up job', number: 1, start: 10, end: 10 }),
            step({ name: 'Run a', number: 2, start: 10, end: 10 }),
            step({ name: 'Run ./composite', number: 3, start: 10, end: 11 }),
        ];

        const log = parseJobLog(
            [
                at(10, 'Prepare all required actions'),
                at(10, '##[group]Run a'),
                at(10, 'Prepare all required actions'),
                at(10, 'Download action repository'),
                at(10, '##[group]Run ./composite'),
            ].join('\n'),
            steps,
        );

        expect(log.lines.map(line => line.stepNumber)).toEqual([1, 2, 3, 3, 3]);
    });

    test('a step not yet over goes on when the next has started, as a background step does', () => {
        const steps = [
            step({ name: 'Background', number: 1, start: 10, end: 30 }),
            step({ name: 'Foreground', number: 2, start: 10, end: 12 }),
        ];

        const log = parseJobLog(
            [at(10, '##[group]Run background'), at(11, 'its output'), at(11, '##[group]Run foreground')].join('\n'),
            steps,
        );

        expect(log.lines.map(line => line.stepNumber)).toEqual([1, 1, 2]);
    });

    test('`##[endgroup]` shows no line but counts, in the log and in its step', () => {
        const log = parseJobLog(
            [at(10, '##[group]Run first'), at(10, 'inside'), at(10, '##[endgroup]'), at(10, 'after')].join('\n'),
            STEPS,
        );

        expect(log.lines.map(({ number, stepLine, kind, text }) => ({ number, stepLine, kind, text }))).toEqual([
            { number: 1, stepLine: 1, kind: 'group', text: 'Run first' },
            { number: 2, stepLine: 2, kind: 'plain', text: 'inside' },
            { number: 4, stepLine: 4, kind: 'plain', text: 'after' },
        ]);
    });

    test('a line without a timestamp is kept, with no time, in the step of the line before it', () => {
        const log = parseJobLog(
            [at(10, 'first'), at(12, '##[group]Run second'), 'no time here', at(13, 'next')].join('\n'),
            STEPS,
        );

        expect(log.lines[2]).toMatchObject({ number: 3, time: null, text: 'no time here', stepNumber: 5, stepLine: 2 });
        expect(log.lines[3]?.time).toBe(Date.UTC(2026, 10, 2, 19, 0, 13, 123));
    });

    test('no step fits a line before the first one, nor any line with no steps or none with a time', () => {
        const unstarted = { ...step({ name: 'Queued', number: 1, start: 10, end: 11 }), startedAt: null };

        expect(parseJobLog(at(5, 'early'), STEPS).lines[0]).toMatchObject({ stepNumber: null, stepLine: null });
        expect(parseJobLog(at(10, 'line'), []).lines[0]?.stepNumber).toBeNull();
        expect(parseJobLog(at(10, 'line'), [unstarted]).lines[0]?.stepNumber).toBeNull();
        expect(parseJobLog('no time', STEPS).lines[0]?.stepNumber).toBeNull();
    });

    test('an empty log has no lines, and a last newline starts none', () => {
        expect(parseJobLog('', STEPS).lines).toEqual([]);
        expect(parseJobLog('\uFEFF', STEPS).lines).toEqual([]);
        expect(parseJobLog(`${at(10, 'one')}\n`, STEPS).lines).toHaveLength(1);
    });
});

describe('markers and escape sequences', () => {
    test.each([
        ['##[error]broken', 'error', 'broken'],
        ['##[warning]careful', 'warning', 'careful'],
        ['##[group]Build', 'group', 'Build'],
        ['##[notice]see this', 'plain', 'see this'],
        ['##[debug]details', 'plain', 'details'],
        ['\u001B[31m##[error]coloured marker', 'error', 'coloured marker'],
        ['##[nonsense]not a marker', 'plain', '##[nonsense]not a marker'],
        ['## [error]neither', 'plain', '## [error]neither'],
        ['text ##[error]in the middle', 'plain', 'text ##[error]in the middle'],
    ])('reads %j', (raw, kind, text) => {
        expect(parseJobLog(at(10, raw), []).lines[0]).toMatchObject({ kind, text });
    });

    test.each([
        ['a colour', 'a\u001B[36;1mb\u001B[0mc', 'abc'],
        ['a move, not a colour', 'a\u001B[2Kb\u001B[10;20Hc', 'abc'],
        ['a private mode', 'a\u001B[?25lb', 'ab'],
        ['a one-byte CSI', 'a\u009B31mb', 'ab'],
        ['an OSC ended by BEL', 'a\u001B]0;title\u0007b', 'ab'],
        ['an OSC ended by ST', 'a\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\b', 'alinkb'],
        ['a one-byte OSC', 'a\u009D0;title\u0007b', 'ab'],
        ['another escape', 'a\u001B(Bb', 'ab'],
        ['a sequence the line ends in', 'a\u001B[3', 'a'],
        ['an OSC the line ends in', 'a\u001B]0;title', 'a'],
        ['an ESC the line ends in', 'a\u001B', 'a'],
    ])('strips %s', (_, raw, text) => {
        expect(parseJobLog(at(10, raw), []).lines[0]?.text).toBe(text);
    });

    test('strips a BOM at the start of any line, and the carriage return of a line ending', () => {
        const log = parseJobLog(`\uFEFF${at(10, 'one\r')}\n\uFEFF${at(10, 'two')}`, []);

        expect(log.lines.map(line => line.text)).toEqual(['one', 'two']);
    });

    test('takes the time of a line to the millisecond, of 7 decimals or none', () => {
        const log = parseJobLog(
            '2026-11-02T19:14:19.6484923Z seven\n2026-11-02T19:14:19Z none\n2026-99-99T19:14:19Z not a date',
            [],
        );

        expect(log.lines.map(line => line.time)).toEqual([
            Date.UTC(2026, 10, 2, 19, 14, 19, 648),
            Date.UTC(2026, 10, 2, 19, 14, 19),
            null,
        ]);
    });
});

test('reads a log of 100,000 lines, and a line of a million characters, without backtracking', () => {
    const steps = [step({ name: 'First', number: 1, start: 10, end: 20 })];
    const lines = Array.from({ length: 100_000 }, (_, index) => at(10, `\u001B[36;1mline ${index}\u001B[0m`));
    lines.push(at(11, '\u001B['.repeat(500_000)), at(11, '#'.repeat(1_000_000)), '2'.repeat(1_000_000));

    const log = parseJobLog(lines.join('\n'), steps);

    expect(log.lines).toHaveLength(100_003);
    expect(log.lines[99_999]?.text).toBe('line 99999');
});

/** Where each step begins, by its number; `null` for one with no lines. */
function getStepStarts(log: ParsedJobLog) {
    const starts: Record<number, string | null> = {};
    for (const { number, firstLine } of log.steps) {
        starts[number] = log.lines.find(line => line.number === firstLine)?.text ?? null;
    }

    return starts;
}

function readFixture(name: 'deploy' | 'desktop') {
    return readFileSync(new URL(`./parseJobLog.fixture.${name}.txt`, import.meta.url), 'utf8');
}

/** The steps of a run on 2026-11-02, given as they read: name, number, conclusion, start, end. */
function realSteps(...steps: (readonly [string, number, string, string, string])[]): GitHubWorkflowStep[] {
    return steps.map(([name, number, conclusion, start, end]) => ({
        name,
        number,
        status: 'completed',
        conclusion,
        startedAt: `2026-11-02T${start}Z`,
        completedAt: `2026-11-02T${end}Z`,
    }));
}

/** A step of `start` and `end` seconds past 19:00. */
function step(params: {
    name: string;
    number: number;
    start: number;
    end: number;
    conclusion?: string;
}): GitHubWorkflowStep {
    return {
        name: params.name,
        number: params.number,
        status: 'completed',
        conclusion: params.conclusion ?? 'success',
        startedAt: new Date(Date.UTC(2026, 10, 2, 19, 0, params.start)).toISOString(),
        completedAt: new Date(Date.UTC(2026, 10, 2, 19, 0, params.end)).toISOString(),
    };
}

/** A log line `second` seconds past 19:00. */
function at(second: number, text: string) {
    return `${new Date(Date.UTC(2026, 10, 2, 19, 0, second)).toISOString().replace('.000Z', '.1234567Z')} ${text}`;
}
