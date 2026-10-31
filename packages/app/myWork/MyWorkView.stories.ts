import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { D1_ITEMS, D1_MEMBERSHIP, sampleMembership, SAMPLE_NOW, sampleMyWork } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import MyWorkView from './MyWorkView.vue';
import { MY_WORK_VIEW_DEFAULTS } from './myWorkViewOptions.js';

const meta = {
    component: MyWorkView,
    args: {
        work: sampleMyWork(D1_ITEMS, D1_MEMBERSHIP, 'all'),
        group: null,
        viewerLogin: SAMPLE_VIEWER.login,
        now: SAMPLE_NOW,
        waitingCount: 0,
        filter: 'all',
        selectedId: null,
        'onUpdate:filter': fn(),
        'onUpdate:selectedId': fn(),
    },
    // As tall as the window, like in the app.
    render: args => ({
        components: { MyWorkView },
        setup: () => ({ args }),
        template: '<div style="display: flex; height: 100vh"><MyWorkView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof MyWorkView>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * D1: every group, every kind of row — a review asked, checks running, failing and sent back, approved and ready
 * ("Open on GitHub"), waiting for review, a draft; the project "Status" with "+1"; labels; a pull request nested
 * under the issue it closes, which is selected.
 */
export const AllGroups: Story = { args: { selectedId: 'I_1187' } };

/** "Needs me": reviews asked, my pull requests that need me, assigned issues; no mentions. */
export const NeedsMe: Story = { args: { filter: 'needsMe', work: sampleMyWork(D1_ITEMS, D1_MEMBERSHIP, 'needsMe') } };

/** Narrowed to one group from the sidebar. */
export const OneGroup: Story = { args: { group: 'authored' } };

/** K4: nothing on the user's plate, across the repositories they track — a good state. */
export const NothingOnYourPlate: Story = {
    args: { work: sampleMyWork([], sampleMembership({}), 'all'), trackedCount: 4 },
};

/** K5: nothing needs the user, but two of their pull requests wait on others; the empty state points there. */
export const NothingNeedsYou: Story = {
    args: { filter: 'needsMe', work: sampleMyWork([], sampleMembership({}), 'needsMe'), waitingCount: 2 },
};

/** Nothing waits on others. */
export const NothingWaiting: Story = {
    args: { filter: 'waitingOnOthers', work: sampleMyWork([], sampleMembership({}), 'waitingOnOthers') },
};

/** G7: the first download is under way; every group says it is still arriving. */
export const StillArriving: Story = { args: { work: sampleMyWork([], {}, 'all') } };

/** G7: two searches have answered — their groups are listed and usable — and the other two are still arriving. */
export const PartlyArrived: Story = {
    args: {
        work: sampleMyWork(
            D1_ITEMS,
            { reviewRequested: D1_MEMBERSHIP.reviewRequested, authored: D1_MEMBERSHIP.authored },
            'all',
        ),
    },
};

/** E2: three items selected together (`x`); an edit GitHub refused is said in its row for a moment. */
export const Selection: Story = {
    args: {
        selectedId: 'PR_15',
        checkedIds: ['PR_482', 'PR_1203', 'PR_15'],
        undone: new Map([['I_1187', '“regression” label undone']]),
    },
};

/** D9: my work as a board — a column per group, the pull request closing an assigned issue a smaller card under it. */
export const Board: Story = {
    args: { selectedId: 'I_1187', options: { ...MY_WORK_VIEW_DEFAULTS, layout: 'board' } },
};
