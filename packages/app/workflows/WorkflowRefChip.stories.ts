import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import WorkflowRefChip from './WorkflowRefChip.vue';

const meta = {
    component: WorkflowRefChip,
    args: { name: 'main', kind: 'branch' },
} satisfies Meta<typeof WorkflowRefChip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A branch, on a filled ground. */
export const Branch: Story = {};

/** A tag. */
export const Tag: Story = { args: { name: 'v0.1.0-rc.3', kind: 'tag' } };

/** Words standing in for a name not known yet: not in mono. */
export const NameNotKnown: Story = { args: { name: 'default branch', text: true } };

/** A name longer than its place: cut short. */
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
