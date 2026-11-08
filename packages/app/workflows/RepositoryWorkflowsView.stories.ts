import { assertValue } from '@nzyme/utils/assert.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import {
    SAMPLE_TAB_WORKFLOWS,
    SAMPLE_WORKFLOWS_NOW,
    sampleStoredWorkflows,
    sampleWorkflowRuns,
} from '@/testing/sampleWorkflows.js';
import type { SampleRepositoryParams, SampleWorkflowParams } from '@/testing/sampleWorkflows.js';

import { buildRepositoryWorkflows } from './buildRepositoryWorkflows.js';
import { buildUnfoldedWorkflow } from './buildUnfoldedWorkflow.js';
import RepositoryWorkflowsView from './RepositoryWorkflowsView.vue';
import type { WorkflowRunHistoryState } from './WorkflowRunHistory.js';
import type { WorkflowRefSettings } from './WorkflowTypes.js';

const WEBAPP = 'fitloop/webapp';
const DEFAULT: WorkflowRefSettings = { defaultBranch: true, refs: [] };

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
const UNFOLDED_WORKFLOWS = SAMPLE_TAB_WORKFLOWS.map(workflow => (workflow.id === PROBE.id ? PROBE : workflow));

const meta = {
    component: RepositoryWorkflowsView,
    args: {
        nameWithOwner: WEBAPP,
        now: SAMPLE_WORKFLOWS_NOW,
        list: sampleList({ workflows: SAMPLE_TAB_WORKFLOWS }),
        onOpenRun: fn(),
        onUnfold: fn(),
        onFilter: fn(),
        onReadMore: fn(),
        onSettings: fn(),
        onOpenOnGitHub: fn(),
    },
    // As the tab sits under the repository's toolbar, beside the sidebar.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () =>
                    h('div', { style: { display: 'flex', width: '1000px', height: '600px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof RepositoryWorkflowsView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W13: alerts on the default branch only — Release failed on a tag and Nightly e2e on a branch without alerts. */
export const Default: Story = {};

/** W3a: alerts on `main` and the tags `v*` — Release is broken on the pattern, beside Deploy. */
export const WithPatterns: Story = {
    args: { list: sampleList({ workflows: SAMPLE_TAB_WORKFLOWS }, { defaultBranch: true, refs: ['v*', 'release/*'] }) },
};

/** W14: alerts off — every failure under No alerts, nothing broken. */
export const AlertsOff: Story = {
    args: { list: sampleList({ workflows: SAMPLE_TAB_WORKFLOWS }, { defaultBranch: false, refs: [] }) },
};

/** W3c: the workflows listed, most of their runs still being read — no verdict, no green, "so far". */
export const NotKnownYet: Story = {
    args: {
        list: sampleList({
            workflows: SAMPLE_TAB_WORKFLOWS.map(workflow =>
                ['Deploy', 'Probe'].includes(workflow.name) ? workflow : { ...workflow, runs: [] },
            ),
        }),
    },
};

/** Nothing read of the repository yet: ghost workflow rows (first run and loading D17, ES27). */
export const NotReadYet: Story = { args: { list: sampleList({ unread: true }) } };

/** W3d: the repository has no workflows. */
export const NoWorkflows: Story = { args: { nameWithOwner: 'mlaine/tasklet', list: sampleList({ workflows: [] }) } };

/** W3e: Actions turned off, nothing read before. */
export const ActionsOff: Story = {
    args: {
        nameWithOwner: 'fitloop/api',
        list: sampleList({ workflows: [], unavailable: { reason: 'disabled', status: 404 } }),
    },
};

/** W3e: GitHub refused (403); the rows read before stay below. */
export const Refused: Story = {
    args: {
        list: sampleList({ workflows: SAMPLE_TAB_WORKFLOWS, unavailable: { reason: 'refused', status: 403 } }),
    },
};

/** W3b: Probe unfolded, its kept runs and the older ones read so far; still reading. */
export const Unfolded: Story = {
    args: {
        list: sampleList({ workflows: UNFOLDED_WORKFLOWS }),
        unfolded: sampleUnfolded({ runs: PROBE_OLDER, status: 'reading', complete: false }),
    },
};

/** W3b: Probe's runs on one branch, every page read. */
export const UnfoldedOnRef: Story = {
    args: {
        list: sampleList({ workflows: UNFOLDED_WORKFLOWS }),
        unfolded: sampleUnfolded(
            { runs: PROBE_OLDER.filter(run => run.headBranch === 'sofiab/tokens'), status: 'idle', complete: true },
            'sofiab/tokens',
        ),
    },
};

/** W3b: reading Probe's older runs failed; the rest of the tab still works. */
export const UnfoldedReadFailed: Story = {
    args: {
        list: sampleList({ workflows: UNFOLDED_WORKFLOWS }),
        unfolded: sampleUnfolded({ runs: [], status: 'failed', complete: false }),
    },
};

/** W3b: everything kept shown, older runs not asked yet: the end in view asks for them. */
export const UnfoldedNotRead: Story = {
    args: {
        list: sampleList({ workflows: UNFOLDED_WORKFLOWS }),
        unfolded: sampleUnfolded({ runs: [], status: 'idle', complete: false }),
    },
};

function sampleUnfolded(history: WorkflowRunHistoryState, ref: string | null = null) {
    const stored = assertValue(sampleStoredWorkflows({ nameWithOwner: WEBAPP, workflows: UNFOLDED_WORKFLOWS }));
    return buildUnfoldedWorkflow({
        stored,
        workflowId: PROBE.id,
        ref,
        history,
        anyRef: ref === null ? history.runs : PROBE_OLDER,
    });
}

function sampleList(repository: Omit<SampleRepositoryParams, 'nameWithOwner'>, settings = DEFAULT) {
    return buildRepositoryWorkflows({
        stored: sampleStoredWorkflows({ nameWithOwner: WEBAPP, ...repository }),
        settings,
        now: SAMPLE_WORKFLOWS_NOW,
    });
}
