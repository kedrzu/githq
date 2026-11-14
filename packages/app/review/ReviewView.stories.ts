import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { idleReviewWriting } from '@/testing/idleReviewWriting.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { ReviewFiles } from './ReviewFiles.js';
import type {
    PullRequestFiles,
    ReviewFile,
    ReviewFileCollapse,
    ReviewFileListState,
    ReviewFileState,
} from './ReviewFiles.js';
import type { ReviewThread } from './threads/ReviewThread.js';
import { sampleThread } from '@/testing/sampleThreads.js';
import ReviewView from './ReviewView.vue';

const REFERENCE = { owner: 'fitloop', name: 'webapp', number: 1202 };

const meta = {
    component: ReviewView,
    args: { reference: REFERENCE },
} satisfies Meta<typeof ReviewView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The list on its way: nothing to show yet, and no spinner. */
export const Reading: Story = { render: () => renderView({ kind: 'loading' }) };

/** GitHub would not give the list: its words, Try again and Open on GitHub. */
export const ListFailed: Story = {
    render: () => renderView({ kind: 'failed', error: new Error('GitHub answered 502') }),
};

/** GitHub says the pull request isn't there, perhaps as access was lost: the code kept of it stays hidden. */
export const Gone: Story = { render: () => renderView({ kind: 'gone' }) };

/** A pull request with no changes. */
export const NoChanges: Story = { render: () => renderView({ kind: 'ready' }) };

/**
 * Files arrived: the list at the left and the diff filling the rest, every file under its header. For a spec,
 * `parameters.onTracking` is handed the user's settings once read, where the diff's box keeps its width.
 */
export const Files: Story = {
    render: (_args, { parameters }) =>
        renderView(
            { kind: 'ready' },
            {
                'src/sync/queue.ts': { kind: 'ready', before: 'one\ntwo\nthree\n', after: 'one\nTWO\nthree\n' },
                'public/hero.png': { kind: 'binary', before: 12_000, after: 14_000 },
            },
            { onTracking: parameters.onTracking },
        ),
};

/** CR63: every file viewed and those hidden: the diff says so. */
export const AllViewed: Story = {
    render: () =>
        renderView(
            { kind: 'ready' },
            { 'src/sync/queue.ts': { kind: 'waiting' } },
            { viewed: 'VIEWED', hideViewed: true },
        ),
};

/** CR63, D15: viewed files hidden, but one with an open thread stays, as its header with the thread and its code, under the block saying all are viewed; a file gone from the diff has an entry of its own. */
export const ViewedWithOpenThread: Story = {
    render: () =>
        renderView(
            { kind: 'ready' },
            { 'src/sync/queue.ts': { kind: 'waiting' }, 'src/sync/other.ts': { kind: 'waiting' } },
            {
                viewed: 'VIEWED',
                hideViewed: true,
                collapsed: { 'src/sync/queue.ts': 'viewed', 'src/sync/other.ts': 'viewed' },
                threads: [
                    sampleThread({ id: 'T_1', path: 'src/sync/queue.ts' }),
                    sampleThread({ id: 'T_2', path: 'src/sync/retry-policy.ts' }),
                ],
            },
        ),
};

/** CR12: a lock file as a header saying why, its row tagged, and the file after it open. */
export const Collapsed: Story = {
    render: () =>
        renderView(
            { kind: 'ready' },
            {
                'bun.lock': { kind: 'waiting' },
                'src/sync/queue.ts': { kind: 'ready', before: 'one\n', after: 'two\n' },
            },
            { collapsed: { 'bun.lock': 'lockFile' } },
        ),
};

/** CR62: a push since the last visit: the quiet line over the view, the file tagged in the list and at its header. */
export const LostViewed: Story = {
    render: () =>
        renderView(
            { kind: 'ready' },
            { 'src/sync/queue.ts': { kind: 'ready', before: 'one\n', after: 'two\n' } },
            { lostViewed: new Set(['src/sync/queue.ts']) },
        ),
};

