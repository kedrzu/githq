import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import { SAMPLE_TAB_WORKFLOWS, SAMPLE_WORKFLOWS_NOW, sampleStoredWorkflows } from '@/testing/sampleWorkflows.js';
import type { SampleRepositoryParams } from '@/testing/sampleWorkflows.js';

import { buildRepositoryWorkflows } from './buildRepositoryWorkflows.js';
import RepositoryWorkflowsView from './RepositoryWorkflowsView.vue';
import type { WorkflowRefSettings } from './WorkflowTypes.js';

const WEBAPP = 'fitloop/webapp';
const DEFAULT: WorkflowRefSettings = { defaultBranch: true, refs: [] };

const meta = {
    component: RepositoryWorkflowsView,
    args: {
        nameWithOwner: WEBAPP,
        now: SAMPLE_WORKFLOWS_NOW,
        list: sampleList({ workflows: SAMPLE_TAB_WORKFLOWS }),
        onOpen: fn(),
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

/** Nothing read of the repository yet. */
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

function sampleList(repository: Omit<SampleRepositoryParams, 'nameWithOwner'>, settings = DEFAULT) {
    return buildRepositoryWorkflows({
        stored: sampleStoredWorkflows({ nameWithOwner: WEBAPP, ...repository }),
        settings,
        now: SAMPLE_WORKFLOWS_NOW,
    });
}
