import type { Meta, StoryObj } from '@storybook/vue3-vite';

import RepositoryWorkflowsHints from './RepositoryWorkflowsHints.vue';

const meta = {
    component: RepositoryWorkflowsHints,
    args: { failure: true },
} satisfies Meta<typeof RepositoryWorkflowsHints>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W35: on a workflow with a failed run, every key has something to do. */
export const WithFailure: Story = {};

/** W35: on a workflow that never failed, F's hint is dimmed. */
export const WithoutFailure: Story = { args: { failure: false } };
