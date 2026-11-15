import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Maximize2 } from 'lucide-vue-next';
import { expect, within } from 'storybook/test';
import { defineComponent, h, shallowRef } from 'vue';

import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import type { CommitGraphTestOptions } from '@/testing/createCommitGraphTest.js';
import {
    SAMPLE_COMMITS_NOW,
    sampleCheckRun,
    sampleCommit,
    sampleCommitRef,
    sampleLongCommitBody,
    sampleWebappHistory,
} from '@/testing/sampleCommits.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import type { OtherArrangement } from '@/item/useItemArrangement.js';

import CommitDetails from './CommitDetails.vue';
import type { CommitRowRef } from './CommitRow.vue';
import type { CommitRef, CommitState } from './CommitTypes.js';

const REPOSITORY = 'acme/web';
const NEVER = new Promise<void>(() => {});
const OID = 'c1';

const CHECKS = [
    sampleCheckRun('integration-tests-against-the-whole-of-the-staging-environment', 'FAILURE'),
    sampleCheckRun('e2e', null),
    sampleCheckRun('lint', 'SUCCESS'),
    sampleCheckRun('typecheck', 'SUCCESS'),
    sampleCheckRun('deploy-preview', 'SKIPPED'),
];

const PASSED = Array.from({ length: 12 }, (_, index) => sampleCheckRun(`job-${index + 1}`, 'SUCCESS'));

const MERGED: CommitState = {
    pullRequest: {
        number: 581,
        state: 'MERGED',
        title: 'Stale state of the server role after its rename',
        url: 'https://github.com/acme/web/pull/581',
        isDraft: false,
    },
    ci: 'FAILURE',
};

const REFS: readonly CommitRowRef[] = [
    { name: 'main', kind: 'default' },
    { name: 'testing/v178', kind: 'tag' },
];

const PANEL = {
    nameWithOwner: REPOSITORY,
    oid: OID,
    refs: [],
    chosenRef: null,
    url: `https://github.com/${REPOSITORY}/commit/${OID}`,
    now: SAMPLE_COMMITS_NOW,
} as const;

/** What a story of the panel varies. */
interface PanelOptions {
    readonly width: number;
    /** GitHub fails to answer for the checks. */
    readonly failed?: boolean;
    /** Failing, with no pull request, when not given. */
    readonly state?: CommitState;
    /** {@link CHECKS} when not given. */
    readonly checks?: typeof CHECKS;
    readonly body?: string;
    readonly refs?: readonly CommitRowRef[];
    /** GitHub never answers for the pull request and the checks. */
    readonly notKnown?: boolean;
    /** Opened as an item, its button moving it there. */
    readonly otherArrangement?: OtherArrangement;
}

const meta = {
    component: CommitDetails,
    args: PANEL,
} satisfies Meta<typeof CommitDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CH55: a merge's pull request, a failing check, two parents and refs, then a 40-line message, all in one scroll. */
export const LongMessage: Story = {
    render: () => renderPanel({ width: 440, state: MERGED, body: sampleLongCommitBody(), refs: REFS }),
};

/** CH57: the checks passed and there is no pull request: the group says so, the passed folded into one row. */
export const ChecksPassedNoPullRequest: Story = {
    render: () =>
        renderPanel({
            width: 440,
            state: { pullRequest: null, ci: 'SUCCESS' },
            checks: PASSED,
            body: 'The drift job ran at 01:00, inside the backup window.',
            refs: [{ name: 'main', kind: 'default' }],
        }),
};

/** CH58: the pull request and the checks not known yet: an empty bar in each group. */
export const NotKnownYet: Story = {
    render: () => renderPanel({ width: 440, notKnown: true, body: sampleLongCommitBody(), refs: REFS }),
};

/** The checks in the narrowest panel, in a tracked repository: names give way, how long each ran stays. */
export const ChecksNarrow: Story = {
    render: () => renderPanel({ width: 320 }),
};

/** The checks at the panel's default width. */
export const ChecksDefaultWidth: Story = {
    render: () => renderPanel({ width: 440 }),
};

/** The checks could not be read: the rollup, and a link to them on GitHub. */
export const ChecksNotRead: Story = {
    render: () => renderPanel({ width: 440, failed: true }),
};

