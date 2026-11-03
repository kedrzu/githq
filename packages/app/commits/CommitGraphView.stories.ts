import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import { defineComponent, h, shallowRef } from 'vue';

import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import type { CommitGraphTestOptions } from '@/testing/createCommitGraphTest.js';
import { sampleCommit, sampleCommitRef, sampleHistory, sampleWebappHistory } from '@/testing/sampleCommits.js';

import CommitGraphView from './CommitGraphView.vue';

const NEVER = new Promise<void>(() => {});

const meta = {
    component: CommitGraphView,
    args: { nameWithOwner: 'acme/web' },
} satisfies Meta<typeof CommitGraphView>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * CH3, CH12: branches, a tag, merges, pull requests of every state and CI — a failure as a red dot and a red ✕, running
 * amber.
 */
export const Graph: Story = {
    render: () => renderOver(sampleWebappHistory()),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(await canvas.findByText("fix: booking time uses the studio's timezone")).toBeVisible();
        await expect(await canvas.findAllByRole('img', { name: 'Checks failing' })).toHaveLength(2);
        await expect(canvas.getByRole('img', { name: 'Draft pull request' })).toBeVisible();
        await expect(canvas.getByRole('img', { name: 'Closed pull request' })).toBeVisible();
        await expect(canvas.getByText("The beginning of acme/web's history")).toBeVisible();
    },
};

/** CH34: the rows are there, their pull request and CI not known yet — an empty bar in their place. */
export const NotKnownYet: Story = {
    render: () =>
        renderOver({ ...sampleWebappHistory(), holdIf: operation => (operation === 'CommitStates' ? NEVER : null) }),
    play: async ({ canvasElement }) => {
        const bars = await within(canvasElement).findAllByRole('img', {
            name: 'Pull request and checks not known yet',
        });
        await expect(bars).toHaveLength(9);
    },
};

/** CH35: scrolled past what is loaded, the next page on its way. */
export const LoadingOlder: Story = {
    render: () =>
        renderOver({
            commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['c0'])],
            branches: [sampleCommitRef('main', 'c2')],
            holdIf: operation => (operation === 'CommitHistories' ? NEVER : null),
        }),
    play: async ({ canvasElement }) => {
        await expect(await within(canvasElement).findByText('Loading older commits…')).toBeVisible();
    },
};

/** CH10: many branches side by side; past a tenth of the pane their lanes fold onto the last one (D17). */
export const ManyBranches: Story = {
    render: () =>
        renderOver({
            commits: sampleHistory({ count: 400, seed: 7 }),
            tags: [
                sampleCommitRef('v1.0.0', 'c399'),
                sampleCommitRef('v1.0.0-rc.1', 'c399'),
                sampleCommitRef('v1.0.0-rc.2', 'c399'),
            ],
        }),
    play: async ({ canvasElement }) => {
        // Four refs on the newest commit: three named, then "+1".
        await expect(await within(canvasElement).findByText('+1')).toBeVisible();
    },
};

/** CH38: the repository is empty on GitHub. */
export const Empty: Story = {
    render: () => renderOver({ commits: [], defaultBranch: null, firstOpen: true }),
    play: async ({ canvasElement }) => {
        await expect(await within(canvasElement).findByText('No commits yet')).toBeVisible();
    },
};

/** A first open, nothing kept yet: a quiet line until the first rows arrive (CH32). */
export const FirstOpen: Story = {
    render: () =>
        renderOver({
            commits: [],
            firstOpen: true,
            holdIf: operation => (operation === 'RepositoryCommitRefs' ? NEVER : null),
        }),
    play: async ({ canvasElement }) => {
        await expect(await within(canvasElement).findByText('Loading commits…')).toBeVisible();
    },
};

/** GitHub does not answer and nothing is kept: the section says so, instead of loading for good. */
export const Unavailable: Story = {
    render: () =>
        renderOver({
            commits: [],
            firstOpen: true,
            failIf: operation => operation === 'RepositoryCommitRefs',
        }),
    play: async ({ canvasElement }) => {
        const notice = "GitHub can't be asked for the commits right now. They appear here once it can.";
        await expect(await within(canvasElement).findByText(notice)).toBeVisible();
    },
};

/** The view over the real store and a GitHub holding `options`, at the sample's moment. */
function renderOver(options: CommitGraphTestOptions) {
    return defineComponent({
        setup() {
            const { container, ready } = createCommitGraphTest(options);
            provideContainer(container);
            const kept = shallowRef(false);
            const showOnceKept = async () => {
                await ready;
                kept.value = true;
            };
            void showOnceKept();
            return () =>
                h(
                    'div',
                    { style: 'display: flex; height: 100vh' },
                    kept.value ? [h(CommitGraphView, { nameWithOwner: 'acme/web' })] : [],
                );
        },
    });
}
