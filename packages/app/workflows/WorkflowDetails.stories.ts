import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { SAMPLE_WORKFLOW_ITEMS } from '@/testing/sampleWorkflowItems.js';
import { SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';

import WorkflowDetails from './WorkflowDetails.vue';

const DEPLOY = SAMPLE_WORKFLOW_ITEMS.deploy.details;

const meta = {
    component: WorkflowDetails,
    args: { details: DEPLOY, now: SAMPLE_WORKFLOWS_NOW },
    render: args => ({
        components: { WorkflowDetails },
        setup: () => ({ args }),
        template: `<div style="width: 400px"><WorkflowDetails v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof WorkflowDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W30: triggers, broken on `main`, no tag run yet, the runs, three dispatch inputs, the file. */
export const Broken: Story = {};

/** W33: only pull requests run it; never counts. */
export const PullRequestsOnly: Story = { args: { details: SAMPLE_WORKFLOW_ITEMS.cla.details } };

/** GitHub generates it: no file. */
export const Generated: Story = { args: { details: SAMPLE_WORKFLOW_ITEMS.generated.details } };

/** Its file still being read. */
export const FileLoading: Story = { args: { details: { ...DEPLOY, file: { kind: 'loading' } } } };

/** Its file could not be read. */
export const FileFailed: Story = { args: { details: { ...DEPLOY, file: { kind: 'failed' } } } };

/** Only other workflows run it. */
export const CalledOnly: Story = {
    args: {
        details: {
            ...DEPLOY,
            file: {
                kind: 'parsed',
                file: { triggers: [{ event: 'workflow_call' }], dispatch: null, callOnly: true },
            },
        },
    },
};
