import { assertValue } from '@nzyme/utils/assert.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_WORKFLOW_ITEMS } from '@/testing/sampleWorkflowItems.js';
import { SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';

import WorkflowRunRow from './WorkflowRunRow.vue';

/** Deploy's runs, the newest first: running, three failed, a pull request's passed, …, a cancelled one. */
const RUNS = SAMPLE_WORKFLOW_ITEMS.deploy.runs.runs;

const meta = {
    component: WorkflowRunRow,
    args: {
        run: assertValue(RUNS[1]),
        gitRef: { name: 'main', kind: 'branch' },
        now: SAMPLE_WORKFLOWS_NOW,
        selected: false,
        onOpen: fn(),
    },
    render: renderAt(900),
} satisfies Meta<typeof WorkflowRunRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W53: failed, "Failed after 3m 12s · 14m ago". */
export const Failed: Story = {};

/** W53: the selected row, its ref chip on a violet tint. */
export const Selected: Story = { args: { selected: true } };

/** Still going: "Running for …". */
export const Running: Story = { args: { run: assertValue(RUNS[0]) } };

/** A pull request's run that passed, on its branch. */
export const PassedPullRequest: Story = {
    args: { run: assertValue(RUNS[4]), gitRef: { name: 'sofiab/tokens', kind: 'branch' } },
};

/** Cancelled: no duration. */
export const Cancelled: Story = {
    args: { run: assertValue(RUNS[6]), gitRef: { name: 'chore/deploy-workflow', kind: 'branch' } },
};

/** Waiting to start: "Queued", no time. */
export const Queued: Story = {
    args: { run: { ...assertValue(RUNS[0]), status: 'queued', runStartedAt: undefined } },
};

/** W54: narrow, who started it by their picture alone. */
export const Narrow: Story = { args: { selected: true }, render: renderAt(480) };

/** The row in a list `width` wide, the width its narrow form is told by. */
function renderAt(width: number): NonNullable<Meta<typeof WorkflowRunRow>['render']> {
    return args => ({
        components: { WorkflowRunRow },
        setup: () => ({ args, width: `${width}px` }),
        template: `<div :style="{ width, containerType: 'inline-size' }"><WorkflowRunRow v-bind="args" /></div>`,
    });
}
