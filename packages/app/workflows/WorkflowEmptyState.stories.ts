import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleCheck, CircleDashed, CloudOff, Github, Workflow } from 'lucide-vue-next';
import { defineComponent, h } from 'vue';

import Button from '@/components/Button.vue';

import WorkflowEmptyState from './WorkflowEmptyState.vue';

const meta = {
    component: WorkflowEmptyState,
    args: {
        icon: CircleCheck,
        tone: 'green',
        title: 'Nothing broken',
        text: 'Every workflow on the refs that count passed its latest run, across 6 repositories.',
        detail: 'exit 0',
    },
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () =>
                    h('div', { style: { display: 'flex', justifyContent: 'center', padding: '48px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof WorkflowEmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Good news: a quiet green icon. */
export const Green: Story = {};

/** GitHub refuses to show the repository's Actions. */
export const Red: Story = {
    args: {
        icon: CloudOff,
        tone: 'red',
        title: 'GitHub shows no workflows here',
        text: 'GitHub refused to list this repository’s Actions. Nothing here adds to the total.',
        detail: 'GET /repos/fitloop/webapp/actions/runs → 403',
    },
};

/** Not read yet: not the same as healthy. */
export const Amber: Story = {
    args: {
        icon: CircleDashed,
        tone: 'amber',
        title: 'Not read yet',
        text: 'githq hasn’t read this repository’s workflows yet. They appear within a few seconds.',
        detail: null,
    },
};

/** No workflows, with a way on. */
export const Neutral: Story = {
    args: {
        icon: Workflow,
        tone: 'neutral',
        title: 'No workflows',
        text: 'This repository has no GitHub Actions workflows.',
        detail: '.github/workflows/ is empty',
    },
    render: args => ({
        setup: () => () =>
            h(WorkflowEmptyState, args, {
                actions: () => h(Button, { variant: 'outline', icon: Github }, () => 'Open on GitHub'),
            }),
    }),
};
