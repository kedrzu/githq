import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { getItemReference, getReviewPath } from '@/item/itemRoutes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { GLYPHS_STACK, sampleStackDescription, SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import StackPlaces from './StackPlaces.vue';

const meta = {
    component: StackPlaces,
    args: { onOpen: fn() },
    render: args => ({
        components: { StackPlaces },
        setup: () => ({ args }),
        template: `<div style="display: flex; width: 160px; height: 36px; padding: 0 8px"><StackPlaces v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof StackPlaces>;

export default meta;

type Story = StoryObj<typeof meta>;

const DRAFT = { id: 'PRR_1', commentCount: 3, createdAt: '2026-11-01T10:00:00Z' };
const WITH_DRAFT = GLYPHS_STACK.map(pr => ({ ...pr, pendingReview: DRAFT }));

function getPath(pullRequest: PullRequestItem) {
    return getReviewPath(getItemReference(pullRequest));
}

/** Without a path, a square is a button asking to open its pull request; the open one outlined with its mark. */
export const Buttons: Story = {
    args: { pips: sampleStackDescription(GLYPHS_STACK).pips, currentId: GLYPHS_STACK[1]!.id },
    play: async ({ args, canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.queryAllByRole('link')).toHaveLength(0);
        const current = canvas.getByRole('button', { name: /^2: #41 Use the glyphs in the palette$/ });
        await expect(current).toHaveAttribute('aria-current', 'true');
        await userEvent.click(canvas.getByRole('button', { name: /^1: / }));
        await expect(args.onOpen).toHaveBeenCalledWith(GLYPHS_STACK[0]!.id);
    },
};

/** Given a path, a square is a link to it, replacing the address (D2). */
export const Links: Story = {
    args: { pips: sampleStackDescription(GLYPHS_STACK).pips, currentId: GLYPHS_STACK[1]!.id, getPath },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.queryAllByRole('button')).toHaveLength(0);
        const links = canvas.getAllByRole('link');
        await expect(links).toHaveLength(2);
        await expect(links[0]).toHaveAttribute('href', getPath(GLYPHS_STACK[0]!));
        await expect(links[1]).toHaveAttribute('aria-current', 'true');
    },
};

/** `Stack bar / Place · soft, draft` and `· soft, current, draft`: an amber dot on the corner, said in the name. */
export const WithDrafts: Story = {
    args: { pips: sampleStackDescription(WITH_DRAFT).pips, currentId: WITH_DRAFT[1]!.id },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getAllByRole('button', { name: /, your draft review$/ })).toHaveLength(2);
    },
};

/** A place the copy doesn't hold yet: a hollow square going nowhere (stacked PRs D7). */
export const WithMissingPlace: Story = {
    args: {
        pips: [{ kind: 'missing', position: 1 }, ...sampleStackDescription(GLYPHS_STACK).pips],
        currentId: GLYPHS_STACK[0]!.id,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
        await expect(canvas.getAllByRole('button')).toHaveLength(2);
    },
};

/** A stack of ten, too long for the room: the squares scroll sideways, the open one brought into view. */
export const Long: Story = {
    args: { pips: sampleStackDescription(SYNC_ENGINE_STACK).pips, currentId: SYNC_ENGINE_STACK[8]!.id },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const places = canvas.getByRole('list');
        await expect(places.scrollWidth).toBeGreaterThan(places.clientWidth);
        await expect(places.scrollLeft).toBeGreaterThan(0);
        await expectInView(places, canvas.getByRole('button', { name: /^9: / }));
    },
};

/** The square lies whole inside the visible part of the row. */
async function expectInView(places: HTMLElement, square: HTMLElement) {
    const row = places.getBoundingClientRect();
    const box = square.getBoundingClientRect();
    await expect(box.left).toBeGreaterThanOrEqual(row.left);
    await expect(box.right).toBeLessThanOrEqual(row.right);
}
