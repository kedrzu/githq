import { assertValue } from '@nzyme/utils/assert.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { defineComponent, h } from 'vue';

import { SAMPLE_WORKFLOWS_NOW, sampleStoredWorkflows } from '@/testing/sampleWorkflows.js';

import WorkflowAlertsBlock from './WorkflowAlertsBlock.vue';

const WEBAPP = 'fitloop/webapp';
/** With any space: the translations keep short words with the next one. */
const PATTERN_FIELD = /Branch\sor\stag\spattern/u;

/**
 * The design's fitloop/webapp (actions W7): Deploy broken on main and passed on the branch v2-experiment, Release
 * failed on the tag v0.1.0-rc.3 after passing on rc.1 and rc.2, Nightly e2e failing on staging.
 */
const WORKFLOWS = sampleStoredWorkflows({
    nameWithOwner: WEBAPP,
    workflows: [
        {
            id: 1,
            name: 'Deploy',
            runs: [
                { conclusion: 'success', ago: '2d', branch: 'chore/deploy-workflow' },
                { conclusion: 'success', ago: '1d', branch: 'v2-experiment' },
                { conclusion: 'success', ago: '20h' },
                { conclusion: 'failure', ago: '2h' },
            ],
        },
        { id: 2, name: 'Probe', runs: [{ conclusion: 'success', ago: '1h' }] },
        {
            id: 4,
            name: 'Release',
            runs: [
                { conclusion: 'success', ago: '3d', branch: 'v0.1.0-rc.1' },
                { conclusion: 'success', ago: '2d', branch: 'v0.1.0-rc.2' },
                { conclusion: 'failure', ago: '6h', branch: 'v0.1.0-rc.3' },
            ],
        },
        { id: 5, name: 'Nightly e2e', runs: [{ conclusion: 'failure', ago: '5h', branch: 'staging' }] },
    ],
});
/** Runs on other branches alone: nothing on the default branch. */
const OTHER_BRANCHES = sampleStoredWorkflows({
    nameWithOwner: WEBAPP,
    workflows: [
        { id: 1, name: 'Deploy', runs: [{ conclusion: 'failure', ago: '5h', branch: 'staging' }] },
        { id: 2, name: 'Test', runs: [{ conclusion: 'success', ago: '4h', branch: 'sofiab/tokens' }] },
        { id: 3, name: 'Probe', runs: [{ conclusion: 'cancelled', ago: '3h', branch: 'chore/probe-target' }] },
    ],
});

