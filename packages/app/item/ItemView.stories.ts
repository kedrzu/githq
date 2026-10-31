import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import {
    D1_ISSUE,
    D1_ISSUE_DETAIL,
    F1_CLOSES,
    F1_PULL_REQUEST,
    F1_PULL_REQUEST_DETAIL,
    F3_PULL_REQUEST,
    F3_PULL_REQUEST_DETAIL,
} from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_CONTRIBUTOR_EDITING, SAMPLE_MAINTAINER_EDITING } from '@/testing/sampleRepositories.js';

import ItemView from './ItemView.vue';

const meta = {
    component: ItemView,
    args: {
        item: D1_ISSUE,
        detail: D1_ISSUE_DETAIL,
        arrangement: 'panel',
        position: { index: 6, count: 13 },
        closes: [],
        now: SAMPLE_NOW,
        loadAllComments: fn(() => Promise.resolve()),
        editing: SAMPLE_MAINTAINER_EDITING,
        onEdit: fn(),
        onNeedProjects: fn(),
        onClose: fn(),
        onPrevious: fn(),
        onNext: fn(),
        onArrange: fn(),
        onOpen: fn(),
    },
    // As tall as the window, and as wide as the arrangement: the panel's 560px, or the window.
    render: args => ({
        components: { ItemView },
        setup: () => ({ args }),
        template: `<div :style="{ height: '100vh', width: args.arrangement === 'panel' ? '560px' : '100%' }"><ItemView v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ItemView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** D1: an issue in the panel — properties with their keys, two projects with every field, the body, the latest comments. */
export const IssueInPanel: Story = {};

/** D2/D3: the same issue with a column at the side, as a modal and a page show it. */
export const IssueSplit: Story = { args: { arrangement: 'page' } };

/** F1: a pull request that can't merge yet — two checks failing, changes requested; the issue it closes. */
export const PullRequestFailing: Story = {
    args: {
        item: F1_PULL_REQUEST,
        detail: F1_PULL_REQUEST_DETAIL,
        closes: F1_CLOSES,
        position: { index: 3, count: 13 },
    },
};

/** F2: the same pull request on a page of its own: reviews at the top of the side column. */
export const PullRequestFailingPage: Story = {
    args: { ...PullRequestFailing.args, arrangement: 'page' },
};

/** F3: approved and ready — "Open on GitHub" is the one prominent action; githq doesn't merge. */
export const PullRequestReady: Story = {
    args: { item: F3_PULL_REQUEST, detail: F3_PULL_REQUEST_DETAIL, position: { index: 4, count: 13 } },
};

/** Opened before its detail arrived: the row's properties and the project "Status" show at once, comments load. */
export const LoadingComments: Story = { args: { detail: null, position: null } };

/** K1b: a contributor sees the labels, assignees and milestone as plain values — no keys — and one line says why. */
export const ContributorView: Story = { args: { editing: SAMPLE_CONTRIBUTOR_EDITING } };

/** Only shown: nothing is offered (an item of a session that ended). */
export const ReadOnly: Story = { args: { editing: null } };
