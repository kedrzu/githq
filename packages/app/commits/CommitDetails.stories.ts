import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import { SAMPLE_COMMITS_NOW, sampleCheckRun, sampleCommit, sampleLongCommitBody } from '@/testing/sampleCommits.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import CommitDetails from './CommitDetails.vue';
import type { CommitRowRef } from './CommitRow.vue';
import type { CommitState } from './CommitTypes.js';

const REPOSITORY = 'acme/web';
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
    docked: 'side',
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
                    shown.value ? [h(CommitDetails, { ...PANEL, refs: options.refs ?? [] })] : [],
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
