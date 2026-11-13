import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { GitCommitHorizontal } from 'lucide-vue-next';
import { fn } from 'storybook/test';

import ReviewSubmodulePanel from './ReviewSubmodulePanel.vue';

const SUBJECTS = [
    'feat(ioc): resolve child containers lazily',
    'fix(ioc): keep the disposal order',
    'chore: release 4.2.0',
];

const meta = {
    component: ReviewSubmodulePanel,
    args: {
        icon: GitCommitHorizontal,
        title: 'Commits',
        count: '3 ahead',
        showMore: null,
        note: null,
        onExpand: fn(),
    },
    render: args => ({
        components: { ReviewSubmodulePanel },
        setup: () => ({ args, subjects: SUBJECTS }),
        template:
            '<ReviewSubmodulePanel v-bind="args"><li v-for="subject in subjects" :key="subject">{{ subject }}</li></ReviewSubmodulePanel>',
    }),
} satisfies Meta<typeof ReviewSubmodulePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** All its rows shown: no foot. */
export const AllShown: Story = {};

/** Rows held back and GitHub's cap: Show more and the note in the foot. */
export const More: Story = { args: { showMore: 'Show 18 more commits', note: '62 more commits' } };
