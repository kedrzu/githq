import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import { sampleRepositoryWorkflows, SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';
import type { SampleWorkflowParams } from '@/testing/sampleWorkflows.js';

import { buildBrokenWorkflows } from './buildBrokenWorkflows.js';
import BrokenWorkflowsView from './BrokenWorkflowsView.vue';

const PROBE: SampleWorkflowParams = {
    id: 10,
    name: 'Probe',
    runs: [
        { conclusion: 'success', ago: '2h' },
        { conclusion: 'success', ago: '11m' },
    ],
};

const DEPLOY: SampleWorkflowParams = {
    id: 1,
    name: 'Deploy',
    runs: [
        { conclusion: 'success', ago: '30h' },
        { conclusion: 'success', ago: '20h' },
        { conclusion: 'failure', ago: '3h' },
        { conclusion: 'failure', ago: '1h' },
        { conclusion: 'failure', ago: '14m' },
    ],
};

const CI: SampleWorkflowParams = {
    id: 2,
    name: 'CI',
    runs: [
        { conclusion: 'success', ago: '5h' },
        { conclusion: 'failure', ago: '40m' },
    ],
};

const RELEASE: SampleWorkflowParams = {
    id: 3,
    name: 'Release',
    runs: [
        { conclusion: 'success', ago: '9d', branch: 'v0.1.0' },
        { conclusion: 'failure', ago: '4d', branch: 'v0.2.0-rc.1' },
        { conclusion: 'failure', ago: '3d', branch: 'v0.2.0-rc.3' },
    ],
};

const NIGHTLY: SampleWorkflowParams = {
    id: 4,
    name: 'Nightly',
    runs: [
        { conclusion: 'failure', ago: '4d' },
        { conclusion: 'failure', ago: '3d' },
        { conclusion: 'failure', ago: '2d' },
        { conclusion: 'failure', ago: '23h' },
        { conclusion: null, ago: '2m' },
    ],
};

const DEPENDABOT: SampleWorkflowParams = {
    id: 5,
    name: 'Dependabot Updates',
    path: 'dynamic/dependabot/dependabot-updates',
    runs: [
        { conclusion: 'failure', ago: '22d' },
        { conclusion: 'failure', ago: '8d' },
    ],
};

const meta = {
    component: BrokenWorkflowsView,
    args: {
        now: SAMPLE_WORKFLOWS_NOW,
        checkedAt: SAMPLE_WORKFLOWS_NOW - 40_000,
        broken: buildBrokenWorkflows([
            sampleRepositoryWorkflows({ nameWithOwner: 'mlaine/tasklet', workflows: [PROBE] }),
            sampleRepositoryWorkflows({ nameWithOwner: 'mlaine/mdlint', workflows: [NIGHTLY] }),
            sampleRepositoryWorkflows({ nameWithOwner: 'fitloop/webapp', workflows: [DEPLOY, RELEASE, PROBE] }),
            sampleRepositoryWorkflows({ nameWithOwner: 'fitloop/api', workflows: [CI, DEPENDABOT] }),
        ]),
        onOpen: fn(),
    },
    // As the screen sits beside the sidebar.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () =>
                    h('div', { style: { display: 'flex', width: '1000px', height: '600px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof BrokenWorkflowsView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W2: broken in three of four repositories — two breaks under a day old, three older. */
export const Everything: Story = {};

/** W2c: two repositories still being read, one with Actions off — the total is "1 so far", ghost rows below. */
export const PartlyKnown: Story = {
    args: {
        broken: buildBrokenWorkflows([
            sampleRepositoryWorkflows({ nameWithOwner: 'mlaine/tasklet', unread: true }),
            sampleRepositoryWorkflows({ nameWithOwner: 'mlaine/mdlint', workflows: [NIGHTLY] }),
            sampleRepositoryWorkflows({ nameWithOwner: 'fitloop/webapp', unread: true }),
            sampleRepositoryWorkflows({
                nameWithOwner: 'fitloop/api',
                unavailable: { reason: 'disabled', status: 404 },
            }),
        ]),
    },
};

/** Nothing read yet: no zero, nothing claimed healthy, ghost rows with the repository's column (ES28). */
export const NotKnownYet: Story = {
    args: {
        broken: buildBrokenWorkflows([
            sampleRepositoryWorkflows({ nameWithOwner: 'mlaine/tasklet', unread: true }),
            sampleRepositoryWorkflows({ nameWithOwner: 'fitloop/webapp', unread: true }),
        ]),
    },
};

/** W2b: everything read, nothing broken — all green; GitHub refused one repository's workflows. */
export const NothingBroken: Story = {
    args: {
        broken: buildBrokenWorkflows([
            sampleRepositoryWorkflows({ nameWithOwner: 'mlaine/tasklet', workflows: [PROBE] }),
            sampleRepositoryWorkflows({ nameWithOwner: 'mlaine/mdlint', workflows: [PROBE] }),
            sampleRepositoryWorkflows({ nameWithOwner: 'fitloop/webapp', workflows: [PROBE] }),
            sampleRepositoryWorkflows({ nameWithOwner: 'fitloop/api' }),
        ]),
    },
};

/** Nothing broken, and GitHub refused one repository's workflows: it stays out of the green, which says 1 of 2. */
export const NothingBrokenOneRefused: Story = {
    args: {
        broken: buildBrokenWorkflows([
            sampleRepositoryWorkflows({ nameWithOwner: 'mlaine/tasklet', workflows: [PROBE] }),
            sampleRepositoryWorkflows({
                nameWithOwner: 'fitloop/api',
                unavailable: { reason: 'refused', status: 403 },
            }),
        ]),
    },
};

/** No repository tracked. */
export const NothingTracked: Story = { args: { broken: buildBrokenWorkflows([]) } };
