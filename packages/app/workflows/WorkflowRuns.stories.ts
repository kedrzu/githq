import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { SAMPLE_WORKFLOW_ITEMS } from '@/testing/sampleWorkflowItems.js';
import { SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';

import { NO_WORKFLOW_RUN_FILTERS } from './WorkflowRunHistory.js';
import WorkflowRuns from './WorkflowRuns.vue';

const DEPLOY = SAMPLE_WORKFLOW_ITEMS.deploy;

const meta = {
    component: WorkflowRuns,
    args: {
        runs: DEPLOY.runs,
        groupBy: 'none',
        refGroups: DEPLOY.refGroups,
        tags: DEPLOY.tags,
        now: SAMPLE_WORKFLOWS_NOW,
        callOnly: false,
        keys: true,
        onFilter: fn(),
        onGroupBy: fn(),
        onReadMore: fn(),
        onOpenRun: fn(),
    },
    render: args => ({
        components: { WorkflowRuns },
        setup: () => ({ args }),
        template: `<div style="display: flex; height: 100vh; width: 900px"><WorkflowRuns v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof WorkflowRuns>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Every run read, newest first, the first selected. */
export const AllRead: Story = {};

/** W43: grouped by status; a group folded by its heading hides its runs. */
export const GroupedByStatus: Story = {
    args: { groupBy: 'status' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const failed = canvas.getByRole('button', { name: /^Failed/u });
        await userEvent.click(failed);
        await expect(failed).toHaveAttribute('aria-expanded', 'false');
        await expect(canvas.queryByText('Bump vite to 7.1.7')).toBeNull();
    },
};

/** W43: the grouping menu, which reports the grouping picked. */
export const GroupingMenu: Story = {
    play: async ({ args, canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'Group: None' }));
        await userEvent.click(within(document.body).getByRole('menuitemradio', { name: /Ref/u }));
        await expect(args.onGroupBy).toHaveBeenCalledWith('ref');
    },
};

/** W44: grouped by ref, the counted ones first. */
export const GroupedByRef: Story = { args: { groupBy: 'ref' } };

/** W45: grouped by day. */
export const GroupedByDay: Story = { args: { groupBy: 'day' } };

/** Older runs still to read, the next page being read. */
export const ReadingOlder: Story = { args: { runs: { ...DEPLOY.runs, complete: false, status: 'reading' } } };

/** A page GitHub did not answer: said under the runs, a click asks again. */
export const ReadFailed: Story = {
    args: { runs: { ...DEPLOY.runs, complete: false, status: 'failed' } },
    play: async ({ args, canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: /could\snot\sbe\sread/u }));
        await expect(args.onReadMore).toHaveBeenCalled();
    },
};

/** No run is let through by the filters set: they can be cleared. */
export const NothingFiltered: Story = {
    args: {
        runs: {
            runs: [],
            status: 'idle',
            complete: true,
            seeded: false,
            filters: { ...NO_WORKFLOW_RUN_FILTERS, actor: 'rhu' },
        },
    },
    play: async ({ args, canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'Clear the filters' }));
        await expect(args.onFilter).toHaveBeenCalledWith(NO_WORKFLOW_RUN_FILTERS);
    },
};

/** Only other workflows run it: no runs of its own. */
export const CalledOnly: Story = {
    args: {
        runs: { runs: [], status: 'idle', complete: false, seeded: false, filters: NO_WORKFLOW_RUN_FILTERS },
        callOnly: true,
    },
};
