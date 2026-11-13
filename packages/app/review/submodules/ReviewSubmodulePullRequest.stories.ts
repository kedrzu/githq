import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { withGitHubLinks } from '@/testing/withGitHubLinks.js';

import ReviewSubmodulePullRequest from './ReviewSubmodulePullRequest.vue';

const meta = {
    component: ReviewSubmodulePullRequest,
    args: {
        repository: 'kedrzu/nzyme',
        pullRequest: {
            number: 412,
            state: 'OPEN',
            title: 'Resolve child containers lazily',
            url: 'https://github.com/kedrzu/nzyme/pull/412',
            isDraft: false,
        },
    },
    decorators: [withGitHubLinks()],
} satisfies Meta<typeof ReviewSubmodulePullRequest>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Open: a green pill. */
export const Open: Story = {};

/** A draft: a quiet pill. */
export const Draft: Story = { args: { pullRequest: { ...meta.args.pullRequest, isDraft: true } } };

/** Merged: a purple pill. */
export const Merged: Story = { args: { pullRequest: { ...meta.args.pullRequest, state: 'MERGED' } } };

/** Closed: a red pill. */
export const Closed: Story = { args: { pullRequest: { ...meta.args.pullRequest, state: 'CLOSED' } } };

/** A title longer than the card is wide wraps. */
export const LongTitle: Story = {
    args: {
        pullRequest: {
            ...meta.args.pullRequest,
            title: 'Resolve child containers lazily, keep the disposal order of a scope and inject from the nearest lazy container in vue-ioc',
        },
    },
};
