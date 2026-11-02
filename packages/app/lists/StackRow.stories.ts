import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { defineComponent, h } from 'vue';

import { MergeContext } from '@/merge/MergeContext.js';
import type { ItemProject } from '@/store/ItemTypes.js';
import { matchText } from '@/testing/matchText.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_STACKS, sampleListStack } from '@/testing/sampleStacks.js';

import { ITEM_PROPERTIES } from './ItemProperty.js';
import StackRow from './StackRow.vue';

/** The merge panel opened from the entry: for which pull request, and how. */
const openMerge = fn<MergeContext['open']>();

/** Under a screen that merges, the viewer allowed to (merging D9). */
const withMerging: Decorator = story =>
    defineComponent({
        setup() {
            provideContext(MergeContext, { canOpen: () => true, open: openMerge, getRecord: () => null });
            return () => h(story());
        },
    });

/** SP7: the merge of every pull request of the ready stack is on its way. */
const BEING_MERGED = SAMPLE_STACKS.ready.map(pr => ({ ...pr, merging: 'SQUASH' as const }));

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
export const Ready: Story = {
    play: async ({ canvasElement }) => {
        // Nothing opened over the list: no pip is tall (D14).
        await expect(getPipHeights(canvasElement)).toEqual([4, 4, 4]);
    },
};

/**
 * SP14 "Held", SP12: the third fails its checks and blocks the fourth, which reads grey on its own pip; three people,
 * the label all share with "+1", two milestones, the size summed.
 */
export const Held: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.held) },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('2 of 4 ready, #1206 blocks')).toBeVisible();
    },
};

/** SP23: the blocker's checks are running — amber, and the sentence says so. */
export const HeldByChecks: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.checksRunning) },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('1 of 2 ready, #1216 checks running')).toBeVisible();
    },
};

/** SP12: the blocker waits for a review — grey, and the sentence says so. */
export const HeldByReview: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.waitingForReview) },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('2 of 3 ready, #142 waiting for review')).toBeVisible();
    },
};

/** SP14 "Partly merged": the first landed — a purple pip — and the next one's checks run again. */
export const PartlyMerged: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.partlyMerged) } };

/** SP14, D21: a later pull request is behind its base — every pip amber, "Needs rebase · nothing can merge". */
export const NeedsRebase: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.needsRebase) } };

/** SP14 "Mid-stack pull request closed": a hollow red pip, the two after it stuck. */
export const ClosedInside: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.closedInside) } };

/** SP14 "Draft inside": the draft holds back the next one, and says so in grey. */
export const DraftInside: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.draftInside) },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('1 of 3 ready, #102 is a draft')).toBeVisible();
    },
};

/** SP14, D7: the copy holds two of four — its own pips pale, hollow ones for the others, never "ready". */
export const Incomplete: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.incomplete) } };

/** SP8: every pull request landed — purple pips, "Merged · all 3 landed". */
export const Merged: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.merged) },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('Merged · all 3 landed')).toBeVisible();
    },
};

/**
 * SP6: ready where the viewer may merge — "Merge" (`⇧M`) follows the state and opens the panel for the whole stack
 * (D11); the click is not the row's.
 */
export const Mergeable: Story = {
    decorators: [withMerging],
    play: async ({ canvasElement }) => {
        openMerge.mockClear();
        const merge = within(canvasElement).getByRole('button', { name: /Merge/u });
        await expect(merge).toHaveAttribute('aria-keyshortcuts', 'Shift+M');
        await userEvent.click(merge);
        await expect(openMerge).toHaveBeenCalledWith(SAMPLE_STACKS.ready[0]?.id, { wholeStack: true });
    },
};

/** SP8: needing a rebase, the same key hands off to github.com — "Rebase on GitHub" opens the panel, which says why. */
export const RebaseHandOff: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.needsRebase), selected: true },
    decorators: [withMerging],
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByRole('button', { name: matchText('Rebase on GitHub') })).toBeVisible();
    },
};

