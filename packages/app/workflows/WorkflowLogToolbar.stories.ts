import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { h } from 'vue';

import Button from '@/components/Button.vue';

import WorkflowLogToolbar from './WorkflowLogToolbar.vue';

const meta = {
    component: WorkflowLogToolbar,
    args: { job: 'build', size: '2,086 lines · 176 KB' },
    decorators: [() => ({ template: '<div style="width: 640px"><story /></div>' })],
} satisfies Meta<typeof WorkflowLogToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The job and how far its log is. */
export const Default: Story = {};

/** No job known yet: only what stands in for the size. */
export const NoJob: Story = { args: { job: null, size: 'Reading…' } };

/** What the log viewer puts at its end. */
export const WithActions: Story = {
    render: args => ({
        setup: () => () =>
            h(WorkflowLogToolbar, args, {
                default: () => h(Button, { variant: 'secondary', size: 'sm' }, () => 'Wrap lines'),
            }),
    }),
};

/** A job's name wider than the head. */
export const LongJobName: Story = {
    args: { job: `build (${'ubuntu-latest, node-22, '.repeat(6)}bun)` },
};
