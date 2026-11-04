import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { SAMPLE_WORKFLOWS } from '@/testing/sampleWorkflows.js';
import type { WorkflowState } from '@/workflows/WorkflowTypes.js';

import RunStrip from './RunStrip.vue';

const meta = {
    component: RunStrip,
    args: stripOf(SAMPLE_WORKFLOWS.deploy),
} satisfies Meta<typeof RunStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Broke three runs ago and still failing, less than a day: tall bright red ticks. */
export const BrokenNew: Story = {};

/** Broken for days: quiet red; the cancelled run in the middle is a dash and changes nothing. */
export const BrokenOld: Story = { args: stripOf(SAMPLE_WORKFLOWS.release) };

/** Failing for long, and a new run going: a hollow amber tick at the right. */
export const RunningAfterFailures: Story = { args: stripOf(SAMPLE_WORKFLOWS.nightly) };

/** Passing: short grey ticks, so a wall of passes stays quiet. */
export const Passing: Story = { args: stripOf(SAMPLE_WORKFLOWS.probe) };

/** A cancelled run among passes: a dash, no verdict. */
export const Cancelled: Story = { args: stripOf(SAMPLE_WORKFLOWS.test) };

/** Fewer than five runs known: hairlines on the left, the latest still in the rightmost slot. */
export const FewerRuns: Story = { args: stripOf(SAMPLE_WORKFLOWS.lint) };

/** No run known: five hairlines. */
export const NoRuns: Story = { args: stripOf(SAMPLE_WORKFLOWS.codeql) };

/** What a row hands the strip: failures of a break younger than a day are news. */
function stripOf(workflow: WorkflowState) {
    return {
        runs: workflow.lastRuns,
        newSince: workflow.isNew ? workflow.breakStartedAt : null,
    };
}