/** SP6, D21: not selected, a stack needing a rebase offers nothing — its state says it, and "Merge" stays for ready ones. */
export const RebaseNotSelected: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.needsRebase) },
    decorators: [withMerging],
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).queryByRole('button')).toBeNull();
    },
};

/**
 * SP7, SP14 "Being merged": every pull request going reads being merged — amber pips, "Being merged · 3 going · not
 * merged yet" — and nothing reads merged until GitHub confirms (merging D3); no merge is offered meanwhile.
 */
export const BeingMerged: Story = {
    args: { stack: sampleListStack(BEING_MERGED) },
    decorators: [withMerging],
    play: async ({ canvasElement }) => {
        const row = within(canvasElement);
        await expect(row.getByText('Being merged · 3 going · not merged yet')).toBeVisible();
        await expect(row.queryByText(/Merged/u)).toBeNull();
        await expect(row.queryByRole('button')).toBeNull();
    },
};

/** SP14: someone else's stack asking the user's review on two of its four. */
export const ReviewRequested: Story = { args: { stack: sampleListStack(SAMPLE_STACKS.reviewRequested) } };

/** In a repository's list (SP23): the repository is the list's, so the entry leaves it out. */
export const InItsRepository: Story = { args: { repository: 'mlaine/tasklet' } };

/** All its pull requests are among the items edited together (`x`, D20). */
export const Checked: Story = { args: { checked: true } };

/** SP28: some of its pull requests are among the items edited together, not all — a half mark. */
export const HalfChecked: Story = {
    args: { halfChecked: true },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByRole('img', { name: 'Partly selected' })).toBeVisible();
    },
};

/** D14: the second of its pull requests is opened over the list — its pip alone is tall. */
export const Opened: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.held), openedId: SAMPLE_STACKS.held[1]?.id ?? null },
    play: async ({ canvasElement }) => {
        await expect(getPipHeights(canvasElement)).toEqual([4, 10, 4, 4]);
    },
};

/** SP25: the list's filter matches one of its four pull requests — "1 of 4 matches". */
export const Filtered: Story = {
    args: {
        stack: {
            ...sampleListStack(SAMPLE_STACKS.held),
            unmatched: new Set(SAMPLE_STACKS.held.filter((_, index) => index !== 2).map(pr => pr.id)),
        },
    },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('1 of 4 matches')).toBeVisible();
    },
};

/** D15, githq D12: every pull request is "In review" in its first project — the entry shows the value they share. */
export const ProjectFieldShared: Story = {
    args: {
        stack: sampleListStack(
            SAMPLE_STACKS.ready.map(pr => ({ ...pr, projects: [sampleProject('Platform Q4', 'In review')] })),
        ),
    },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByTitle('Platform Q4: In review')).toHaveTextContent('In review');
    },
};

/** D15, as labels: the pull requests' first projects' row fields differ — the marker and "+N", the values on hover. */
export const ProjectFieldDiffers: Story = {
    args: {
        stack: sampleListStack(
            SAMPLE_STACKS.ready.map((pr, index) => ({
                ...pr,
                projects: [sampleProject('Platform Q4', index === 0 ? 'Done' : 'In review')],
            })),
        ),
    },
    play: async ({ canvasElement }) => {
        const field = within(canvasElement).getByTitle('Platform Q4: Done and Platform Q4: In review');
        await expect(field).toHaveTextContent('+2');
        await expect(field).not.toHaveTextContent('In review');
    },
};

function sampleProject(title: string, status: string): ItemProject {
    return {
        itemId: `PVTI_${title}`,
        projectId: `PVT_${title}`,
        title,
        number: 1,
        url: 'https://github.com/orgs/acme/projects/1',
        status: { name: status, color: 'YELLOW', optionId: null },
        updatedAt: '2026-10-29T10:00:00Z',
    };
}

/** The heights of the pips drawn, first to last. */
function getPipHeights(canvasElement: HTMLElement) {
    const pips = canvasElement.querySelector('[aria-hidden="true"]:has(> span)')?.children ?? [];
    return [...pips].map(pip => pip.getBoundingClientRect().height);
}