/** CR5: the conversation on, its toggle lit; with the diff beside it and the detail still being read. */
export const ConversationOn: Story = {
    render: () =>
        renderView(
            { kind: 'ready' },
            { 'src/sync/queue.ts': { kind: 'ready', before: 'one\ntwo\nthree\n', after: 'one\nTWO\nthree\n' } },
            { conversationShown: true },
        ),
};

/** The allowance ran out before the list could be read: it comes by itself. */
export const ListPaused: Story = {
    render: () => renderView({ kind: 'paused', until: new Date('2026-10-30T14:32:00').getTime() }),
};

/** What {@link renderView} can have the files be. */
interface RenderOptions {
    readonly viewed?: ReviewFile['viewed'];
    readonly hideViewed?: boolean;
    readonly collapsed?: Readonly<Record<string, ReviewFileCollapse>>;
    readonly lostViewed?: ReadonlySet<string>;
    readonly threads?: readonly ReviewThread[];
    readonly conversationShown?: boolean;
    /** Handed the user's settings once read, to set or read them. */
    readonly onTracking?: (tracking: TrackingStore) => void;
}

/** The view over a real session, whose GitHub answers nothing, reading what is given. */
function renderView(
    list: ReviewFileListState,
    states: Readonly<Record<string, ReviewFileState>> = {},
    options: RenderOptions = {},
) {
    return defineComponent({
        setup() {
            const container = createContainer();
            container.set(LanguageContext, () => APP_LANGUAGE);
            const browser = createSignedInBrowser();
            if (options.conversationShown) {
                browser.localStorage.setItem('githq.reviewConversationShown', 'true');
            }

            container.set(Browser, browser);
            setIndexedDbPersistence(container);
            const files = createFiles(list, states, options);
            container.set(ReviewFiles, { open: () => files, openThreads: () => files });
            provideContainer(container);
            const tracking = container.resolve(TrackingStore);
            void tracking.ready().then(() => options.onTracking?.(tracking));
            return () => h(ReviewView, { reference: REFERENCE });
        },
    });
}

function createFiles(
    list: ReviewFileListState,
    states: Readonly<Record<string, ReviewFileState>>,
    { viewed = 'UNVIEWED', hideViewed = false, collapsed = {}, lostViewed = new Set(), threads = [] }: RenderOptions,
): PullRequestFiles {
    const files = Object.keys(states).map((path): ReviewFile => ({
        path,
        previousPath: null,
        changeType: 'MODIFIED',
        additions: 1,
        deletions: 1,
        viewed,
    }));

    return {
        list,
        files,
        threads,
        threadsState: { kind: 'ready' },
        listComplete: list.kind === 'ready',
        listEnd: list.kind === 'ready' ? 'certain' : 'growing',
        id: 'PR_1202',
        headRefOid: 'head',
        changedFiles: files.length,
        progress: { here: files.length, total: files.length },
        fetchingFirst: null,
        patchesProgress: null,
        pausedUntil: null,
        checkedAt: 0,
        listFailing: false,
        lostViewed,
        lostViewedNotice: lostViewed.size > 0,
        dismissLostViewedNotice: () => {},
        version: 0,
        getState: path => states[path] ?? { kind: 'waiting' },
        prioritize: () => {},
        retry: () => {},
        getCollapse: path => collapsed[path] ?? null,
        getCollapseReason: path => {
            const collapse = collapsed[path];
            return collapse === 'byHand' || collapse === 'viewed' || collapse === 'undecided' || collapse === undefined
                ? null
                : collapse;
        },
        setCollapsed: () => {},
        setViewed: () => {},
        hideViewed,
        setHideViewed: () => {},
        isThreadOpen: () => false,
        setThreadOpen: () => {},
        filter: { pattern: '', regex: false },
        setFilter: () => {},
        keepFilter: () => {},
        position: null,
        setPosition: () => {},
        getExpandedLines: () => [],
        isExpansionReset: () => false,
        expandLines: () => {},
        writing: idleReviewWriting,
    };
}
