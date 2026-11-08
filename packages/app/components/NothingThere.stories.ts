import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleCheckBig } from 'lucide-vue-next';

import NothingThere from './NothingThere.vue';

const meta = {
    component: NothingThere,
    args: { place: 'screen', title: 'No issues', detail: 'mlaine/tasklet has no issues, open or closed.' },
    decorators: [() => ({ template: '<div style="display: flex; width: 640px; height: 380px"><story /></div>' })],
} satisfies Meta<typeof NothingThere>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A screen whose data is complete and holds nothing: an inbox, quiet grey. */
export const Screen: Story = {};

/** Nothing is good news: green (K4). */
export const ScreenGood: Story = {
    args: {
        icon: CircleCheckBig,
        tone: 'good',
        title: 'Nothing on your plate',
        detail: 'No review requests, open pull requests, assigned issues or mentions, across your 15 tracked repositories and the rest of GitHub.',
    },
};

/** An arrived, empty group: "Nothing here." under its header. */
export const Group: Story = {
    args: { place: 'group', title: undefined, detail: undefined },
    decorators: [() => ({ template: '<div style="width: 644px"><story /></div>' })],
};

/** An arrived, empty board column. */
export const Column: Story = {
    args: { place: 'column', title: undefined, detail: undefined },
    decorators: [() => ({ template: '<div style="width: 252px"><story /></div>' })],
};
