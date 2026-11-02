import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertValue } from '@nzyme/utils/assert.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import { SAMPLE_WORKFLOWS_NOW, sampleWorkflowRuns } from '@/testing/sampleWorkflows.js';
import type { SampleRun } from '@/testing/sampleWorkflows.js';

import WorkflowRunLine from './WorkflowRunLine.vue';
import type { WorkflowRowRef } from './WorkflowTypes.js';

const MAIN: WorkflowRowRef = { name: 'main', kind: 'branch' };
const TOKENS: WorkflowRowRef = { name: 'sofiab/tokens', kind: 'branch' };
const TAG: WorkflowRowRef = { name: 'v0.1.0', kind: 'tag' };

const meta = {
    component: WorkflowRunLine,
    args: {
        run: sampleRun({ conclusion: 'success', ago: '14m', title: 'Bump vite to 7.1.7', seconds: 192 }),
        gitRef: MAIN,
        now: SAMPLE_WORKFLOWS_NOW,
        onOpen: fn(),
    },
    // As wide as the list of the design's screens.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () => h('div', { style: { width: '960px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof WorkflowRunLine>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Passed, and how long it took. */
export const Passed: Story = {};

/** Failed, on a branch a pull request started it on. */
export const Failed: Story = {
    args: {
        run: sampleRun({
            conclusion: 'failure',
            ago: '1h',
            branch: 'sofiab/tokens',
            event: 'pull_request',
            title: 'Move design tokens into the ui package',
            seconds: 242,
        }),
        gitRef: TOKENS,
    },
};

/** Finished, read without its times: no duration. */
export const DurationNotKnown: Story = {
    args: { run: sampleRun({ conclusion: 'success', ago: '14m', title: 'Bump vite to 7.1.7' }) },
};

/** Still going: how long it has been going. */
export const Running: Story = {
    args: {
        run: sampleRun({ conclusion: null, ago: '1m', title: 'Show the waiting list on the class page', seconds: 0 }),
    },
};

/** Going, read without its start: its status. */
export const RunningStartNotKnown: Story = {
    args: { run: sampleRun({ conclusion: null, ago: '1m', title: 'Show the waiting list on the class page' }) },
};

/** Not started yet: its status. */
export const Queued: Story = {
    args: {
        run: {
            ...sampleRun({ conclusion: null, ago: '1m', title: 'Show the waiting list on the class page' }),
            status: 'queued',
        },
    },
};

/** Says nothing, cancelled: its conclusion instead of a duration. */
export const Cancelled: Story = {
    args: {
        run: sampleRun({
            conclusion: 'cancelled',
            ago: '2h',
            branch: 'chore/probe-target',
            event: 'workflow_dispatch',
            title: 'Try a second probe target',
        }),
        gitRef: { name: 'chore/probe-target', kind: 'branch' },
    },
};

/** Finished with no conclusion at all: nothing at its end. */
export const NoConclusion: Story = {
    args: {
        run: {
            ...sampleRun({ conclusion: null, ago: '2h', title: 'Try a second probe target' }),
            status: 'completed',
        },
    },
};

/** On a tag, older than a day: its day rather than its age. */
export const OnTagDaysAgo: Story = {
    args: {
        run: sampleRun({ conclusion: 'success', ago: '2d', branch: 'v0.1.0', title: 'Release v0.1.0', seconds: 205 }),
        gitRef: TAG,
    },
};

/** GitHub names no ref for it. */
export const NoRef: Story = {
    args: {
        run: {
            ...sampleRun({ conclusion: 'success', ago: '14m', title: 'Bump vite to 7.1.7', seconds: 192 }),
            headBranch: null,
        },
        gitRef: null,
    },
};

/** Without a title. */
export const NoTitle: Story = { args: { run: sampleRun({ conclusion: 'success', ago: '14m', seconds: 192 }) } };

/** Its ref and title longer than their places: cut short. */
export const CutShort: Story = {
    args: {
        run: sampleRun({
            conclusion: 'failure',
            ago: '1h',
            branch: 'dependabot/npm_and_yarn/packages/app/vite-7.1.7',
            title: 'Add a stale-while-revalidate cache to the API client and move every read of the class page onto it',
            seconds: 242,
        }),
        gitRef: { name: 'dependabot/npm_and_yarn/packages/app/vite-7.1.7', kind: 'branch' },
    },
};

/** The line the tab's selection is on. */
export const Selected: Story = { args: { selected: true } };

/** Selected and failed: the red mark on the selection's ground. */
export const SelectedFailed: Story = { args: { ...Failed.args, selected: true } };

function sampleRun(run: SampleRun): GitHubWorkflowRun {
    return assertValue(sampleWorkflowRuns({ id: 5, name: 'Probe', runs: [run] })[0]);
}
