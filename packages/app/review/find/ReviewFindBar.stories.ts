import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import type { DiffMatches } from './findDiffMatches.js';
import ReviewFindBar from './ReviewFindBar.vue';

// The bar reads only whether there are matches; what they are is the code's.
const MATCHES = emptyMatches();

const meta = {
    component: ReviewFindBar,
    args: {
        query: 'review',
        options: { matchCase: false, wholeWord: false, regex: false },
        state: { status: 'done', matches: MATCHES },
        total: 128,
        position: 2,
        incomplete: false,
        'onUpdate:query': fn(),
        onNext: fn(),
        onPrevious: fn(),
        onClose: fn(),
        onToggle: fn(),
    },
} satisfies Meta<typeof ReviewFindBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR137: "3 of 128". */
export const Default: Story = {};

/** Just opened, nothing typed. */
export const Empty: Story = {
    args: { query: '', state: { status: 'idle' }, total: 0, position: null },
};

/** Still searching, or not every file searched yet: "3 of 128+". */
export const Searching: Story = {
    args: { state: { status: 'searching', matches: MATCHES }, incomplete: true },
};

/** Nothing found. */
export const NoResults: Story = {
    args: { query: 'zzz', state: { status: 'done', matches: MATCHES }, total: 0, position: null },
};

/** A pattern that doesn't compile. */
export const Invalid: Story = {
    args: {
        query: '(foo',
        options: { matchCase: false, wholeWord: false, regex: true },
        state: { status: 'invalid' },
        total: 0,
        position: null,
    },
};

/** A pattern stopped for taking too long. */
export const TooSlow: Story = {
    args: {
        query: '(a+)+$',
        options: { matchCase: false, wholeWord: false, regex: true },
        state: { status: 'tooSlow' },
        total: 0,
        position: null,
    },
};

/** CR138: every switch on, "1 of 12". */
export const AllToggles: Story = {
    args: {
        query: String.raw`fo+\b`,
        options: { matchCase: true, wholeWord: true, regex: true },
        state: { status: 'done', matches: MATCHES },
        total: 12,
        position: 0,
    },
};

function emptyMatches(): DiffMatches {
    const none = new Uint32Array();
    return { lines: none, starts: none, ends: none, counted: none, capped: false };
}
