import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import WorkflowAlertsBar from './WorkflowAlertsBar.vue';

const meta = {
    component: WorkflowAlertsBar,
    args: {
        alerts: { defaultBranch: true, defaultBranchName: 'main', patterns: [] },
        alertsOff: false,
        onSettings: fn(),
    },
    // As wide as the Workflows tab.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () => h('div', { style: { width: '1000px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof WorkflowAlertsBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W13: the default branch alone, with GitHub's name of it. */
export const DefaultBranch: Story = {};

/** Before the first read: the default branch in words, not in mono. */
export const NameNotKnown: Story = {
    args: { alerts: { defaultBranch: true, defaultBranchName: null, patterns: [] } },
};

/** W3a: the default branch and the patterns in outlines. */
export const WithPatterns: Story = {
    args: { alerts: { defaultBranch: true, defaultBranchName: 'main', patterns: ['v*', 'release/*'] } },
};

/** The default branch switched off: the patterns alone. */
export const PatternsOnly: Story = {
    args: { alerts: { defaultBranch: false, defaultBranchName: 'main', patterns: ['v*'] } },
};

/** W14: nothing raises alerts: failures here never mark the repository broken. */
export const AlertsOff: Story = {
    args: { alerts: { defaultBranch: false, defaultBranchName: 'main', patterns: [] }, alertsOff: true },
};
