import type { GitHubWorkflowJob, GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { h, ref, shallowRef } from 'vue';

import Button from '@/components/Button.vue';

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

/** Lines that wrap much taller than their length says, words filling each screen line only half way; the error last. */
export const TallAtTheEnd: Story = {
    args: viewOf(
        [step(3, 'Run bun run build', 'failure')],
        sections({
            3: [
                ...Array.from({ length: 120 }, (_, index) => `${index} ${`${'word'.repeat(15)} `.repeat(10)}`),
                '##[error]the very end',
            ],
        }),
    ),
};

/** A long folded step, of lines that wrap, right above the failed step: everything fits the view until it opens. */
export const FoldedAbove: Story = {
    args: viewOf(
        [step(1, 'Set up job', 'success'), step(3, 'Run bun run build', 'failure')],
        sections({
            1: Array.from({ length: 300 }, (_, index) => `${index} ${`${'word'.repeat(15)} `.repeat(10)}`),
            3: [...Array.from({ length: 10 }, (_, index) => `building ${index}`), '##[error]exit code 1'],
        }),
    ),
};

/** Characters that change how a line looks, or don't show at all. */
export const InvisibleCharacters: Story = {
    args: viewOf(
        STEPS,
        sections({
            3: ['safe\u202Eevil', 'zero\u200Bwidth', '##[error]Process completed with exit code 1.'],
        }),
    ),
};

/** A long log whose job is asked for again: the same job, as a new object, as a 200 on the jobs' poll brings it. */
export const Polled: Story = {
    render: () => ({
        setup: () => {
            const view = viewOf(
                STEPS,
                sections({
                    1: ['Prepare'],
                    3: Array.from({ length: 5000 }, (_, index) => `line ${index} of the log`),
                }),
            );
            const job = shallowRef(view.job);
            return () => [
                h(
                    Button,
                    {
                        variant: 'secondary',
                        size: 'sm',
                        tid: 'workflow-log-poll',
                        onClick: () => (job.value = { ...job.value, steps: [...job.value.steps] }),
                    },
                    () => 'Poll',
                ),
                h(WorkflowJobLog, { ...view, job: job.value }),
            ];
        },
    }),
};

/** A build whose cause is far above its marker, and steps folded around it, for a search to go through. */
const RESOLVE_LOG = sections({
    1: ['Runner image 2.1', 'Prepare'],
    2: [
        'bun install v1.3',
        ...Array.from({ length: 30 }, (_, index) => `installing package ${index}`),
        'warn: resolved 412 packages, 2 peer dependencies not installed',
        ...Array.from({ length: 12 }, (_, index) => `linking package ${index}`),
        'warn: incorrect peer dependency: could not resolve "vue@^3.4" for @fitloop/ui',
        'Done',
    ],
    3: [
        '##[group]Run bun run build',
        'bun run build',
        '##[endgroup]',
        ...Array.from({ length: 20 }, (_, index) => `  ✓ ${index} modules transformed`),
        '[vite]: Rollup failed to resolve import "@fitloop/ui/tokens" from "/home/runner/work/webapp/app/assets/theme.ts".',
        'This is most likely unintended because it can break your application at runtime.',
        '    at resolveId (node_modules/vite/dist/node/chunks/dep-D_zLpgQd.js:44812:17)',
        '    at ModuleLoader.resolveId (node_modules/rollup/dist/es/shared/node-entry.js:21398:15)',
        ...Array.from({ length: 7 }, (_, index) => `  retrying ${index}`),
        '    at ModuleLoader.handleInvalidResolvedId (node_modules/rollup/dist/es/shared/node-entry.js:21547:24)',
        '##[error]Process completed with exit code 1.',
    ],
    5: ['Clean'],
});

/** W4b: the search bar in the toolbar's place, the counts on the steps, the matches on the map. */
export const Searching: Story = {
    args: { ...viewOf(STEPS, RESOLVE_LOG), query: 'resolve' },
};

/** W4c: only the matching lines, by step, with what was skipped between them. */
export const OnlyMatches: Story = {
    args: { ...viewOf(STEPS, RESOLVE_LOG), query: 'resolve', onlyMatches: true },
};

/**
 * The search bound as the page binds it, with `onUpdate:`: a model written shows only once its parent has rendered, and
 * so does everything worked out from it. Matches in two long steps folded in the full log.
 */
export const SearchBoundByParent: Story = {
    render: () => ({
        setup: () => {
            const filler = (name: string) =>
                Array.from({ length: 300 }, (_, index) =>
                    index === 250 ? `${name} could not resolve it` : `${name} line ${index}`,
                );
            const view = viewOf(
                STEPS,
                sections({
                    1: filler('setup'),
                    2: filler('checkout'),
                    3: ['building', '##[error]Process completed with exit code 1.'],
                }),
            );
            const query = ref<string | null>('resolve');
            const onlyMatches = ref(false);
            return () =>
                h(WorkflowJobLog, {
                    ...view,
                    query: query.value,
                    'onUpdate:query': (value: string | null) => (query.value = value),
                    onlyMatches: onlyMatches.value,
                    'onUpdate:onlyMatches': (value: boolean) => (onlyMatches.value = value),
                });
        },
    }),
};

/** A match past where a long line is cut, and another line of nothing but the same letter. */
export const SearchPastTheCut: Story = {
    args: viewOf(
        STEPS,
        sections({
            3: [
                'short line',
                `${'a'.repeat(20_000)}needle${'b'.repeat(20)}`,
                'q'.repeat(1_000_000),
                '##[error]Process completed with exit code 1.',
            ],
        }),
    ),
};

/** A query that is markup, and a pattern's characters, in the log as plain text. */
export const SearchLiterally: Story = {
    args: viewOf(
        STEPS,
        sections({
            3: [
                'a <b>bold</b> claim',
                'greedy .*( here',
                'a{1000} counted',
                'aaaa',
                '##[error]Process completed with exit code 1.',
            ],
        }),
    ),
};

/** Among only the matches, steps left out above, between and below them, an error in each. */
export const OnlyMatchesAroundLeftOut: Story = {
    args: {
        ...viewOf(
            STEPS,
            sections({
                1: ['Prepare', '##[error]early failure'],
                2: ['fetch hit one', 'Done'],
                3: ['##[error]middle failure', 'more'],
                5: ['clean hit two', 'Cleaned'],
                6: ['##[error]late failure', 'Bye'],
            }),
        ),
        query: 'hit',
        onlyMatches: true,
    },
};

/** Among only the matches, two steps long enough to scroll, with a step left out between them. */
export const OnlyMatchesLeftOutBetween: Story = {
    args: {
        ...viewOf(
            STEPS,
            sections({
                2: Array.from({ length: 60 }, (_, index) => `hit in checkout ${index}`),
                3: ['##[error]middle failure'],
                5: Array.from({ length: 60 }, (_, index) => `hit in post checkout ${index}`),
            }),
        ),
        query: 'hit',
        onlyMatches: true,
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