/** Opened as an item, on a wide page: its button opens it full screen, its content kept to the reading width at the left. */
export const OpenedWide: Story = {
    render: () =>
        renderPanel({
            width: 1400,
            state: MERGED,
            body: sampleLongCommitBody(),
            refs: REFS,
            otherArrangement: { arrangement: 'page', title: 'Open full screen', icon: Maximize2 },
        }),
};

/** A plain commit: no pull request and no checks to tell of, its message below. */
export const Plain: Story = {
    render: () =>
        renderOpened({
            options: {
                commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
                bodies: new Map([['c2', 'What changed, and why.\n\nRefs #1187']]),
            },
            oid: 'c2',
        }),
    play: async ({ canvasElement }) => {
        await expect(await within(canvasElement).findByText(/What changed, and why/)).toBeVisible();
    },
};

/** CH18: a failing commit, its pull request and CI. */
export const Failing: Story = {
    render: () => renderOpened({ options: sampleWebappHistory(), oid: 'a2' }),
    play: async ({ canvasElement }) => {
        await expect(await within(canvasElement).findByText('Failing')).toBeVisible();
    },
};

/** CH20: a merge: two parents, on `P` and `Shift+P`. */
export const Merge: Story = {
    render: () =>
        renderOpened({
            options: {
                commits: [sampleCommit('merge', 30, ['a', 'b']), sampleCommit('a', 20), sampleCommit('b', 10)],
                branches: [sampleCommitRef('main', 'merge')],
            },
            oid: 'merge',
        }),
    play: async ({ canvasElement }) => {
        await expect(await within(canvasElement).findByRole('heading', { name: 'Parents' })).toBeVisible();
    },
};

/** CH16: a tag whose commit is not loaded: not in the graph's loaded history, and how old the tag is. */
export const NotLoaded: Story = {
    render: () => renderOpened(notLoadedTag({ holdIf: holdHistory })),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(await canvas.findByText(/Not in the graph's loaded history/)).toBeVisible();
        await expect(await canvas.findByRole('heading', { name: 'Commit old' })).toBeVisible();
    },
};

/** A commit not loaded, its read on its way: nothing to draw yet but the line saying so. */
export const Reading: Story = {
    render: () =>
        renderOpened(
            notLoadedTag({
                holdIf: operation => (operation === 'CommitDetail' || operation === 'CommitHistories' ? NEVER : null),
            }),
        ),
    play: async ({ canvasElement }) => {
        await expect(await within(canvasElement).findByText('Reading this commit…')).toBeVisible();
    },
};

/** CH40: a commit not loaded whose read failed says so; the rest of the panel stays usable. */
export const ReadFailed: Story = {
    render: () =>
        renderOpened(notLoadedTag({ holdIf: holdHistory, failIf: operation => operation === 'CommitDetail' })),
    play: async ({ canvasElement }) => {
        const notice = "GitHub can't be asked for this commit right now.";
        await expect(await within(canvasElement).findByText(notice)).toBeVisible();
    },
};

/** CH40: a loaded commit whose message could not be read has all the rest, and says what is missing. */
export const BodyFailed: Story = {
    render: () =>
        renderOpened({
            options: {
                commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
                failIf: operation => operation === 'CommitDetail',
            },
            oid: 'c2',
        }),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const notice = "GitHub can't be asked for the rest of this message right now.";
        await expect(await canvas.findByText(notice)).toBeVisible();
        await expect(canvas.getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    },
};

/** CH41: a commit no ref reaches any more, saying so; the sha of what replaced it is not told (no walk). */
export const Gone: Story = {
    render: () => {
        const old = sampleCommit('old', 30, ['c1']);
        const history = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)];
        return renderOpened({
            options: { commits: [old, ...history], kept: [old, ...history], branches: [sampleCommitRef('main', 'c2')] },
            oid: 'old',
        });
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(await canvas.findByText(/It is no longer in the graph/)).toBeVisible();
        await expect(canvas.getByText('None any more.')).toBeVisible();
    },
};

