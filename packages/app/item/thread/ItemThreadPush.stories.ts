import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { F5_PULL_REQUEST_DETAIL } from '@/testing/sampleThreadEvents.js';

import { buildThread } from './buildThread.js';
import type { ThreadPush } from './buildThread.js';
import ItemThreadPush from './ItemThreadPush.vue';

/** The thread's width in a panel. */
const IN_PANEL = 512;

const [SIX_COMMITS, THREE_COMMITS] = buildThread({ detail: F5_PULL_REQUEST_DETAIL }).filter(
    (entry): entry is ThreadPush => entry.kind === 'push',
);

const meta = {
    component: ItemThreadPush,
    args: { push: THREE_COMMITS!, now: SAMPLE_NOW },
    // On an item view's background, as wide as the thread, with the rail behind the badge.
    render: args => ({
        components: { ItemThreadPush },
        setup: () => ({ args }),
        template: `
          <div style="position: relative; width: ${IN_PANEL}px; padding: 20px 0; background: #11161c">
            <div style="position: absolute; inset: 0 auto 0 55px; width: 2px; background: #2f353d" />
            <div style="position: relative"><ItemThreadPush v-bind="args" /></div>
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadPush>;

export default meta;

type Story = StoryObj<typeof meta>;

/** F5's newest push: three commits, the newest one's checks failed. */
export const ThreeCommits: Story = {};

/** F5's first push: three of its six commits, then "Show 3 more commits". */
export const SixCommits: Story = { args: { push: SIX_COMMITS! } };

/** Commits whose author's email belongs to no GitHub account: the name git records, no avatar. */
export const NoAccount: Story = {
    args: { push: { ...THREE_COMMITS!, actor: null, authorName: 'Maja Laine' } },
};
