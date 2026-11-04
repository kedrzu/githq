import type { Meta, StoryObj } from '@storybook/vue3-vite';

import RepositoryWorkflowsHints from './RepositoryWorkflowsHints.vue';

const meta = {
    component: RepositoryWorkflowsHints,
    args: { unfolded: false },
} satisfies Meta<typeof RepositoryWorkflowsHints>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W3a: on a workflow's row, Enter opens and → unfolds the other runs. */
export const Folded: Story = {};

/** W3b: with a workflow unfolded, Enter opens a run, ← folds and F filters by ref. */
export const Unfolded: Story = { args: { unfolded: true } };
