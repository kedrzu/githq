import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, userEvent, within } from 'storybook/test';
import { defineComponent, h, shallowRef } from 'vue';

import { LocalPreferences } from '@/services/LocalPreferences.js';
import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import type { CommitGraphTestOptions } from '@/testing/createCommitGraphTest.js';
import {
    SAMPLE_COMMITS_NOW,
    sampleCommit,
    sampleCommitRef,
    sampleHistory,
    sampleWebappHistory,
} from '@/testing/sampleCommits.js';

import CommitDetails from './CommitDetails.vue';
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
        const canvas = within(await within(canvasElement).findByRole('region', { name: /^Commits of\s+acme\/web$/ }));
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
        const graph = await within(canvasElement).findByRole('region', { name: /^Commits of\s+acme\/web$/ });
        const bars = await within(graph).findAllByRole('img', { name: 'Pull request and checks not known yet' });
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

/** CH10: many branches side by side; past a tenth of the pane their lanes fold onto one thicker line (D17). */
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

/** CH11: the divider dragged past every lane: nothing folded, and it goes no further. */
export const DraggedWide: Story = {
    render: () => renderOver({ commits: sampleHistory({ count: 400, seed: 7 }) }, 0.5),
    play: async ({ canvasElement }) => {
        const divider = await within(canvasElement).findByRole('separator', { name: 'Resize the commit graph' });
        await expect(divider.getAttribute('aria-valuenow')).toBe(divider.getAttribute('aria-valuemax'));
    },
};

/** CH44: the divider dragged narrow: three lanes. */
export const DraggedNarrow: Story = {
    render: () => renderOver({ commits: sampleHistory({ count: 400, seed: 7 }) }, 52 / 1280),
    play: async ({ canvasElement }) => {
        const divider = await within(canvasElement).findByRole('separator', { name: 'Resize the commit graph' });
        await expect(Number(divider.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(3);
    },
};

/** CH45: being resized: the accent divider and how many lanes fit of how many. */
export const Resizing: Story = {
    render: () => renderOver({ commits: sampleHistory({ count: 400, seed: 7 }) }),
    play: async ({ canvasElement }) => {
        const divider = await within(canvasElement).findByRole('separator', { name: 'Resize the commit graph' });
        divider.focus();
        await userEvent.keyboard('{ArrowLeft}');
        await expect(divider).toHaveTextContent(/\d+ of \d+ lanes/);
    },
};

/** CH38: the repository is empty on GitHub. */
export const Empty: Story = {
    render: () => renderOver({ commits: [], defaultBranch: null, firstOpen: true }),
    play: async ({ canvasElement }) => {
        await expect(await within(canvasElement).findByText('No commits yet')).toBeVisible();
    },
};

/** A first open, nothing kept yet: the skeleton in the graph's shape until the first rows arrive (CH32, first run and loading D17, ES21). */
export const FirstOpen: Story = {
    render: () =>
        renderOver({
            commits: [],
            firstOpen: true,
            holdIf: operation => (operation === 'RepositoryCommitRefs' ? NEVER : null),
        }),
    play: async ({ canvasElement }) => {
        await expect(await within(canvasElement).findByText('Loading commits…')).toBeInTheDocument();
    },
};

/** ES22, D12: GitHub does not answer and nothing is kept: the section says so, instead of loading for good. */
export const Unavailable: Story = {
    render: () =>
        renderOver({
            commits: [],
            firstOpen: true,
            failIf: operation => operation === 'RepositoryCommitRefs',
        }),
    play: async ({ canvasElement }) => {
        const notice = "githq couldn't read the commits. It tries again every 30 seconds.";
        await expect(await within(canvasElement).findByText(notice)).toBeVisible();
    },
};

/** ES22, D12: offline with nothing kept: the same note, its line the cause's, and nothing to press. */
export const OfflineNothingKept: Story = {
    render: () => renderOver({ commits: [], firstOpen: true, failIf: () => true, online: false }),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(await canvas.findByRole('heading', { name: "You're offline" })).toBeVisible();
        await expect(canvas.getByText(/so the commits haven't arrived yet/u)).toBeVisible();
        await expect(canvas.queryByRole('button', { name: /Try again/u })).toBeNull();
    },
};

/**
 * D15: on a window below about 1,200 px, the list of branches and tags is folded away; `B` opens it over the graph from
 * its left, and `Esc` closes it. On a wider window (Storybook's own canvas, say) it is simply there, left of the graph.
 */
export const ListOverTheGraph: Story = {
    render: () => renderOver(sampleWebappHistory()),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await findInGraph(canvas, 'chore: bump vite to 6.2');
        await userEvent.keyboard('b');
        await expect(canvas.getByRole('combobox', { name: 'Filter branches and tags' })).toHaveFocus();
        await expect(canvas.getByRole('grid', { name: 'Branches and tags' })).toBeVisible();
    },
};

/** A plain commit's details, open from the start right of the graph: no pull request and no checks to tell of. */
export const DetailsPlain: Story = {
    render: () =>
        renderOver({
            commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
            bodies: new Map([['c2', 'What changed, and why.\n\nRefs #1187']]),
        }),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await findInGraph(canvas, 'Commit c2');
        const panel = within(await canvas.findByRole('region', { name: 'Commit details' }));
        await expect(await panel.findByText(/What changed, and why/)).toBeVisible();
    },
};

/** CH18: a failing commit's details, its pull request and CI below; no count of failing checks, which is not read. */
export const DetailsFailing: Story = {
    render: () => renderOver({ ...sampleWebappHistory(), bodies: new Map([['a1', 'Stored in the wrong timezone.']]) }),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await findInGraph(canvas, 'chore: bump vite to 6.2');
        await userEvent.keyboard('k');
        const panel = within(await canvas.findByRole('region', { name: 'Commit details' }));
        await expect(await panel.findByText('Failing')).toBeVisible();
    },
};

