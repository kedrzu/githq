import type { GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';

/** What a log line is: GitHub's markers, told apart so they can be shown and jumped to. */
export type JobLogLineKind = 'error' | 'warning' | 'group' | 'plain';

/** One shown line of a job's log. `##[endgroup]` lines are counted but not shown, so `number`s may have gaps. */
export interface JobLogLine {
    /** 1-based, over the whole log. */
    readonly number: number;
    /** Epoch ms; `null` on a line without a timestamp, which stays in the step of the line before it. */
    readonly time: number | null;
    /** Without the BOM, timestamp, ANSI sequences and marker. */
    readonly text: string;
    readonly kind: JobLogLineKind;
    /** The step it belongs to; `null` when no step fits. */
    readonly stepNumber: number | null;
    /** 1-based within the step, as GitHub's `#step:<n>:<line>` and annotations count it; `null` without a step. */
    readonly stepLine: number | null;
}

/** Where a step is in the log. */
export interface JobLogStep {
    readonly number: number;
    /** The `number` of its first shown line; `null` for a step with none, as a skipped one. */
    readonly firstLine: number | null;
    /** The `number` of its last shown line; `null` for a step with none. */
    readonly lastLine: number | null;
}

/** A job's log, ready to show; plain data. */
export interface ParsedJobLog {
    readonly lines: readonly JobLogLine[];
    /** The `number`s of the `##[error]` lines, in order. */
    readonly errors: readonly number[];
    /** In the order given. */
    readonly steps: readonly JobLogStep[];
    /** How long the log's text is, which the viewer tells as its size. */
    readonly characters: number;
    /** `false`: GitHub marked no error, so nothing tells where in the log the failure is (actions D3). */
    readonly hasErrorMarker: boolean;
}

/** A step lines can land in: it ran, at a known time. */
interface TimedStep {
    readonly number: number;
    readonly name: string;
    /** Whole seconds since the epoch. */
    readonly startSecond: number;
    /** Whole seconds since the epoch; `null` while it runs. */
    readonly endSecond: number | null;
    /** The `name` of the step is GitHub's own for a post step: `Post <the name of an earlier step>`. */
    readonly isPost: boolean;
    /** The log has a `##[group]` line of the step's very name: that line is where it begins, no other. */
    readonly hasOwnRunLine: boolean;
}

const BOM = '\uFEFF';
const ESC = '\u001B';
const BEL = '\u0007';
/** The one-byte forms of `ESC [` and `ESC ]`. */
const C1_CSI = '\u009B';
const C1_OSC = '\u009D';
const MARKER_PREFIX = '##[';
const RUN_GROUP_TEXT = 'Run ';
const RUN_GROUP_LINE = '##[group]Run ';
const SET_UP_JOB_STEP = 'Set up job';
/** What the runner prints first in a post step. */
const POST_STEP_START = 'Post job cleanup.';
/** What the runner prints before the `##[group]Run` line of a step of a local composite action. */
const PREPARE_ACTIONS_LINE = 'Prepare all required actions';
/** What the runner may print first in `Complete job`; the first two only for a job with an environment or outputs. */
const COMPLETE_JOB_STARTS = new Set([
    'Evaluate and set environment url',
    'Evaluate and set job outputs',
    'Cleaning up orphan processes',
]);
/** `2026-11-02T19:14:19.6484923Z `: anchored, and it fails within its first characters on any other line. */
const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z(?: |$)/;

/**
 * Reads a job's log (`GET …/actions/jobs/{id}/logs`) into lines told apart by kind and step.
 *
 * GitHub does not mark steps in the log, and the jobs endpoint gives their times in whole seconds, which steps share.
 * So a line belongs to the last step that has started and whose predecessors have ended by the second before it; in
 * the second a step ends and the next starts, the step goes on until a line only a next one would print: its
 * `##[group]Run` line, `Prepare all required actions`, `Post job cleanup.`, or the first thing the runner's own steps
 * print. A step whose very name is a `##[group]` line of the
 * log, as GitHub names a step that has none (`Run actions/checkout@v5`), begins only at that line: the other
 * `##[group]Run` lines of its second are a composite action's inner steps.
 *
 * Linear in the log's size, with no pattern able to backtrack on a long line.
 * @util
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseJobLog(text: string, steps: readonly GitHubWorkflowStep[]): ParsedJobLog {
    const timedSteps = getTimedSteps(steps, readRunLines(text));
    const lines: JobLogLine[] = [];
    const errors: number[] = [];
    const firstLines = new Map<number, number>();
    const lastLines = new Map<number, number>();

    // The last step begun, as an index of `timedSteps`.
    let stepIndex = -1;
    let stepLine = 0;
    let second: number | null = null;
    let number = 0;

    let start = 0;
    while (start < text.length) {
        const newline = text.indexOf('\n', start);
        const end = newline === -1 ? text.length : newline;
        const lineStart = text[start] === BOM ? start + BOM.length : start;
        if (lineStart === text.length) {
            break;
        }

        const raw = text.slice(lineStart, end > lineStart && text[end - 1] === '\r' ? end - 1 : end);
        start = end + 1;
        number++;

        const timestamp = TIMESTAMP_PATTERN.exec(raw);
        const time = timestamp ? readTime(timestamp) : null;
        const content = stripAnsi(time === null ? raw : raw.slice(timestamp?.[0].length));
        const { kind, shown, body } = readMarker(content);
        if (time !== null) {
            second = Math.floor(time / 1000);
        }

        if (second !== null) {
            const nextIndex = getStepIndex(timedSteps, stepIndex, second, body, kind);
            if (nextIndex !== stepIndex) {
                stepIndex = nextIndex;
                stepLine = 0;
            }
        }

        const step = timedSteps[stepIndex];
        if (step) {
            stepLine++;
        }

        if (!shown) {
            continue;
        }

        lines.push({
            number,
            time,
            text: body,
            kind,
            stepNumber: step ? step.number : null,
            stepLine: step ? stepLine : null,
        });
        if (kind === 'error') {
            errors.push(number);
        }

        if (step) {
            if (!firstLines.has(step.number)) {
                firstLines.set(step.number, number);
            }

            lastLines.set(step.number, number);
        }
    }

    return {
        lines,
        errors,
        steps: steps.map(step => ({
            number: step.number,
            firstLine: firstLines.get(step.number) ?? null,
            lastLine: lastLines.get(step.number) ?? null,
        })),
        characters: text.length,
        hasErrorMarker: errors.length > 0,
    };
}

/** The texts of the log's `##[group]Run` lines. */
function readRunLines(text: string) {
    const runLines = new Set<string>();
    let index = text.indexOf(RUN_GROUP_LINE);
    while (index !== -1) {
        const start = index + '##[group]'.length;
        const newline = text.indexOf('\n', start);
        const end = newline === -1 ? text.length : newline;
        runLines.add(text.slice(start, end > start && text[end - 1] === '\r' ? end - 1 : end));
        index = text.indexOf(RUN_GROUP_LINE, end);
    }

    return runLines;
}

/** The steps that can have lines, in the order they ran; a skipped one has none, and one without a start has not run. */
function getTimedSteps(steps: readonly GitHubWorkflowStep[], runLines: ReadonlySet<string>) {
    const timed: TimedStep[] = [];
    const names = new Set<string>();
    for (const step of steps) {
        const startSecond = readSecond(step.startedAt);
        if (step.conclusion !== 'skipped' && startSecond !== null) {
            timed.push({
                number: step.number,
                name: step.name,
                startSecond,
                endSecond: readSecond(step.completedAt),
                isPost: step.name.startsWith('Post ') && names.has(step.name.slice('Post '.length)),
                hasOwnRunLine: runLines.has(step.name),
            });
        }

        names.add(step.name);
    }

    return timed;
}

function readSecond(iso: string | null) {
    if (iso === null) {
        return null;
    }

    const time = Date.parse(iso);
    return Number.isNaN(time) ? null : Math.floor(time / 1000);
}

/** The step a line in `second` belongs to, given the last one begun. */
function getStepIndex(
    steps: readonly TimedStep[],
    current: number,
    second: number,
    body: string,
    kind: JobLogLineKind,
) {
    let index = current;
    // A step whose start second is over has begun; so has one starting now when the one before it is over. This line
    // is then its first: whatever it says, the next step cannot begin before the one just begun has a line.
    while (index + 1 < steps.length && hasBegun(steps, index, second)) {
        index++;
    }

    // `Set up job` prints `Prepare all required actions` too, for the job's actions.
    if (index !== current || (body === PREPARE_ACTIONS_LINE && steps[index]?.name === SET_UP_JOB_STEP)) {
        return index;
    }

    // The steps starting in this second: the first whose beginning this line is, begins, and any before it had no lines.
    for (let next = index + 1; next < steps.length && (steps[next]?.startSecond ?? Infinity) <= second; next++) {
        const step = steps[next];
        if (step && isStepBeginning(step, body, kind)) {
            return next;
        }
    }

    return index;
}

/**
 * Whether the step after `index` has begun by time alone: it has started and the one before it is over. A step ends in
 * the second the next starts, so lines of that second need more than time to tell; and one that has not ended is going
 * on next to the next one (a background step).
 */
function hasBegun(steps: readonly TimedStep[], index: number, second: number) {
    const nextStart = steps[index + 1]?.startSecond ?? Infinity;
    if (nextStart > second) {
        return false;
    }

    const step = steps[index];
    if (!step) {
        return true;
    }

    return step.endSecond === null ? nextStart < second : step.endSecond < second;
}

/** Whether this line can only be how `step` begins. */
function isStepBeginning(step: TimedStep, body: string, kind: JobLogLineKind) {
    switch (step.name) {
        case 'Complete job':
            return COMPLETE_JOB_STARTS.has(body);
        case 'Initialize containers':
            return body === 'Checking docker version';
        case 'Stop containers':
            return body.startsWith('Stop and remove container');
        default:
            break;
    }

    if (step.isPost) {
        return body === POST_STEP_START;
    }

    if (body === PREPARE_ACTIONS_LINE) {
        return true;
    }

    if (kind !== 'group' || !body.startsWith(RUN_GROUP_TEXT)) {
        return false;
    }

    return step.hasOwnRunLine ? body === step.name : true;
}

function readTime(timestamp: RegExpExecArray) {
    // To the millisecond: not every engine reads the 7 decimals GitHub writes.
    const time = Date.parse(`${timestamp[1]}.${(timestamp[2] ?? '').padEnd(3, '0').slice(0, 3)}Z`);
    return Number.isNaN(time) ? null : time;
}

/** What a line's marker says, and the line without it. */
function readMarker(content: string): { kind: JobLogLineKind; shown: boolean; body: string } {
    if (!content.startsWith(MARKER_PREFIX)) {
        return { kind: 'plain', shown: true, body: content };
    }

    const close = content.indexOf(']');
    if (close === -1) {
        return { kind: 'plain', shown: true, body: content };
    }

    const body = content.slice(close + 1);
    switch (content.slice(MARKER_PREFIX.length, close)) {
        case 'error':
            return { kind: 'error', shown: true, body };
        case 'warning':
            return { kind: 'warning', shown: true, body };
        case 'group':
            return { kind: 'group', shown: true, body };
        case 'endgroup':
            return { kind: 'plain', shown: false, body };
        case 'notice':
        case 'debug':
        case 'command':
        case 'section':
            return { kind: 'plain', shown: true, body };
        default:
            return { kind: 'plain', shown: true, body: content };
    }
}

/** The text without ANSI escape sequences: walked once, so a long line or an unended sequence costs no more. */
function stripAnsi(text: string) {
    if (!text.includes(ESC) && !text.includes(C1_CSI) && !text.includes(C1_OSC)) {
        return text;
    }

    let result = '';
    let kept = 0;
    let index = 0;
    while (index < text.length) {
        const char = text.charAt(index);
        if (char !== ESC && char !== C1_CSI && char !== C1_OSC) {
            index++;
            continue;
        }

        result += text.slice(kept, index);
        index = skipSequence(text, index);
        kept = index;
    }

    return result + text.slice(kept);
}

/** The index past the escape sequence at `start`; a sequence the line ends in runs to its end. */
function skipSequence(text: string, start: number) {
    switch (text.charAt(start)) {
        case C1_CSI:
            return skipUntilFinal(text, start + 1, '?');
        case C1_OSC:
            return skipOsc(text, start + 1);
        default:
            break;
    }

    switch (text.charAt(start + 1)) {
        case '[':
            return skipUntilFinal(text, start + 2, '?');
        case ']':
            return skipOsc(text, start + 2);
        default:
            return skipUntilFinal(text, start + 1, '/');
    }
}

/**
 * Past the bytes of a sequence, from space up to `lastInner` — a CSI's parameters and intermediates reach `?`, another
 * escape's intermediates only `/` — and the one that ends it.
 */
function skipUntilFinal(text: string, start: number, lastInner: string) {
    let index = start;
    while (index < text.length) {
        const char = text.charAt(index);
        index++;
        if (char < ' ' || char > lastInner) {
            break;
        }
    }

    return index;
}

/** Past an OSC's text and what ends it: BEL or `ESC \`. */
function skipOsc(text: string, start: number) {
    for (let index = start; index < text.length; index++) {
        const char = text.charAt(index);
        if (char === BEL) {
            return index + 1;
        }

        if (char === ESC && text.charAt(index + 1) === '\\') {
            return index + 2;
        }
    }

    return text.length;
}
