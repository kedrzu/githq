import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { GLYPHS_STACK, sampleStackDescription, SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import StackMap from './StackMap.vue';

const TWO = sampleStackDescription(GLYPHS_STACK);
const TEN = sampleStackDescription(SYNC_ENGINE_STACK);

const meta = {
    component: StackMap,
    args: {
        stack: TWO,
        currentId: GLYPHS_STACK[1]?.id ?? '',
        neighbours: { previous: GLYPHS_STACK[0]?.id ?? null, next: null },
        arrangement: 'panel',
        folded: false,
        onOpen: fn(),
        onUnfold: fn(),
    },
    // As wide as the place it takes: the panel's 560px, the modal's side column, the page's left column.
    render: args => ({
        components: { StackMap },
        setup: () => ({ args }),
        template: `<div :style="{ width: args.arrangement === 'panel' ? '560px' : '320px', height: args.arrangement === 'page' ? '600px' : 'auto', display: 'flex', background: '#16181c' }"><StackMap v-bind="args" style="flex: 1" /></div>`,
    }),
} satisfies Meta<typeof StackMap>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP30: a stack of two in a panel — two rows with their state in words, `K` on the first, and what stops it. */
export const PanelTwo: Story = {};

/**
 * SP31: a stack of ten in a panel, the sixth open — a window of six lines: four earlier folded, one before, this one, two
 * after, two later folded.
 */
export const PanelTen: Story = {
    args: {
        stack: TEN,
        currentId: SYNC_ENGINE_STACK[5]?.id ?? '',
        neighbours: { previous: SYNC_ENGINE_STACK[4]?.id ?? null, next: SYNC_ENGINE_STACK[6]?.id ?? null },
    },
};

/** SP32: the panel's content scrolled — the map folded to one line: pips, "6 of 10", "#65 blocks 4 later", `#64 K J #66`. */
export const PanelFolded: Story = { args: { ...PanelTen.args, folded: true } };

/** SP33: a stack of two at the top of a modal's side column — the icons carry each state. */
export const ModalTwo: Story = { args: { arrangement: 'modal' } };

/** SP34: a stack of ten in a modal — whole, no window. */
export const ModalTen: Story = { args: { ...PanelTen.args, arrangement: 'modal' } };

/** SP35: a stack of two in a page's left column, as tall as the page. */
export const PageTwo: Story = { args: { arrangement: 'page' } };

/** SP36: a stack of ten in a page's left column, whole. */
export const PageTen: Story = { args: { ...PanelTen.args, arrangement: 'page' } };
