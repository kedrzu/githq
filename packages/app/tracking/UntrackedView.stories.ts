import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { SquareKanban } from 'lucide-vue-next';

import { getSettingsPath } from '@/settings/settingsRoutes.js';
import { D1_ITEMS, SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import UntrackedView from './UntrackedView.vue';

const meta = {
    component: UntrackedView,
    args: {
        icon: SquareKanban,
        name: 'Mobile launch',
        meta: 'fitloop',
        githubUrl: 'https://github.com/orgs/fitloop/projects/4',
        rows: D1_ITEMS.slice(0, 1).map(item => ({ key: item.id, id: item.id, value: item, nested: [] })),
        summary: 'githq only has what concerns you in Mobile launch: 1 item.',
        others: "Its other items are on GitHub. Search and ⌘K only find what's here.",
        settingsTo: getSettingsPath('projects', 'https://github.com/orgs/skyline-labs/projects/5'),
        properties: ['status', 'updated'],
        viewerLogin: SAMPLE_VIEWER.login,
        now: SAMPLE_NOW,
    },
    // As tall as the window, like in the app.
    render: args => ({
        components: { UntrackedView },
        setup: () => ({ args }),
        template: '<div style="display: flex; height: 100vh"><UntrackedView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof UntrackedView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** J4: a project not tracked, with what concerns the user. J3 is the repository's own story. */
export const Project: Story = {};

/** Nothing of it concerns the user: only the lines. */
export const NothingConcerns: Story = {
    args: {
        rows: [],
        summary: 'Nothing in Mobile launch concerns you, so githq has none of it.',
        others: "Its items are on GitHub. Search and ⌘K only find what's here.",
    },
};
