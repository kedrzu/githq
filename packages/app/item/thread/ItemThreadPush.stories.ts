import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { F5_PULL_REQUEST_DETAIL } from '@/testing/sampleThreadEvents.js';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';
import { withReadingCursor } from '@/testing/withReadingCursor.js';

import { buildThread } from './buildThread.js';
import type { ThreadPush } from './buildThread.js';
import ItemThreadPush from './ItemThreadPush.vue';

/** The thread's width in a panel. */
const IN_PANEL = 512;
/** The widest the thread stretches: the one-column panel at its widest. */
const WIDEST = 1300;

const [SIX_COMMITS, THREE_COMMITS] = buildThread({ detail: F5_PULL_REQUEST_DETAIL }).filter(
    (entry): entry is ThreadPush => entry.kind === 'push',
);

const meta = {
    component: ItemThreadPush,
    args: { push: THREE_COMMITS!, now: SAMPLE_NOW },
    // On an item view's background, as wide as the thread (or `parameters.width`), with the rail behind the badge.
    render: (args, { parameters }) => ({
        components: { ItemThreadPush },
        setup: () => ({ args, width: parameters.width ?? IN_PANEL }),
        template: `
          <div :style="{ position: 'relative', width: width + 'px', padding: '20px 0', background: '#11161c' }" tid="frame">
            <div style="position: absolute; inset: 0 auto 0 55px; width: 2px; background: #2f353d" />
            <div style="position: relative"><ItemThreadPush v-bind="args" /></div>
          </div>`,
    }),
    // The desktop's, whatever the width; a phone's story says so.
    decorators: [withPhoneLayout(false)],
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

/** The thread at its widest: the time after "pushed 3 commits", the CI mark and hash after each message. */
export const Wide: Story = { parameters: { width: WIDEST } };

/** Mobile D11: on a phone, which doesn't show commits, each commit's hash ends in ↗ — it opens on github.com. */
export const OnPhone: Story = { decorators: [withPhoneLayout(true)], parameters: { width: 390 } };

/** `Activity / Commit · current`: the reading cursor on the newest commit, tinted a little past its edges. */
export const CurrentCommit: Story = {
    decorators: [withReadingCursor(`commit:${THREE_COMMITS!.commits.at(-1)!.abbreviatedOid}`)],
};
