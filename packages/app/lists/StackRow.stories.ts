import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_STACKS, sampleListStack } from '@/testing/sampleStacks.js';

import { ITEM_PROPERTIES } from './ItemProperty.js';
import StackRow from './StackRow.vue';

const meta = {
    component: StackRow,
    args: {
        stack: sampleListStack(SAMPLE_STACKS.ready),
        properties: ITEM_PROPERTIES,
        now: SAMPLE_NOW,
    },
} satisfies Meta<typeof StackRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP14 "Ready": every open pull request can merge — green pips, "All 3 ready"; the label and the person all share. */
export const Ready: Story = {};

/**
 * SP14 "Held", SP12: the third fails its checks and blocks the fourth, which reads grey on its own pip; three people,
 * the label all share with "+1", two milestones, the size summed.
 */
export const Held: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.held) } };

/** SP14 "Partly merged": the first landed — a purple pip — and the next one's checks run again. */
export const PartlyMerged: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.partlyMerged) } };

/** SP14, D21: a later pull request is behind its base — amber, "Needs rebase · nothing can merge". */
export const NeedsRebase: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.needsRebase) } };

/** SP14 "Mid-stack pull request closed": a hollow red pip, the two after it stuck. */
export const ClosedInside: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.closedInside) } };

/** SP14 "Draft inside": the draft holds back the next one, and says so in grey. */
export const DraftInside: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.draftInside) } };

/** SP14, D7: the copy holds two of four — pale hollow pips for the others, never "ready". */
export const Incomplete: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.incomplete) } };

/** Every pull request landed. */
export const Merged: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.merged) } };

/** SP14: someone else's stack asking the user's review on two of its four. */
export const ReviewRequested: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.reviewRequested) } };

/** In a repository's list (SP23): the repository is the list's, so the entry leaves it out. */
export const InItsRepository: Story = { args: { repository: 'mlaine/tasklet' } };

/** All its pull requests are among the items edited together (`x`, D20). */
export const Checked: Story = { args: { checked: true } };
