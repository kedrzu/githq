import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import { LocalPreferences } from '@/services/LocalPreferences.js';
import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import { SAMPLE_COMMITS_NOW, sampleCheckRun, sampleCommit } from '@/testing/sampleCommits.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import CommitDetails from './CommitDetails.vue';

const REPOSITORY = 'acme/web';
const OID = 'c1';

const CHECKS = [
    sampleCheckRun('integration-tests-against-the-whole-of-the-staging-environment', 'FAILURE'),
    sampleCheckRun('e2e', null),
    sampleCheckRun('lint', 'SUCCESS'),
    sampleCheckRun('typecheck', 'SUCCESS'),
    sampleCheckRun('deploy-preview', 'SKIPPED'),
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
}

const meta = {
    component: CommitDetails,
    args: PANEL,
} satisfies Meta<typeof CommitDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

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
function renderPanel({ width, failed }: PanelOptions) {
    return defineComponent({
        setup() {
            const { container, store, ready } = createCommitGraphTest({
                commits: [sampleCommit(OID, 10)],
                states: new Map([[OID, { pullRequest: null, ci: 'FAILURE' }]]),
                checks: new Map([[OID, CHECKS]]),
                failIf: operation => failed === true && operation === 'CommitChecks',
            });
            provideContainer(container);
            container.resolve(LocalPreferences).getPanelWidth('commitDetails').value = width;
            const shown = shallowRef(false);
            void show();
            return () =>
                h('div', { style: 'display: flex; height: 100vh' }, shown.value ? [h(CommitDetails, PANEL)] : []);

            async function show() {
                await ready;
                const tracking = container.resolve(TrackingStore);
                await tracking.ready();
                tracking.choose({ repositories: [{ nameWithOwner: REPOSITORY, id: 'R_web' }], projects: [] });
                await store.open(REPOSITORY);
                const commit = { oid: OID, id: `C_${OID}` };
                store.ensureDetail(REPOSITORY, commit);
                store.ensureStates(REPOSITORY, [commit]);
                store.ensureChecks(REPOSITORY, commit);
                shown.value = true;
            }
        },
    });
}
