import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import WorkflowRefLabel from './WorkflowRefLabel.vue';

const meta = {
    component: WorkflowRefLabel,
    args: { name: 'main', kind: 'branch' },
} satisfies Meta<typeof WorkflowRefLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A branch, its name in mono. */
export const Branch: Story = {};

/** A tag. */
export const Tag: Story = { args: { name: 'v0.1.0-rc.3', kind: 'tag' } };

/** Not a ref: what a workflow only pull requests ran is read on, in words. */
export const PullRequests: Story = { args: { name: 'pull requests', kind: 'pullRequests', text: true } };

/** The size of a chip. */
export const Compact: Story = { args: { compact: true } };

/** Its width is the caller's: a name longer than it is cut short. */
export const CutShort: Story = {
    args: { name: 'dependabot/npm_and_yarn/packages/app/vite-7.1.7' },
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () => h('div', { style: { display: 'flex', width: '160px' } }, [h(Story)]),
            });
        },
    ],
};
