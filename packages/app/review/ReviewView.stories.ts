import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import CommandMenu from '@/commands/CommandMenu.vue';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { commandMenu } from '@/commands/definitions/index.js';
import type { NavigationData } from '@/commands/searchNavigation.js';
import { useCommands } from '@/commands/useCommands.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { FakeReviewWriting } from '@/testing/FakeReviewWriting.js';
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
import type { FileFilterInput } from './utils/createFileFilter.js';
import type { ReviewWriting } from './writing/ReviewWriting.js';
import type { DiffLineRange } from './diff/buildDiffRows.js';
import ReviewView from './ReviewView.vue';

const REFERENCE = { owner: 'fitloop', name: 'webapp', number: 1202 };
/**
 * No lines shown beyond the diff's: one array, as `ReviewFiles` keeps it. A new one on every call has the view's rows
 * rebuilt on every read, which loops once a thread sits on a line.
 */
const NO_LINES: readonly DiffLineRange[] = [];
/** The command menu finds no places or items here: only the screen's actions. */
const NO_NAVIGATION: NavigationData = { places: [], trackedRepositories: [], items: [] };

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

/**
 * D44: a file with an open thread of two comments on its changed line, the second the viewer's own, and the command menu
 * behind ⌘K as the app has it. For a spec, `parameters.writing` is the writing it writes through (a fresh
 * {@link FakeReviewWriting} by default).
 */
export const Thread: Story = {
    render: (_args, { parameters }) =>
        renderView(
            { kind: 'ready' },
            { 'src/sync/queue.ts': { kind: 'ready', before: 'one\ntwo\nthree\n', after: 'one\nTWO\nthree\n' } },
            {
                threads: [createTwoCommentThread()],
                writing: parameters.writing instanceof FakeReviewWriting ? parameters.writing : new FakeReviewWriting(),
                commandMenu: true,
            },
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

/** D11: a filter no file matches: the list kept under it, and the way to clear it. */
export const NoMatch: Story = {
    render: () =>
        renderView(
            { kind: 'ready' },
            { 'src/sync/queue.ts': { kind: 'waiting' } },
            { filter: { pattern: 'nothing-here', regex: false } },
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
    readonly filter?: FileFilterInput;
    /** What the review writes through; nothing is written by default. */
    readonly writing?: ReviewWriting;
    /** The command menu mounted beside the view, opened by ⌘K. */
    readonly commandMenu?: boolean;
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
            return () => (options.commandMenu ? h(ReviewWithCommandMenu) : h(ReviewView, { reference: REFERENCE }));
        },
    });
}

/** The view and the command menu over its actions, ⌘K opening it as the app's shell does (`AppCommands`). */
const ReviewWithCommandMenu = defineComponent({
    setup() {
        const t = useTranslate();
        const registry = useService(CommandRegistry);
        useCommands(() => [
            bindCommand(commandMenu, { section: 'app', menu: false, once: true, run: () => registry.openMenu() }, t),
        ]);
        return () => [
            h(ReviewView, { reference: REFERENCE }),
            h(CommandMenu, {
                open: registry.menu !== null,
                'onUpdate:open': (open: boolean) => (open ? registry.openMenu() : registry.closeMenu()),
                commands: registry.commands,
                subject: registry.subject,
                navigation: NO_NAVIGATION,
                request: registry.menu,
            }),
        ];
    },
});

/** `T_1` on `src/sync/queue.ts`'s changed line: sofiab's comment, then one of the viewer's, which they may edit. */
function createTwoCommentThread(): ReviewThread {
    const thread = sampleThread({ path: 'src/sync/queue.ts', line: 2, originalLine: 2 });
    return {
        ...thread,
        comments: thread.comments.map((comment, index) => ({ ...comment, viewerCanUpdate: index === 1 })),
    };
}

function createFiles(
    list: ReviewFileListState,
    states: Readonly<Record<string, ReviewFileState>>,
    {
        viewed = 'UNVIEWED',
        hideViewed = false,
        collapsed = {},
        lostViewed = new Set(),
        threads = [],
        filter = { pattern: '', regex: false },
        writing = idleReviewWriting,
    }: RenderOptions,
): PullRequestFiles {
    const openThreads = shallowRef<ReadonlySet<string>>(new Set());
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
        isThreadOpen: id => openThreads.value.has(id),
        setThreadOpen: (id, open) => {
            const changed = new Set(openThreads.value);
            if (open) {
                changed.add(id);
            } else {
                changed.delete(id);
            }

            openThreads.value = changed;
        },
        filter,
        setFilter: () => {},
        keepFilter: () => {},
        position: null,
        setPosition: () => {},
        getExpandedLines: () => NO_LINES,
        isExpansionReset: () => false,
        expandLines: () => {},
        writing,
    };
}
