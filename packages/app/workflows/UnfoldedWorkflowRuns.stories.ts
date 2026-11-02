import { assertValue } from '@nzyme/utils/assert.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { defineComponent, h } from 'vue';

import { SAMPLE_WORKFLOWS_NOW, sampleStoredWorkflows, sampleWorkflowRuns } from '@/testing/sampleWorkflows.js';
import type { SampleWorkflowParams } from '@/testing/sampleWorkflows.js';

import { buildUnfoldedWorkflow } from './buildUnfoldedWorkflow.js';
import UnfoldedWorkflowRuns from './UnfoldedWorkflowRuns.vue';
import type { WorkflowRunHistoryState } from './WorkflowRunHistory.js';

const RETRY_KEY = 'retry';

/** Probe as W3b unfolds it: its kept runs on `main`, a branch's and a pull request's, one going. */
const PROBE: SampleWorkflowParams = {
    id: 5,
    name: 'Probe',
    runs: [
        { conclusion: 'success', ago: '3h', title: 'Fix the timezone on recurring classes', seconds: 251 },
        {
            conclusion: 'cancelled',
            ago: '2h',
            branch: 'chore/probe-target',
            event: 'workflow_dispatch',
            title: 'Try a second probe target',
        },
        {
            conclusion: 'failure',
            ago: '1h',
            branch: 'sofiab/tokens',
            event: 'pull_request',
            title: 'Move design tokens into the ui package',
            seconds: 242,
        },
        { conclusion: 'success', ago: '14m', title: 'Bump vite to 7.1.7', seconds: 192 },
        { conclusion: null, ago: '1m', title: 'Show the waiting list on the class page' },
    ],
};
/** Probe's older runs, read on demand. */
const PROBE_OLDER = sampleWorkflowRuns({
    ...PROBE,
    firstRun: -3,
    runs: [
        {
            conclusion: 'success',
            ago: '3d',
            title: 'Add a stale-while-revalidate cache to the API client',
            seconds: 178,
        },
        { conclusion: 'success', ago: '2d', branch: 'v0.1.0', title: 'Release v0.1.0', seconds: 205 },
        {
            conclusion: 'failure',
            ago: '1d',
            branch: 'sofiab/tokens',
            event: 'pull_request',
            title: 'Move design tokens into the ui package',
            seconds: 64,
        },
    ],
});
const READ: WorkflowRunHistoryState = { runs: PROBE_OLDER, status: 'idle', complete: true };

const meta = {
    component: UnfoldedWorkflowRuns,
    args: {
        name: 'Probe',
        unfolded: sampleUnfolded(PROBE, READ),
        now: SAMPLE_WORKFLOWS_NOW,
        selectedKey: null,
        retryKey: RETRY_KEY,
        onFilter: fn(),
        onOpenRun: fn(),
        onReadMore: fn(),
    },
    // As wide as the list of the design's screens.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () => h('div', { style: { width: '960px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof UnfoldedWorkflowRuns>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W3b: every ref, the kept runs and the older ones, every page read. */
export const EveryPageRead: Story = {};

/** W3b: still reading older runs. */
export const Reading: Story = {
    args: { unfolded: sampleUnfolded(PROBE, { runs: PROBE_OLDER, status: 'reading', complete: false }) },
};

/** W3b: everything kept shown, older runs not asked yet. The end in view only asks the caller for them. */
export const OlderNotAsked: Story = {
    args: { unfolded: sampleUnfolded(PROBE, { runs: [], status: 'idle', complete: false }) },
};

/** W3b: reading older runs failed: a line the tab's keys select. */
export const ReadFailed: Story = {
    args: { unfolded: sampleUnfolded(PROBE, { runs: [], status: 'failed', complete: false }) },
};

/** The failed read's line selected: Enter asks again. */
export const ReadFailedSelected: Story = { args: { ...ReadFailed.args, selectedKey: RETRY_KEY } };

/** A run's line selected. */
export const RunSelected: Story = { args: { selectedKey: `run:${assertValue(PROBE_OLDER[0]).id}` } };

/** W3b: the runs on one branch, its chip pressed. */
export const OnRef: Story = {
    args: {
        unfolded: sampleUnfolded(
            PROBE,
            { runs: PROBE_OLDER.filter(run => run.headBranch === 'sofiab/tokens'), status: 'idle', complete: true },
            'sofiab/tokens',
        ),
    },
};

/** Filtered by a ref no run was read on: it says so, and the ref stays among the chips. */
export const NoRunsOnRef: Story = {
    args: { unfolded: sampleUnfolded(PROBE, { runs: [], status: 'idle', complete: true }, 'release/2.0') },
};

/** A workflow with no run at all. */
export const NoRuns: Story = {
    args: {
        name: 'CodeQL',
        unfolded: sampleUnfolded({ id: 9, name: 'CodeQL', runs: [] }, { runs: [], status: 'idle', complete: true }),
    },
};

/** More refs than the chips offer, the one filtered by past them: it stays in sight. */
export const ManyRefs: Story = {
    args: {
        unfolded: sampleUnfolded(
            {
                id: 5,
                name: 'Probe',
                runs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name, index) => ({
                    conclusion: 'success',
                    ago: `${8 - index}h`,
                    branch: `feature/${name}`,
                    title: `Work on ${name}`,
                    seconds: 120,
                })),
            },
            { runs: [], status: 'idle', complete: true },
            'feature/a',
        ),
    },
};

/** F: the field opens, the chips still offered. */
export const FieldOpen: Story = {
    play: async ({ canvasElement }) => {
        await openField(canvasElement);
    },
};

/** F, then typing: the chips narrow to the refs holding it. */
export const FieldTyped: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const field = await openField(canvasElement);
        await userEvent.keyboard('tok');
        await expect(field).toHaveValue('tok');
        await expect(canvas.getByRole('button', { name: 'sofiab/tokens' })).toBeVisible();
        await expect(canvas.queryByRole('button', { name: 'main' })).toBeNull();
    },
};

async function openField(canvasElement: HTMLElement) {
    await userEvent.keyboard('f');
    const field = await within(canvasElement).findByRole('textbox');
    await expect(field).toHaveFocus();
    return field;
}

function sampleUnfolded(workflow: SampleWorkflowParams, history: WorkflowRunHistoryState, ref: string | null = null) {
    const stored = assertValue(sampleStoredWorkflows({ nameWithOwner: 'fitloop/webapp', workflows: [workflow] }));
    return buildUnfoldedWorkflow({
        stored,
        workflowId: workflow.id,
        ref,
        history,
        anyRef: ref === null ? history.runs : [],
    });
}