/** The panel over the real store, its details, state and checks asked for as the view does. */
function renderPanel(options: PanelOptions) {
    return defineComponent({
        setup() {
            const { container, store, ready } = createCommitGraphTest({
                commits: [sampleCommit(OID, 20, ['p1', 'p2']), sampleCommit('p1', 10), sampleCommit('p2', 5)],
                states: new Map([[OID, options.state ?? { pullRequest: null, ci: 'FAILURE' }]]),
                checks: new Map([[OID, options.checks ?? CHECKS]]),
                bodies: new Map(options.body === undefined ? [] : [[OID, options.body]]),
                failIf: operation => options.failed === true && operation === 'CommitChecks',
                holdIf: operation =>
                    options.notKnown === true &&
                    (operation === 'CommitStates' || operation === 'CommitChecks' || operation === 'CommitDetail')
                        ? new Promise<void>(() => {})
                        : null,
            });
            provideContainer(container);
            const shown = shallowRef(false);
            void show();
            return () =>
                h(
                    'div',
                    { style: `display: flex; width: ${options.width}px; height: 100vh` },
                    shown.value
                        ? [
                              h(CommitDetails, {
                                  ...PANEL,
                                  refs: options.refs ?? [],
                                  otherArrangement: options.otherArrangement ?? null,
                              }),
                          ]
                        : [],
                );

            async function show() {
                await ready;
                const tracking = container.resolve(TrackingStore);
                await tracking.ready();
                tracking.choose({ repositories: [{ nameWithOwner: REPOSITORY, id: 'R_web' }], projects: [] });
                await store.open(REPOSITORY);
                const commit = { oid: OID, id: `C_${OID}` };
                store.ensureDetail(REPOSITORY, OID);
                store.ensureStates(REPOSITORY, [commit]);
                store.ensureChecks(REPOSITORY, OID);
                shown.value = true;
            }
        },
    });
}

/** What {@link renderOpened} shows. */
interface OpenedOptions {
    /** What GitHub holds of the repository, and what of it is kept. */
    readonly options: CommitGraphTestOptions;
    readonly oid: string;
    /** The branch or tag it was chosen by in the graph's list. */
    readonly chosenRef?: CommitRef;
}

/**
 * The commit `oid` of a GitHub holding `options` in a panel at the right, as `OpenedCommit` opens it: the repository's
 * graph opened, and its details, state and checks asked for.
 */
function renderOpened({ options, oid, chosenRef }: OpenedOptions) {
    return defineComponent({
        setup() {
            const { container, store, ready } = createCommitGraphTest(options);
            provideContainer(container);
            const shown = shallowRef(false);
            void show();
            return () =>
                h(
                    'div',
                    { style: 'display: flex; justify-content: flex-end; height: 100vh' },
                    shown.value
                        ? [
                              h(CommitDetails, {
                                  nameWithOwner: REPOSITORY,
                                  oid,
                                  refs: [],
                                  chosenRef: chosenRef ?? null,
                                  url: `https://github.com/${REPOSITORY}/commit/${oid}`,
                                  now: SAMPLE_COMMITS_NOW,
                              }),
                          ]
                        : [],
                );

            async function show() {
                await ready;
                // Not waited for: a story holding the older commits back holds the open too.
                void store.open(REPOSITORY);
                store.ensureDetail(REPOSITORY, oid);
                store.ensureStates(REPOSITORY, [{ oid, id: `C_${oid}` }]);
                store.ensureChecks(REPOSITORY, oid);
                shown.value = true;
            }
        },
    });
}

/** A tag whose commit is on GitHub and not loaded, chosen in the graph's list. */
function notLoadedTag(options: Pick<CommitGraphTestOptions, 'failIf' | 'holdIf'>): OpenedOptions {
    const history = [sampleCommit('c1', 10, ['old'])];
    return {
        options: {
            ...options,
            commits: [...history, sampleCommit('old', 1)],
            branches: [sampleCommitRef('main', 'c1')],
            tags: [sampleCommitRef('v0.1', 'old')],
            kept: history,
        },
        oid: 'old',
        chosenRef: sampleCommitRef('v0.1', 'old'),
    };
}

function holdHistory(operation: string) {
    return operation === 'CommitHistories' ? NEVER : null;
}
