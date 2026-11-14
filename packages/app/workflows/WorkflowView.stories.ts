import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { SAMPLE_WORKFLOW_ITEMS } from '@/testing/sampleWorkflowItems.js';
import type { SampleWorkflowItem } from '@/testing/sampleWorkflowItems.js';
import { SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';

import WorkflowView from './WorkflowView.vue';

const meta = {
    component: WorkflowView,
    args: {
        ...asArgs(SAMPLE_WORKFLOW_ITEMS.deploy),
        arrangement: 'page',
        position: { index: 1, count: 8 },
        groupBy: 'none',
        latestFailure: SAMPLE_WORKFLOW_ITEMS.deploy.runs.runs.find(run => run.conclusion === 'failure') ?? null,
        escapeTo: 'panel',
        now: SAMPLE_WORKFLOWS_NOW,
        onClose: fn(),
        onPrevious: fn(),
        onNext: fn(),
        onArrange: fn(),
        onOpenRun: fn(),
        onFilter: fn(),
        onReadMore: fn(),
        onGroupBy: fn(),
        onRunWorkflow: fn(),
    },
    render: renderAt(1400),
} satisfies Meta<typeof WorkflowView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W31: full screen, the runs beside the details, the key bar at the bottom. */
export const FullScreen: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: 'Deploy', level: 1 })).toBeVisible();
        await expect(canvas.getByText('Broken on main')).toBeVisible();
        await expect(canvas.getByRole('region', { name: 'Details' })).toBeVisible();
        await expect(canvas.queryByRole('group', { name: 'Runs and details' })).toBeNull();
    },
};

/** W30: in a panel wide enough for two columns; the list beside it keeps `j`/`k`, so no run is selected. */
export const InPanel: Story = {
    args: { arrangement: 'panel' },
};

/** W32: in a narrow panel, the tabs; the runs filtered to one branch. */
export const NarrowFiltered: Story = {
    args: { ...asArgs(SAMPLE_WORKFLOW_ITEMS.filtered), arrangement: 'panel', latestFailure: null },
    render: renderAt(700),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByRole('button', { name: /^Runs/u }));
        await expect(canvas.getByRole('button', { name: 'Ref: sofiab/tokens' })).toBeVisible();
    },
};

/** W33: narrow, the Details tab, a workflow only pull requests run and with no `workflow_dispatch`. */
export const NarrowDetails: Story = {
    args: { ...asArgs(SAMPLE_WORKFLOW_ITEMS.cla), arrangement: 'panel', latestFailure: null, offerRun: true },
    render: renderAt(700),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Only pull requests ran it: it stands as the Workflows list says, not as "No verdict yet".
        await expect(canvas.getByText('Pull requests only')).toBeVisible();
        await userEvent.click(canvas.getByRole('button', { name: 'Details' }));
        await expect(canvas.getByText('Never counts')).toBeVisible();
        // No dispatch: nothing to run, even where it is offered.
        await expect(canvas.queryByRole('button', { name: 'Run workflow…' })).toBeNull();
    },
};

/** A dispatchable workflow where running it is offered: "Run workflow…" beside its name. */
export const RunOffered: Story = {
    args: { offerRun: true },
    play: async ({ args, canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'Run workflow…' }));
        await expect(args.onRunWorkflow).toHaveBeenCalledTimes(1);
    },
};

/** A workflow GitHub generates: no file to read, said in its triggers. */
export const Generated: Story = {
    args: { ...asArgs(SAMPLE_WORKFLOW_ITEMS.generated), latestFailure: null },
    play: async ({ canvasElement }) => {
        await expect(
            within(canvasElement).getByText('GitHub generates this workflow; it has no file in the repository.'),
        ).toBeVisible();
    },
};

/** A workflow with no run at all. */
export const NoRuns: Story = {
    args: { ...asArgs(SAMPLE_WORKFLOW_ITEMS.noRuns), latestFailure: null },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('No runs yet.')).toBeVisible();
    },
};

/** Grouped by status (W43). */
export const GroupedByStatus: Story = {
    args: { groupBy: 'status' },
};

/** The view `width` wide, as tall as the window. */
function renderAt(width: number): NonNullable<Meta<typeof WorkflowView>['render']> {
    return args => ({
        components: { WorkflowView },
        setup: () => ({ args, width: `${width}px` }),
        template: `<div :style="{ height: '100vh', width }"><WorkflowView v-bind="args" /></div>`,
    });
}

function asArgs(item: SampleWorkflowItem) {
    const { nameWithOwner, state, details, runs, refGroups, tags } = item;
    return { nameWithOwner, state, details, runs, refGroups, tags };
}