/** CH20: a merge's details: two parents, on `P` and `Shift+P`. */
export const DetailsOfAMerge: Story = {
    render: () =>
        renderOver({
            commits: [sampleCommit('merge', 30, ['a', 'b']), sampleCommit('a', 20), sampleCommit('b', 10)],
            branches: [sampleCommitRef('main', 'merge')],
        }),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await findInGraph(canvas, 'Commit merge');
        const panel = within(await canvas.findByRole('region', { name: 'Commit details' }));
        await expect(await panel.findByRole('heading', { name: 'Parents' })).toBeVisible();
    },
};

/** CH16: a tag whose commit is not loaded: its details say why the graph stayed. */
export const DetailsNotLoaded: Story = {
    render: () =>
        renderOver({
            commits: [sampleCommit('c1', 10, ['old']), sampleCommit('old', 1)],
            branches: [sampleCommitRef('main', 'c1')],
            tags: [sampleCommitRef('v0.1', 'old')],
            kept: [sampleCommit('c1', 10, ['old'])],
            holdIf: operation => (operation === 'CommitHistories' ? NEVER : null),
        }),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await findInGraph(canvas, 'Commit c1');
        await userEvent.keyboard('b');
        await userEvent.keyboard('v0.1{Enter}');
        const panel = within(await canvas.findByRole('region', { name: 'Commit details' }));
        await expect(await panel.findByText(/Not in the loaded history/)).toBeVisible();
        await expect(await panel.findByRole('heading', { name: 'Commit old' })).toBeVisible();
    },
};

/** A commit not loaded, its read on its way: nothing to draw yet but the line saying so. */
export const DetailsReading: Story = {
    render: () => renderOver(notLoadedTag({ holdIf: holdDetailAndHistory })),
    play: async ({ canvasElement }) => {
        const panel = await openNotLoadedTag(canvasElement);
        await expect(await panel.findByText('Reading this commit…')).toBeVisible();
    },
};

/** CH40: a commit not loaded whose read failed says so; the rest of the panel stays usable. */
export const DetailsReadFailed: Story = {
    render: () =>
        renderOver(
            notLoadedTag({
                holdIf: operation => (operation === 'CommitHistories' ? NEVER : null),
                failIf: operation => operation === 'CommitDetail',
            }),
        ),
    play: async ({ canvasElement }) => {
        const panel = await openNotLoadedTag(canvasElement);
        await expect(await panel.findByText("GitHub can't be asked for this commit right now.")).toBeVisible();
    },
};

