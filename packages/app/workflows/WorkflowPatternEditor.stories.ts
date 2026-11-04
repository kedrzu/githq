import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn, userEvent, within } from 'storybook/test';
import { defineComponent, h } from 'vue';

import { SAMPLE_WORKFLOWS_NOW, sampleStoredWorkflows } from '@/testing/sampleWorkflows.js';

import { previewPatternEdit } from './buildWorkflowAlerts.js';
import type { PatternEditPreview } from './buildWorkflowAlerts.js';
import WorkflowPatternEditor from './WorkflowPatternEditor.vue';

/**
 * The design's fitloop/webapp (actions W7): Deploy broken on main and passed on the branch v2-experiment, Release
 * failed on the tag v0.1.0-rc.3 after passing on rc.1 and rc.2, Nightly e2e failing on staging.
 */
const WORKFLOWS = sampleStoredWorkflows({
    nameWithOwner: 'fitloop/webapp',
    workflows: [
        {
            id: 1,
            name: 'Deploy',
            runs: [
                { conclusion: 'success', ago: '1d', branch: 'v2-experiment' },
                { conclusion: 'success', ago: '20h' },
                { conclusion: 'failure', ago: '2h' },
            ],
        },
        {
            id: 2,
            name: 'Release',
            runs: [
                { conclusion: 'success', ago: '3d', branch: 'v0.1.0-rc.1' },
                { conclusion: 'success', ago: '2d', branch: 'v0.1.0-rc.2' },
                { conclusion: 'failure', ago: '6h', branch: 'v0.1.0-rc.3' },
            ],
        },
        { id: 3, name: 'Nightly e2e', runs: [{ conclusion: 'failure', ago: '5h', branch: 'staging' }] },
    ],
});

const meta = {
    component: WorkflowPatternEditor,
    args: {
        mode: 'add',
        modelValue: '',
        preview: { kind: 'empty' },
        read: true,
        now: SAMPLE_WORKFLOWS_NOW,
        'onUpdate:modelValue': fn(),
        onSave: fn(),
        onCancel: fn(),
    },
    // As wide as the card in a repository's settings.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () => h('div', { style: { width: '640px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof WorkflowPatternEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W7: the add field, idle: the placeholder and A. */
export const AddIdle: Story = {};

/** Focused with nothing typed: the syntax and the keys, no preview yet. */
export const AddFocused: Story = {
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('textbox'));
    },
};

/** W11: `v*` being added: it would alert on a branch and three tags, flagged, and Release turns broken. */
export const AddTurnsBroken: Story = { args: adding('v*') };

/** More refs match than the preview has room for: "+n". */
export const AddMoreThanLimit: Story = { args: adding('*') };

/** W11: `release/*` matches no ref githq has seen a run on. */
export const AddMatchingNothing: Story = { args: adding('release/*') };

/** W11: a pattern already listed says so. */
export const AddDuplicate: Story = { args: adding('v*', ['v*']) };

/** W10: nothing read of the repository: matches show later, and nothing changes that is known. */
export const AddNotRead: Story = {
    args: {
        mode: 'add',
        modelValue: 'v*',
        read: false,
        preview: previewPatternEdit({
            stored: undefined,
            settings: { defaultBranch: true, refs: [] },
            index: null,
            value: 'v*',
        }),
    },
};

/** W12: a pattern opened in place, as it is: focused, its preview says the counters don't change. */
export const EditUnchanged: Story = { args: editing('v*', 'v*', ['v*']) };

/** W12: everything typed away: the field and its keys, no preview. */
export const EditEmpty: Story = { args: editing('v*', '', ['v*']) };

/** W12: `v*` changed to `v0.*`: Release stays broken, so the counters don't change, and the branch stops counting. */
export const EditStaysBroken: Story = { args: editing('v*', 'v0.*', ['v*']) };

/** W12: `v*` changed to `release/*`: Release no longer counts as broken, and its refs are no longer counted. */
export const EditStopsCounting: Story = { args: editing('v*', 'release/*', ['v*']) };

/** W12: `v*` changed to `staging`: one workflow turns broken, another no longer counts, and its refs stop counting. */
export const EditEveryEffect: Story = { args: editing('v*', 'staging', ['v*']) };

/** A workflow turning broken whose failure names no ref: no "where" nor "when". */
export const EditTurnsBrokenNoRef: Story = {
    args: {
        mode: 'edit',
        modelValue: 'v*',
        preview: {
            ...withPreview(editing('v*', 'v*', ['v*']).preview),
            turnBroken: [{ workflow: 'Release', ref: null, at: null }],
            staysBroken: [],
        },
    },
};

/** W12: changed to another pattern already listed: it says so. */
export const EditDuplicate: Story = { args: editing('v*', 'release/*', ['v*', 'release/*']) };

function adding(value: string, refs: readonly string[] = []) {
    return {
        mode: 'add' as const,
        modelValue: value,
        preview: previewPatternEdit({ stored: WORKFLOWS, settings: { defaultBranch: true, refs }, index: null, value }),
    };
}

function editing(pattern: string, value: string, refs: readonly string[]) {
    return {
        mode: 'edit' as const,
        modelValue: value,
        preview: previewPatternEdit({
            stored: WORKFLOWS,
            settings: { defaultBranch: true, refs },
            index: refs.indexOf(pattern),
            value,
        }),
    };
}

function withPreview(preview: PatternEditPreview) {
    if (preview.kind !== 'preview') {
        throw new Error(`Expected a preview, got ${preview.kind}`);
    }

    return preview;
}
