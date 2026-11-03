import type { GitHubWorkflowJob, GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { h } from 'vue';

import { parseJobLog } from './utils/parseJobLog.js';
import WorkflowJobLog from './WorkflowJobLog.vue';

const START = Date.parse('2026-11-02T14:00:00Z');

const STEPS = [
    step(1, 'Set up job', 'success'),
    step(2, 'Checkout', 'success'),
    step(3, 'Run bun run build', 'failure'),
    step(4, 'Upload artifact', 'skipped'),
    step(5, 'Post Checkout', 'success'),
    step(6, 'Complete job', 'success'),
];

const BUILD = [
    '##[group]Run bun run build',
    'bun run build',
    '##[endgroup]',
    '[nuxi] Building for production…',
    '    at ModuleLoader.loadEntryModule (file:///home/runner/work/webapp/webapp/node_modules/rollup/dist/es/shared/node-entry.js:21547:24)',
    ...Array.from({ length: 80 }, (_, index) => `  ✓ ${index} modules transformed`),
    '##[warning]A chunk is larger than 500 KB',
    '[nuxi] ERROR  Build failed after 2m 04s',
    'error: script "build" exited with code 1',
    '##[error]Process completed with exit code 1.',
];

const meta = {
    component: WorkflowJobLog,
    args: {
        ...viewOf(
            STEPS,
            sections({
                1: ['Runner image 2.1', 'Prepare'],
                2: ['Fetching…', 'Done'],
                3: BUILD,
                5: ['Clean'],
                6: ['Bye'],
            }),
        ),
    },
    decorators: [() => ({ template: '<div style="display: flex; height: 500px; width: 900px"><story /></div>' })],
} satisfies Meta<typeof WorkflowJobLog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W4a: opened at the error, what is above it in view, passed steps folded. */
export const Failed: Story = {};

/** Errors in the failed step and in a passed one. */
export const SeveralErrors: Story = {
    args: viewOf(
        STEPS,
        sections({
            2: ['##[error]Checkout hiccup', 'Done'],
            3: [...BUILD, 'more', '##[error]And again'],
            5: ['Clean'],
        }),
    ),
};

/** W4h: no error marker: at the end, saying why it stops there. */
export const NoMarker: Story = {
    args: viewOf(
        STEPS,
        sections({ 1: ['Prepare'], 3: Array.from({ length: 60 }, (_, index) => `  ✓ ${index} books a place`) }),
    ),
};

/** A job that passed: every step folded, the cursor on the first one's head. */
export const Passed: Story = {
    args: viewOf(
        [step(1, 'Set up job', 'success'), step(2, 'Run lint', 'success')],
        sections({ 1: ['Prepare'], 2: ['All good'] }),
        'success',
    ),
};

/** Text that looks like markup, and a line of a million characters. */
export const Hostile: Story = {
    args: viewOf(
        STEPS,
        sections({
            3: [
                '<script>alert(1)</script>',
                '<img src=x onerror="window.logXss = true">',
                '{{ 1 + 1 }}',
                'x'.repeat(1_000_000),
                '##[error]Process completed with exit code 1.',
            ],
        }),
    ),
};

/** Long lines to wrap (W4d). */
export const LongLines: Story = {
    args: viewOf(
        STEPS,
        sections({
            3: Array.from(
                { length: 200 },
                (_, index) =>
                    `${index} at Object.logger [as onLog] (file:///home/runner/work/webapp/webapp/node_modules/rollup/dist/es/shared/node-entry.js:22641:9) and much more besides ${'long '.repeat(index % 40)}`,
            ).concat('##[error]Process completed with exit code 1.'),
        }),
    ),
};

/** A search's seam: ranges of a line highlighted. */
export const Highlighted: Story = {
    args: {
        ...viewOf(STEPS, sections({ 3: ['error: script "build" exited', '##[error]exit code 1'] })),
        highlights: new Map([[1, [{ start: 0, end: 5 }]]]),
    },
};

/** 100,000 lines, every 10,000th an error. Built as it renders and held out of the arguments, which Storybook copies. */
export const Huge: Story = {
    render: () => ({
        setup: () => {
            const view = viewOf(
                STEPS,
                sections({
                    1: ['Prepare'],
                    3: Array.from({ length: 100_000 }, (_, index) =>
                        index % 10_000 === 5000 ? `##[error]Error at ${index}` : `line ${index} of the log`,
                    ),
                    5: ['Clean'],
                }),
            );
            return () => h(WorkflowJobLog, view);
        },
    }),
};

function viewOf(steps: readonly GitHubWorkflowStep[], lines: readonly string[], conclusion = 'failure') {
    const job: GitHubWorkflowJob = {
        id: 103,
        name: 'build',
        status: 'completed',
        conclusion,
        startedAt: '2026-11-02T14:00:00Z',
        completedAt: '2026-11-02T14:02:00Z',
        steps,
    };
    return {
        job,
        log: parseJobLog(lines.join('\n'), steps),
        nameWithOwner: 'fitloop/webapp',
        runId: 4821,
        size: `${lines.length} lines · 176 KB`,
        address: null,
    };
}

/** The log's text with each step's lines at a time within that step. */
function sections(byStep: Readonly<Record<number, readonly string[]>>) {
    return Object.entries(byStep).flatMap(([number, lines]) =>
        lines.map((text, index) => `${timeOf(Number(number), index)} ${text}`),
    );
}

function timeOf(number: number, line: number) {
    return new Date(START + number * 100_000 + Math.min(line, 49_000)).toISOString();
}

function step(number: number, name: string, conclusion: string): GitHubWorkflowStep {
    const skipped = conclusion === 'skipped';
    return {
        name,
        number,
        status: 'completed',
        conclusion,
        startedAt: skipped ? null : new Date(START + number * 100_000).toISOString(),
        completedAt: skipped ? null : new Date(START + number * 100_000 + 50_000).toISOString(),
    };
}