/** CH40: a loaded commit whose message could not be read has all the rest, and says what is missing. */
export const DetailsBodyFailed: Story = {
    render: () =>
        renderOver({
            commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
            failIf: operation => operation === 'CommitDetail',
        }),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await findInGraph(canvas, 'Commit c2');
        const panel = within(await canvas.findByRole('region', { name: 'Commit details' }));
        const notice = "GitHub can't be asked for the rest of this message right now.";
        await expect(await panel.findByText(notice)).toBeVisible();
        await expect(panel.getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    },
};

/** CH40: offline, what is kept stays and the last row says older commits wait. */
export const Offline: Story = {
    render: () =>
        renderOver({
            commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['c0'])],
            branches: [sampleCommitRef('main', 'c2')],
            failIf: () => true,
            online: false,
        }),
    play: async ({ canvasElement }) => {
        const notice = "Older commits load when you're back online";
        await expect(await within(canvasElement).findByText(notice)).toBeVisible();
    },
};

/** CH41: a commit no ref reaches any more, its details saying so; the sha of what replaced it is not told (no walk). */
export const DetailsGone: Story = {
    render: () =>
        defineComponent({
            setup() {
                const old = sampleCommit('old', 30, ['c1']);
                const history = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)];
                const { container, store, ready } = createCommitGraphTest({
                    commits: [old, ...history],
                    kept: [old, ...history],
                    branches: [sampleCommitRef('main', 'c2')],
                });
                provideContainer(container);
                const kept = shallowRef(false);
                void showOnceKept();
                return () =>
                    h(
                        'div',
                        { style: 'display: flex; justify-content: flex-end; height: 100vh' },
                        kept.value
                            ? [
                                  h(CommitDetails, {
                                      nameWithOwner: 'acme/web',
                                      oid: 'old',
                                      refs: [],
                                      chosenRef: null,
                                      url: 'https://github.com/acme/web/commit/old',
                                      now: SAMPLE_COMMITS_NOW,
                                      docked: 'side',
                                  }),
                              ]
                            : [],
                    );

                async function showOnceKept() {
                    await ready;
                    await store.open('acme/web');
                    store.ensureDetail('acme/web', { oid: 'old', id: 'C_old' });
                    kept.value = true;
                }
            },
        }),
    play: async ({ canvasElement }) => {
        const panel = within(await within(canvasElement).findByRole('region', { name: 'Commit details' }));
        await expect(await panel.findByText(/It is no longer in the graph/)).toBeVisible();
        await expect(panel.getByText('None any more.')).toBeVisible();
    },
};

/** A commit's text in the graph, which comes before the details in the page and holds the same text. */
async function findInGraph(canvas: ReturnType<typeof within>, text: string) {
    return (await canvas.findAllByText(text))[0];
}

/** A tag whose commit is on GitHub and not loaded. */
function notLoadedTag(options: Pick<CommitGraphTestOptions, 'failIf' | 'holdIf'>): CommitGraphTestOptions {
    const history = [sampleCommit('c1', 10, ['old'])];
    return {
        ...options,
        commits: [...history, sampleCommit('old', 1)],
        branches: [sampleCommitRef('main', 'c1')],
        tags: [sampleCommitRef('v0.1', 'old')],
        kept: history,
    };
}

function holdDetailAndHistory(operation: string) {
    return operation === 'CommitDetail' || operation === 'CommitHistories' ? NEVER : null;
}

/** Chooses the tag of {@link notLoadedTag}, and answers with the panel opened on its commit. */
async function openNotLoadedTag(canvasElement: HTMLElement) {
    const canvas = within(canvasElement);
    await findInGraph(canvas, 'Commit c1');
    await userEvent.keyboard('b');
    await userEvent.keyboard('v0.1{Enter}');
    return within(await canvas.findByRole('region', { name: 'Commit details' }));
}

/** The view over the real store and a GitHub holding `options`, at the sample's moment, the graph at `share` of it. */
function renderOver(options: CommitGraphTestOptions, share?: number) {
    return defineComponent({
        setup() {
            const { container, ready } = createCommitGraphTest(options);
            provideContainer(container);
            if (share !== undefined) {
                container.resolve(LocalPreferences).getPanelShare('commitGraph').value = share;
            }

            const kept = shallowRef(false);
            void showOnceKept();
            return () =>
                h(
                    'div',
                    { style: 'display: flex; height: 100vh' },
                    kept.value ? [h(CommitGraphView, { nameWithOwner: 'acme/web' })] : [],
                );

            async function showOnceKept() {
                await ready;
                kept.value = true;
            }
        },
    });
}
