import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { NO_WORKFLOW_RUN_FILTERS } from './WorkflowRunHistory.js';
import WorkflowRunFilters from './WorkflowRunFilters.vue';

const meta = {
    component: WorkflowRunFilters,
    args: {
        filters: NO_WORKFLOW_RUN_FILTERS,
        choices: {
            refs: ['main', 'sofiab/tokens', 'chore/deploy-workflow'],
            events: ['push', 'pull_request', 'workflow_dispatch'],
            statuses: ['in_progress', 'failure', 'success', 'cancelled'],
            actors: ['dkim', 'sofiab', 'mlaine', 'rhu'],
        },
        countedRefs: ['main'],
        onChange: fn(),
    },
} satisfies Meta<typeof WorkflowRunFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Nothing filtered: each chip names its filter. A ref picked sets it, the other filters kept. */
export const NoneSet: Story = {
    play: async ({ args, canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'Ref' }));
        await userEvent.click(within(document.body).getByRole('option', { name: /sofiab\/tokens/u }));
        await expect(args.onChange).toHaveBeenCalledWith({ ...NO_WORKFLOW_RUN_FILTERS, ref: 'sofiab/tokens' });
    },
};

/** A ref set: its chip shows it, outlined in the accent; "Any ref" clears it. */
export const RefSet: Story = {
    args: { filters: { ...NO_WORKFLOW_RUN_FILTERS, ref: 'sofiab/tokens' } },
    play: async ({ args, canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'Ref: sofiab/tokens' }));
        await userEvent.click(within(document.body).getByRole('option', { name: 'Any ref' }));
        await expect(args.onChange).toHaveBeenCalledWith(NO_WORKFLOW_RUN_FILTERS);
    },
};