const meta = {
    component: WorkflowAlertsBlock,
    args: {
        nameWithOwner: WEBAPP,
        stored: WORKFLOWS,
        settings: { defaultBranch: true, refs: [] },
        now: SAMPLE_WORKFLOWS_NOW,
        onChange: fn(),
    },
    // As wide as Settings in a window: the section's controls beside its description.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () => h('div', { style: { width: '1040px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof WorkflowAlertsBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T16: the default: its default branch alone, one broken there; the other refs with recent runs below. */
export const DefaultBranchOnly: Story = {};

/** W7: main plus `v*`, flagged for catching the branch v2-experiment beside the release candidates. */
export const WithPattern: Story = { args: { settings: { defaultBranch: true, refs: ['v*'] } } };

/** A pattern matching more than its row has room for: "+n". */
export const MoreThanLimit: Story = { args: { settings: { defaultBranch: true, refs: ['*'] } } };

/** W8: `release/*` matches no ref githq has seen a run on yet. */
export const MatchingNothing: Story = { args: { settings: { defaultBranch: true, refs: ['release/*'] } } };

/** The default branch off, a pattern still on. */
export const PatternsOnly: Story = { args: { settings: { defaultBranch: false, refs: ['v*'] } } };

/** W9: the default branch switched off and no patterns: no alerts at all. */
export const AlertsOff: Story = { args: { settings: { defaultBranch: false, refs: [] } } };

/** W9: alerts off, and no run seen on the default branch either. */
export const AlertsOffNoRuns: Story = {
    args: { stored: OTHER_BRANCHES, settings: { defaultBranch: false, refs: [] } },
};

/** No recent run on the default branch; the other refs' last words: failed, passed, and one that says nothing. */
export const NoRunsOnDefaultBranch: Story = { args: { stored: OTHER_BRANCHES } };

/** W10: just tracked, with `v*` brought from another computer: no runs read, so no matches and no counts. */
export const NotRead: Story = { args: { stored: undefined, settings: { defaultBranch: true, refs: ['v*'] } } };

/** Not read and alerts off: not even the default branch's name. */
export const NotReadAlertsOff: Story = { args: { stored: undefined, settings: { defaultBranch: false, refs: [] } } };

/** GitHub refuses to say: what is known stays, without a count. */
export const Unavailable: Story = {
    args: {
        stored: sampleStoredWorkflows({
            nameWithOwner: WEBAPP,
            workflows: [
                { id: 1, name: 'Deploy', runs: [{ conclusion: 'failure', ago: '2h' }] },
                { id: 4, name: 'Release', runs: [{ conclusion: 'failure', ago: '6h', branch: 'v0.1.0-rc.3' }] },
            ],
            unavailable: { reason: 'refused', status: 403 },
        }),
        settings: { defaultBranch: true, refs: ['v*'] },
    },
};

/** J: the default branch selected: Space switches it. */
export const DefaultBranchSelected: Story = {
    args: WithPattern.args,
    play: async ({ canvasElement }) => {
        await userEvent.keyboard('j');
        await waitFor(() =>
            expect(canvasElement.querySelector('[data-alert-key="default"]')).toHaveAttribute('aria-current', 'true'),
        );
    },
};

/** J J: a pattern selected: its pencil and X show, Enter edits and ⌫ removes. */
export const PatternSelected: Story = {
    args: WithPattern.args,
    play: async ({ canvasElement }) => {
        await userEvent.keyboard('jj');
        await expect(await within(canvasElement).findByRole('button', { name: /Remove\sv\*/u })).toBeVisible();
    },
};

/** A: the add field focused with nothing typed. */
export const AddFocused: Story = {
    play: async ({ canvasElement }) => {
        await openAddField(canvasElement);
    },
};

/** W11: `v*` being added: the preview says what it would alert on, and what turns broken. */
export const Adding: Story = {
    play: async ({ canvasElement }) => {
        await openAddField(canvasElement);
        await userEvent.keyboard('v*');
        await within(canvasElement).findByText(/Release\sturns\sbroken/u);
    },
};

/** W11: a pattern already in the list says so. */
export const AddingDuplicate: Story = {
    args: WithPattern.args,
    play: async ({ canvasElement }) => {
        await openAddField(canvasElement);
        await userEvent.keyboard('v*');
        await within(canvasElement).findByText(/Already\sin\sthe\slist/u);
    },
};

/** W12: Enter opens a pattern in place, focused. */
export const Editing: Story = {
    args: WithPattern.args,
    play: async ({ canvasElement }) => {
        await openEditor(canvasElement);
    },
};

/** W12: the pattern changed: the preview says what stops counting. */
export const EditingStopsCounting: Story = {
    args: WithPattern.args,
    play: async ({ canvasElement }) => {
        const field = await openEditor(canvasElement);
        await userEvent.clear(field);
        await userEvent.keyboard('release/*');
        await within(canvasElement).findByText(/No\slonger\scounted/u);
    },
};

/** W12: the pattern changed to another one listed: it says so. */
export const EditingDuplicate: Story = {
    args: { settings: { defaultBranch: true, refs: ['v*', 'release/*'] } },
    play: async ({ canvasElement }) => {
        const field = await openEditor(canvasElement);
        await userEvent.clear(field);
        await userEvent.keyboard('release/*');
        await within(canvasElement).findByText(/Already\sin\sthe\slist/u);
    },
};

async function openAddField(canvasElement: HTMLElement) {
    await userEvent.keyboard('a');
    const field = within(canvasElement).getByRole('textbox', { name: PATTERN_FIELD });
    await expect(field).toHaveFocus();
    return field;
}

/** On the first pattern: the default branch is J away, the pattern J J. */
async function openEditor(canvasElement: HTMLElement) {
    await userEvent.keyboard('jj{Enter}');
    const fields = await within(canvasElement).findAllByRole('textbox', { name: PATTERN_FIELD });
    const field = assertValue(fields[0]);
    await expect(field).toHaveFocus();
    return field;
}
