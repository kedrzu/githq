import { assertValue } from '@nzyme/utils/assert.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import { SAMPLE_WORKFLOWS_NOW, sampleStoredWorkflows } from '@/testing/sampleWorkflows.js';

import { buildWorkflowAlerts } from './buildWorkflowAlerts.js';
import WorkflowPatternChip from './WorkflowPatternChip.vue';
import WorkflowPatternMatches from './WorkflowPatternMatches.vue';
import type { RepositoryWorkflows } from './WorkflowTypes.js';

/** The branches `main`, `v2-experiment` and `staging`, and three release candidates' tags. */
const WORKFLOWS = assertValue(
    sampleStoredWorkflows({
        nameWithOwner: 'fitloop/webapp',
        workflows: [
            {
                id: 1,
                name: 'Deploy',
                runs: [
                    { conclusion: 'success', ago: '1d', branch: 'v2-experiment' },
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
    }),
);
/** Two branches and one tag `v*` catches. */
const MOSTLY_BRANCHES = assertValue(
    sampleStoredWorkflows({
        nameWithOwner: 'fitloop/webapp',
        workflows: [
            {
                id: 1,
                name: 'Deploy',
                runs: [
                    { conclusion: 'success', ago: '2d', branch: 'v2-experiment' },
                    { conclusion: 'success', ago: '1d', branch: 'v3-experiment' },
                    { conclusion: 'success', ago: '6h', branch: 'v0.1.0' },
                ],
            },
        ],
    }),
);

const meta = {
    component: WorkflowPatternMatches,
    args: { matches: sampleMatches('v0.*'), read: true, limit: 4 },
    // As wide as a pattern's row.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () => h('div', { style: { width: '640px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof WorkflowPatternMatches>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Tags alone, and the workflow that ran on them. */
export const Tags: Story = {};

/** One branch: the workflow runs on "it". */
export const OneRef: Story = { args: { matches: sampleMatches('staging') } };

/** Several workflows ran on the refs. */
export const SeveralWorkflows: Story = { args: { matches: sampleMatches('*'), limit: 6 } };

/** W7: both kinds, the fewer of them a branch: an amber flag says so. */
export const FlaggedBranch: Story = { args: { matches: sampleMatches('v*') } };

/** Both kinds, the fewer of them a tag. */
export const FlaggedTag: Story = { args: { matches: sampleMatches('v*', MOSTLY_BRANCHES) } };

/** More refs than `limit`: "+n" for the rest. */
export const MoreThanLimit: Story = { args: { matches: sampleMatches('v*'), limit: 2 } };

/** W8: no ref githq has seen a run on matches, without calling the pattern wrong. */
export const MatchingNothing: Story = { args: { matches: sampleMatches('release/*') } };

/** W10: before the first read, matches show later. */
export const NotRead: Story = { args: { matches: sampleMatches('v*', null), read: false } };

/** On a pattern's row: the pattern leads the chips' line. */
export const WithLead: Story = {
    args: { matches: sampleMatches('v*'), limit: 3 },
    render: args => ({
        components: { WorkflowPatternChip, WorkflowPatternMatches },
        setup: () => ({ args }),
        template:
            '<WorkflowPatternMatches v-bind="args"><template #lead><WorkflowPatternChip pattern="v*" /></template></WorkflowPatternMatches>',
    }),
};

function sampleMatches(pattern: string, stored: RepositoryWorkflows | null = WORKFLOWS) {
    const alerts = buildWorkflowAlerts({
        stored: stored ?? undefined,
        settings: { defaultBranch: true, refs: [pattern] },
        now: SAMPLE_WORKFLOWS_NOW,
    });
    return assertValue(alerts.patterns[0]).matches;
}
