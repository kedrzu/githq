import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { findLogMatches } from './utils/findLogMatches.js';
import type { JobLogLine, ParsedJobLog } from './utils/parseJobLog.js';
import WorkflowLogSearch from './WorkflowLogSearch.vue';

const LOG: ParsedJobLog = {
    lines: Array.from({ length: 12 }, (_, index): JobLogLine => ({
        number: index + 1,
        time: null,
        text: 'could not resolve',
        kind: 'plain',
        stepNumber: index < 2 ? 1 : 2,
        stepLine: index + 1,
    })),
    errors: [],
    steps: [],
    characters: 0,
};

const meta = {
    component: WorkflowLogSearch,
    args: {
        query: 'resolve',
        matches: findLogMatches(LOG, 'resolve'),
        position: 2,
        lineTotal: 2086,
        onlyMatches: false,
        'onUpdate:query': fn(),
        onNext: fn(),
        onPrevious: fn(),
        onShowInFullLog: fn(),
        onToggleOnly: fn(),
        onClose: fn(),
    },
    decorators: [() => ({ template: '<div style="width: 900px"><story /></div>' })],
} satisfies Meta<typeof WorkflowLogSearch>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W4b: "3 of 12 in 2 steps", and what it can do. */
export const Default: Story = {};

/** W4c: "12 lines of 2,086 · in 2 steps", the toggle on. */
export const OnlyMatches: Story = { args: { onlyMatches: true } };

/** Just opened. */
export const Empty: Story = { args: { query: '', matches: null, position: null } };

/** Nothing found. */
export const NoMatches: Story = {
    args: { query: 'nothing like it', matches: findLogMatches(LOG, 'nothing like it'), position: null },
};

/** A line went past the cap: there are more than it says. */
export const Capped: Story = {
    args: { matches: { ...findLogMatches(LOG, 'resolve'), capped: true } },
};
