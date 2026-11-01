import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, within } from 'storybook/test';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import { describeStackShare } from '@/store/stacks/describeStackShare.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_STACKS, sampleListStack } from '@/testing/sampleStacks.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import ItemCard from './ItemCard.vue';
import { ITEM_PROPERTIES } from './ItemProperty.js';
import type { ListStack } from './ListTypes.js';
import StackCard from './StackCard.vue';

/** The first two of SP26's stack of four, alone in a column: both ready, "#1206" blocking further on. */
const SHARE = sampleShare(SAMPLE_STACKS.held, 2);

const meta = {
    component: StackCard,
    args: {
        stack: SHARE,
        properties: ITEM_PROPERTIES,
        now: SAMPLE_NOW,
        onToggle: fn(),
        onOpen: fn(),
    },
    // As wide as a board's column, in a card as the board draws it.
    render: args => ({
        components: { StackCard },
        setup: () => ({ args }),
        template: `<div style="width: 268px; background: #1a1d22; border: 1px solid #22262d; border-radius: 8px">
            <StackCard v-bind="args" />
        </div>`,
    }),
} satisfies Meta<typeof StackCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * SP27: a share of a stack on a board — the stack icon, the repository and "2 of 4", the people and the chevron; the
 * name; the share's pips filled, the others hollow, and how it stands.
 */
export const Share: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText(/2 of 4/)).toBeVisible();
        await expect(canvas.getByText('Both ready')).toBeVisible();
        await expect(canvas.getByRole('button', { name: 'Expand the stack' })).toBeVisible();
    },
};

/** The whole stack in one column: its count and the stack's sentence. */
export const WholeStack: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.held) } };

/**
 * SP26's "In review" card: expanded, its pull requests listed inside it, each in its own state, the one selected in it
 * highlighted; a click on one opens it.
 */
export const Expanded: Story = {
    args: { expanded: true, selectedMember: SAMPLE_STACKS.held[1]?.id ?? null },
    play: async ({ args, canvasElement, userEvent }) => {
        const canvas = within(canvasElement);
        const second = canvas.getByRole('button', { name: /#1205/ });
        await expect(second).toHaveAttribute('aria-current', 'true');
        await userEvent.click(canvas.getByRole('button', { name: /#1204/ }));
        await expect(args.onOpen).toHaveBeenCalledWith(SAMPLE_STACKS.held[0]?.id);
    },
};

/** All its pull requests are among the items edited together (`x`, D20). */
export const Checked: Story = { args: { checked: true } };

/** In a repository's board: the repository is the list's, so the card leaves it out. */
export const InItsRepository: Story = { args: { repository: 'fitloop/webapp' } };

/** SP27's second card, SP26's mobile#94: a pull request alone in its column, an ordinary card with the marker "1 of 3". */
export const LoneCard: Story = {
    render: () => ({
        components: { ItemCard },
        setup: () => ({
            item: SAMPLE_STACKS.needsRebase[0],
            stack: sampleListStack(SAMPLE_STACKS.needsRebase).description,
            properties: ITEM_PROPERTIES,
            now: SAMPLE_NOW,
            viewerLogin: SAMPLE_VIEWER.login,
        }),
        template: `<div style="width: 268px; background: #1a1d22; border: 1px solid #22262d; border-radius: 8px">
            <ItemCard :item="item" :stack="stack" :properties="properties" :now="now" :viewer-login="viewerLogin" people="assignees" />
        </div>`,
    }),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByLabelText('In a stack')).toBeVisible();
        await expect(canvas.getByText('1 of 3')).toBeVisible();
    },
};

/** The entry a board's column folds of the first `count` pull requests of a stack: a share of its open ones (D16). */
function sampleShare(members: readonly PullRequestItem[], count: number): ListStack {
    const whole = sampleListStack(members);
    const pullRequests = members.slice(0, count);
    return { ...whole, pullRequests, share: describeStackShare(whole.description, pullRequests) };
}
