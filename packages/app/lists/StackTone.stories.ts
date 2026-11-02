import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleCheck, CircleX, GitMerge, GitPullRequestDraft, Hourglass, Loader } from 'lucide-vue-next';
import { expect, within } from 'storybook/test';

import StackTone from './StackTone.vue';

const meta = {
    component: StackTone,
    args: { look: { icon: CircleX, tone: 'danger' } },
} satisfies Meta<typeof StackTone>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The icon alone, as a pull request's line inside an expanded stack's card shows it. */
export const Danger: Story = {};

/** With the words after it, in the same colour: the state in words (SP14). */
export const WithWords: Story = {
    args: { look: { icon: CircleCheck, tone: 'success' } },
    render: args => ({
        components: { StackTone },
        setup: () => ({ args }),
        template: '<StackTone v-bind="args">All 3 ready</StackTone>',
    }),
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('All 3 ready')).toBeVisible();
    },
};

/** Checks running. */
export const Warning: Story = { args: { look: { icon: Loader, tone: 'warning' } } };

/** Merged. */
export const Done: Story = { args: { look: { icon: GitMerge, tone: 'done' } } };

/** Waiting. */
export const Muted: Story = { args: { look: { icon: Hourglass, tone: 'muted' } } };

/** A draft. */
export const Dim: Story = { args: { look: { icon: GitPullRequestDraft, tone: 'dim' } } };
