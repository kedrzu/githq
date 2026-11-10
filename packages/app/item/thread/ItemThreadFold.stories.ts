import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import ItemThreadFold from './ItemThreadFold.vue';

/** The thread's width in a panel: the band on two lines. */
const IN_PANEL = 512;
/** The reading width a page keeps its main column to: the band on one line. */
const ON_PAGE = { width: 760 };

const meta = {
    component: ItemThreadFold,
    args: { commits: 10, comments: 3, otherEvents: 5, onClick: fn() },
    // On an item view's background, as wide as the thread (`parameters.width`).
    render: (args, { parameters }) => ({
        components: { ItemThreadFold },
        setup: () => ({ args }),
        template: `
          <div style="width: ${parameters.width ?? IN_PANEL}px; padding: 20px 0; background: #11161c">
            <ItemThreadFold v-bind="args" />
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadFold>;

export default meta;

type Story = StoryObj<typeof meta>;

/** F5: on a page, "Show 18 earlier events", what is folded by group and the chevron on one line. */
export const OnPage: Story = { parameters: ON_PAGE };

/** F9: in the side panel, the band on two lines: what is folded under "Show …". */
export const InPanel: Story = {};

/** Only comments and one other event folded: the groups with none left out, the singular. */
export const CommentsOnly: Story = { args: { commits: 0, comments: 2, otherEvents: 1 } };

/** Reading them failed: the band says so in place of the groups, and reads again. */
export const Failed: Story = { args: { failed: true } };

/** Clicked: busy while the earlier comments are read (here, never). */
export const Busy: Story = {
    args: { onClick: () => new Promise<void>(() => {}) },
    play: async ({ canvasElement }) => {
        const band = within(canvasElement).getByRole('button', {
            name: /Show 18 earlier events/,
        });
        await userEvent.click(band);
        await expect(band).toHaveAttribute('aria-busy', 'true');
    },
};
