import type { GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import type { LogSection } from './buildLogDocument.js';
import WorkflowLogStepRow from './WorkflowLogStepRow.vue';

const LINES = { first: 12, last: 96 };

const meta = {
    component: WorkflowLogStepRow,
    args: {
        ...rowOf(step('Run bun run build', 'failure'), LINES, false),
        onToggle: fn(),
    },
    decorators: [() => ({ template: '<div style="width: 640px"><story /></div>' })],
} satisfies Meta<typeof WorkflowLogStepRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A failed step, open: a red mark, its lines and how long it took. */
export const Failed: Story = {};

/** A passed step, folded. */
export const PassedFolded: Story = { args: rowOf(step('Checkout', 'success'), LINES, true) };

/** A step neither passed nor failed. */
export const Cancelled: Story = { args: rowOf(step('Upload artifact', 'cancelled'), LINES, true) };

/** The cursor's line is folded under it. */
export const Cursor: Story = {
    args: { ...rowOf(step('Checkout', 'success'), LINES, true), cursor: true },
};

/** It holds a single line. */
export const OneLine: Story = {
    args: rowOf(step('Complete job', 'success'), { first: 97, last: 97 }, true),
};

/** It was skipped: nothing to fold, and it says why. */
export const Skipped: Story = { args: rowOf(step('Upload artifact', 'skipped', null), null, false) };

/** It ran and wrote nothing: nothing to fold. */
export const NoLines: Story = { args: rowOf(step('Post Checkout', 'success'), null, false) };

/** The lines before any step: no name, no mark, no time. */
export const BeforeAnyStep: Story = { args: rowOf(null, { first: 1, last: 3 }, false) };

/** A name wider than the row. */
export const LongName: Story = {
    args: rowOf(step(`Run ${'bun run build --filter=packages/app '.repeat(6)}`, 'success'), LINES, true),
};

/** W4b: a search's matches, folded or not. */
export const WithMatches: Story = {
    args: { ...rowOf(step('Run bun run build', 'success'), LINES, true), matchCount: 10 },
};

function rowOf(
    stepOfRow: GitHubWorkflowStep | null,
    range: { readonly first: number; readonly last: number } | null,
    folded: boolean,
) {
    const section: LogSection = {
        step: stepOfRow,
        lines: range && { first: range.first - 1, last: range.last - 1 },
        folded,
        headRow: stepOfRow ? 0 : null,
        firstRow: 0,
    };
    return { section, range };
}

function step(name: string, conclusion: string, startedAt: string | null = '2026-11-02T14:00:00Z'): GitHubWorkflowStep {
    return {
        name,
        number: 1,
        status: 'completed',
        conclusion,
        startedAt,
        completedAt: startedAt && '2026-11-02T14:02:04Z',
    };
}
