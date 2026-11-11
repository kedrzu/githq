import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { sampleUser } from '@/testing/sampleMyWork.js';

import MarkdownSuggestions from './MarkdownSuggestions.vue';

/** A caret where the story's `@` or `#` would be typed, near the page's top left. */
const CARET = { getBoundingClientRect: () => new DOMRect(40, 40, 0, 20) };

const meta = {
    component: MarkdownSuggestions,
    args: { id: 'suggestions', active: 0, anchor: CARET, repository: 'mlaine/tasklet' },
} satisfies Meta<typeof MarkdownSuggestions>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Mention menu`: `@so` typed, the first person highlighted. */
export const People: Story = {
    args: {
        suggestions: {
            kind: 'mention',
            rows: [
                { ...sampleUser('sofiab', '#7fb3d5'), name: 'Sofia Berg' },
                { ...sampleUser('sren-dev', '#e8a87c'), name: 'Søren Holm' },
                { ...sampleUser('sophie-k', '#b39ddb'), name: 'Sophie Klein' },
            ],
        },
    },
};

/** `Activity / Reference menu`: `#1` typed — open and closed issues, a pull request — the first highlighted. */
export const References: Story = {
    args: {
        suggestions: {
            kind: 'reference',
            rows: [
                {
                    kind: 'issue',
                    state: 'OPEN',
                    stateReason: null,
                    number: 12,
                    title: 'Sub-issue links are lost when the parent is in another repository',
                },
                {
                    kind: 'pullRequest',
                    state: 'OPEN',
                    isDraft: false,
                    merged: false,
                    number: 14,
                    title: 'Store project items next to issues',
                },
                {
                    kind: 'issue',
                    state: 'CLOSED',
                    stateReason: 'COMPLETED',
                    number: 11,
                    title: 'Lists flash empty before the store opens',
                },
                { kind: 'issue', state: 'OPEN', stateReason: null, number: 10, title: 'Rebuild links on every sync' },
            ],
        },
    },
};
