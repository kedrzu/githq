import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type { PullRequestStatusesQuery, PullRequestStatusFieldsFragment } from '@githq/github/generated.gen.js';
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { searchIssues } from '@githq/github/rest/searchIssues.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { splitIntoChunks } from '@nzyme/utils/array/splitIntoChunks.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed, shallowRef, watch } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { AuthStore } from '@/auth/AuthStore.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS, SYNC_LOOPS } from '@/store/ItemStoreTypes.js';
import type { MyWorkGroup, SyncLoop } from '@/store/ItemStoreTypes.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { toItem, toPullRequestStatus } from '@/store/toItem.js';
import { TrackedItems } from '@/tracking/TrackedItems.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { haveOpenItemsArrived } from '@/tracking/utils/haveOpenItemsArrived.js';

import type { Freshness } from './Freshness.js';
import { FRESH_SLACK_MS, getFreshness } from './Freshness.js';
import { getAllowancePause } from './getAllowancePause.js';
import { isRateLimitRefusal } from './isRateLimitRefusal.js';
import { readItemsByIds } from './readItemsByIds.js';
import { SyncLeadership } from './SyncLeadership.js';
import { SyncPausedError } from './SyncPausedError.js';
import type { SyncPause } from './SyncPausedError.js';
import { TabChannel } from './TabChannel.js';
import type { TabMessage } from './TabChannel.js';
import { PROJECT_PROBE_INTERVAL_MS, TrackingSync } from './TrackingSync.js';
import type { TrackingSyncContext } from './TrackingSync.js';
import { isNodeGone } from './utils/isNodeGone.js';

/**
 * What the status bar's sidebar segment says for the whole app, rather than for one surface: the browser is
 * offline, or polling waits for GitHub's allowance (K3) — with the bucket that ran out as last reported, `null`
 * when GitHub asked to slow down without one running out.
 */
export type SyncNotice =
    | { readonly kind: 'offline'; readonly since: number }
    | { readonly kind: 'paused'; readonly until: number; readonly allowance: GitHubRateLimit | null };

/** How often each loop polls, in ms, while the tab is shown and while it is hidden. */
const INTERVALS: Readonly<Record<SyncLoop, { readonly visible: number; readonly hidden: number }>> = {
    myWork: { visible: 30_000, hidden: 120_000 },
    pullRequestStatuses: { visible: 60_000, hidden: 300_000 },
    repositories: { visible: 60_000, hidden: 300_000 },
    projects: { visible: 60_000, hidden: 300_000 },
    // A download runs until it is done; this only looks again for work it was not told about.
    download: { visible: 60_000, hidden: 300_000 },
};

/** The "my work" searches (D11), one per group. */
const MY_WORK_SEARCHES: Readonly<Record<MyWorkGroup, string>> = {
    reviewRequested: 'is:open is:pr review-requested:@me archived:false',
    authored: 'is:open is:pr author:@me archived:false',
    assigned: 'is:open is:issue assignee:@me archived:false',
    mentioned: 'is:open mentions:@me archived:false',
};

/** GitHub's cap on a search page; more matches than this are not paged (rare for one person's open work). */
const SEARCH_PAGE_SIZE = 100;
/** How many node ids one `ItemsByIds` / `PullRequestStatuses` / `PullRequestStacks` asks for. */
const NODES_BATCH_SIZE = 50;
/** The most pull requests a GitHub stack holds, and the most `PullRequestStacks` asks of one. */
const STACK_MAX_SIZE = 100;
/** How long to wait on a rate-limit refusal that says neither when to retry nor which bucket ran out. */
const UNKNOWN_PAUSE_MS = 60_000;

/** The signed-in user the loops poll for, captured when they started. */
interface Session {
    readonly account: Account;
    readonly rest: GitHubRestRequester;
    readonly loops: Record<SyncLoop, LoopRun>;
}

interface LoopRun {
    running: boolean;
    cancelTimer: (() => void) | null;
    lastRunEndedAt: number | null;
}

/** How a loop is doing now, for freshness — sent to the tabs that do not sync, which show it too. */
export interface SyncLoopStatus {
    readonly running: boolean;
    /** The last poll failed for another reason than the connection or the allowance. */
    readonly failing: boolean;
    readonly pausedUntil: number | null;
    /** The bucket that ran out; `null` for GitHub asking to slow down (`retry-after`). */
    readonly pausedBucket: string | null;
}

const IDLE: SyncLoopStatus = { running: false, failing: false, pausedUntil: null, pausedBucket: null };
/** The loops a surface's freshness is told from. */
const FRESHNESS_LOOPS: readonly SyncLoop[] = ['myWork', 'repositories', 'projects'];
const IDLE_LOOPS: Readonly<Record<SyncLoop, SyncLoopStatus>> = {
    myWork: IDLE,
    pullRequestStatuses: IDLE,
    repositories: IDLE,
    projects: IDLE,
    download: IDLE,
};
/** The buckets each loop draws on: the one that ran out is the one it waits for. */
const LOOP_BUCKETS: Readonly<Record<SyncLoop, readonly string[]>> = {
    myWork: ['search', 'graphql'],
    pullRequestStatuses: ['graphql'],
    repositories: ['core', 'graphql'],
    projects: ['core', 'graphql'],
    download: ['graphql'],
};

/**
 * Keeps the signed-in user's local copy (`ItemStore`, `ProjectStore`) in step with GitHub by polling (D4, D7),
 * in five loops:
 *
 * - `myWork`: the four "my work" searches (REST, `search` bucket — no ETag, so no free 304s), then a re-read
 *   of only the items whose `updated_at` moved (`ItemsByIds`), and each group's members;
 * - `pullRequestStatuses`: checks, reviews, mergeability and stack of the open pull requests in "my work" and in
 *   the stacks the copy holds (`PullRequestStatuses`), which change without moving `updated_at`; then the
 *   stacks the copy holds only some pull requests of are read whole (`PullRequestStacks`, stacked PRs D7);
 * - `repositories`, `projects`, `download`: the tracked repositories' and projects' change polls (free 304s)
 *   and their first download ({@link TrackingSync}), which starts once "my work" has arrived and runs again
 *   when the user tracks more.
 *
 * Each loop polls at once when it starts, then every interval (longer while the tab is hidden), again when the
 * tab is shown with its last success older than an interval, and when the connection comes back. A loop never
 * overlaps itself. Before every request it checks the allowance of the bucket it draws on, and waits for the
 * reset while one is used up — as it waits out GitHub's `retry-after`.
 *
 * Polling runs while a user is signed in, their kept copy is loaded and this tab is the one that syncs
 * ({@link SyncLeadership}), and stops when they sign out, another account takes over (here or in another tab) or
 * another tab syncs. Every request carries the token captured at start, and an answer arriving after its session
 * ended is dropped, never written. The intervals are those of a shown tab while any tab of the account is shown.
 *
 * A tab that does not sync shows the syncing tab's freshness: the loops' last results come with the stores'
 * changes, and how each loop is doing now ({@link SyncLoopStatus}) is sent by the syncing tab, as is the
 * allowance any tab learns. A tab taking over from another goes on from where it was: a loop polled within its
 * interval waits for the rest of it, a pause for the allowance still holds.
 */
export type SyncEngine = Resolved<typeof SyncEngine>;
export const SyncEngine = defineService({
    name: 'SyncEngine',
    deps: {
        auth: AuthStore,
        accounts: AccountSession,
        items: ItemStore,
        tracking: TrackingStore,
        projects: ProjectStore,
        trackedItems: TrackedItems,
        trackingSync: TrackingSync,
        rateLimits: GitHubRateLimitStore,
        createRest: GitHubRestFactory,
        leadership: SyncLeadership,
        tabs: TabChannel,
        browser: Browser,
        clock: Clock,
        logger: Logger,
    },
    setup({
        auth,
        accounts,
        items,
        tracking,
        projects,
        trackedItems,
        trackingSync,
        rateLimits,
        createRest,
        leadership,
        tabs,
        browser,
        clock,
        logger,
    }) {
        const statusRef = shallowRef<Readonly<Record<SyncLoop, SyncLoopStatus>>>(IDLE_LOOPS);
        // An account's copy is loaded: its freshness is told, whichever tab syncs it.
        const activeRef = shallowRef(false);
        const visibleRef = shallowRef(tabs.anyVisible);
        const onlineRef = shallowRef(browser.isOnline());
        const offlineSinceRef = shallowRef(clock.now());
        // Freshness changes with time alone; this moves when it may have (`touch`).
        const nowRef = shallowRef(clock.now());

        const myWorkFreshness = computed(() => getLoopFreshness('myWork', items.getSyncState('myWork').lastSuccessAt));

        const notice = computed((): SyncNotice | null => {
            if (!activeRef.value) {
                return null;
            }

            if (!onlineRef.value) {
                return { kind: 'offline', since: offlineSinceRef.value };
            }

            let pause: SyncPause | null = null;
            for (const loop of SYNC_LOOPS) {
                const { pausedUntil, pausedBucket } = statusRef.value[loop];
                if (pausedUntil !== null && pausedUntil > nowRef.value && (!pause || pausedUntil > pause.until)) {
                    pause = { until: pausedUntil, bucket: pausedBucket };
                }
            }

            if (!pause) {
                return null;
            }

            return {
                kind: 'paused',
                until: pause.until,
                allowance: pause.bucket === null ? null : rateLimits.get(pause.bucket),
            };
        });

        let session: Session | null = null;
        let cancelTouch: (() => void) | null = null;
        /** The account whose copy is loaded. */
        let followed: Account | null = null;
        /**
         * How the loops of the tab syncing an account were doing, as it last said — heard even before this tab's copy
         * was loaded. Taking over that account, this tab goes on from there.
         */
        let mirrored: {
            readonly account: Account;
            readonly status: Readonly<Record<SyncLoop, SyncLoopStatus>>;
        } | null = null;

        watch(
            () => [accounts.current, items.loaded && tracking.loaded && projects.loaded, leadership.isLeader] as const,
            ([account, loaded, leader]) => follow(loaded ? account : null, leader),
            { immediate: true },
        );
        // Tracking more — or one hidden being shown again — starts its download at once, not at the loop's next look.
        watch(
            () => trackingSync.hasDownloadWork(),
            work => {
                if (session && work) {
                    void run(session, 'download');
                }
            },
        );

        watch(() => tabs.anyVisible, followVisibility);
        browser.onOnlineChange(followConnection);
        tabs.onMessage(receive);
        tabs.onTabJoined(() => {
            // What only this tab's memory holds, for the tab that just opened.
            if (session) {
                publishStatus();
                for (const rateLimit of rateLimits.all()) {
                    tabs.publish({ kind: 'rateLimit', rateLimit });
                }
            }
        });
        rateLimits.onUpdate(rateLimit => tabs.publish({ kind: 'rateLimit', rateLimit }));

        return {
            /** How fresh "my work" is; reactive. */
            get myWorkFreshness() {
                return myWorkFreshness.value;
            },
            /** What the whole app is held back by — offline, or the allowance — or `null`; reactive. */
            get notice() {
                return notice.value;
            },
            getRepositoryFreshness,
            getProjectFreshness,
        };

        /**
         * How fresh a tracked repository is: `partial` until its open items have arrived — told by the download, not
         * by the poll of the others — then as its poll goes, or `refused` while GitHub refuses its changes; reactive.
         */
        function getRepositoryFreshness(nameWithOwner: string): Freshness {
            const state = tracking.getSyncState({ kind: 'repository', nameWithOwner });
            if (!haveOpenItemsArrived(state)) {
                return getLoopFreshness('download', null);
            }

            if (state.refused) {
                return { kind: 'stale', since: state.lastSuccessAt, reason: 'refused' };
            }

            return getLoopFreshness('repositories', state.lastSuccessAt);
        }

        /**
         * How fresh a tracked project is: `partial` until all its items have arrived — told by the download — then as
         * its poll goes, the slower GraphQL one while GitHub refuses its REST; reactive.
         */
        function getProjectFreshness(id: string): Freshness {
            const state = tracking.getSyncState({ kind: 'project', id });
            if (!haveOpenItemsArrived(state)) {
                return getLoopFreshness('download', null);
            }

            return getLoopFreshness(
                'projects',
                state.lastSuccessAt,
                state.refused ? Math.max(PROJECT_PROBE_INTERVAL_MS, intervalOf('projects')) : intervalOf('projects'),
            );
        }

        function getLoopFreshness(
            loop: SyncLoop,
            lastSuccessAt: number | null,
            intervalMs = intervalOf(loop),
        ): Freshness {
            const status = statusRef.value[loop];
            return getFreshness({
                now: nowRef.value,
                lastSuccessAt,
                intervalMs,
                checking: status.running,
                online: onlineRef.value,
                failing: status.failing,
                pausedUntil: status.pausedUntil,
            });
        }

        /**
         * The account, its kept copy or which tab syncs changed: polling for whoever was before stops, and polling for
         * the account starts if this tab syncs it.
         */
        function follow(account: Account | null, leader: boolean) {
            if (followed !== account) {
                followed = account;
                statusRef.value = account && mirrored?.account === account ? mirrored.status : IDLE_LOOPS;
            }

            activeRef.value = account !== null;
            const synced = leader ? account : null;
            if (session?.account !== synced) {
                if (session) {
                    stop(session);
                }

                if (synced) {
                    start(synced, mirrored?.account === synced);
                }
            }

            touch();
        }

        /** Takes in how the syncing tab's loops are doing, and the allowance another tab learned. */
        function receive(message: TabMessage) {
            switch (message.kind) {
                case 'syncStatus': {
                    const account = accounts.current;
                    if (session || !account) {
                        break;
                    }

                    mirrored = { account, status: message.status };
                    if (followed === account) {
                        statusRef.value = message.status;
                        touch();
                    }

                    break;
                }
                case 'rateLimit':
                    rateLimits.merge(message.rateLimit);
                    break;
                default:
                    break;
            }
        }

        /**
         * Starts the loops: each at once, one after another — or, taking over from another tab (`resume`), only
         * those due by their last attempt and the download with work left; the others wait for the rest of their
         * interval, a pause for the allowance still holds.
         */
        function start(account: Account, resume: boolean) {
            const current: Session = {
                account,
                // The token of this account, whatever the store holds by the time a request goes.
                rest: createRest(() => account.token),
                loops: {
                    myWork: createLoopRun(),
                    pullRequestStatuses: createLoopRun(),
                    repositories: createLoopRun(),
                    projects: createLoopRun(),
                    download: createLoopRun(),
                },
            };
            session = current;
            statusRef.value = resume ? withoutRunning(statusRef.value) : IDLE_LOOPS;
            logger.debug('Sync started', { resume });

            // One after another (GitHub asks for serial requests), "my work" first: it is what the user waits for.
            // Statuses come right after the first search: the items it re-read carry theirs already.
            void (async () => {
                for (const loop of SYNC_LOOPS) {
                    if (resume && !isDue(loop)) {
                        current.loops[loop].lastRunEndedAt = items.getSyncState(loop).lastAttemptAt;
                        arm(current, loop);
                    } else {
                        await run(current, loop);
                    }
                }
            })();
        }

        /** Whether a loop taken over from another tab should poll now rather than at the end of its interval. */
        function isDue(loop: SyncLoop) {
            if (loop === 'download') {
                return trackingSync.hasDownloadWork();
            }

            const { lastAttemptAt } = items.getSyncState(loop);
            return lastAttemptAt === null || clock.now() - lastAttemptAt >= intervalOf(loop);
        }

        function stop(current: Session) {
            for (const loop of SYNC_LOOPS) {
                current.loops[loop].cancelTimer?.();
                current.loops[loop].cancelTimer = null;
            }

            session = null;
            statusRef.value = IDLE_LOOPS;
            logger.debug('Sync stopped');
        }

        /** Whether `current` is still the session — here and in the store every request was authorised by. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }

        /** Polls `loop` now, unless it is already polling, then sets its next poll. */
        async function run(current: Session, loop: SyncLoop) {
            const state = current.loops[loop];
            if (!isCurrent(current) || state.running) {
                return;
            }

            state.cancelTimer?.();
            state.cancelTimer = null;

            const status = statusRef.value[loop];
            const startedAt = clock.now();
            if (!onlineRef.value || (status.pausedUntil !== null && status.pausedUntil > startedAt)) {
                // Skipped: the connection coming back or the pause ending runs it, else the next interval does.
                state.lastRunEndedAt = startedAt;
                arm(current, loop);
                return;
            }

            state.running = true;
            setStatus(loop, { ...status, running: true });

            try {
                const { incomplete } = await poll(current, loop);
                if (!isCurrent(current)) {
                    return;
                }

                const now = clock.now();
                const firstSuccess = items.getSyncState(loop).lastSuccessAt === null;
                items.setSyncState(loop, { lastAttemptAt: startedAt, lastSuccessAt: now, lastError: null, incomplete });
                setStatus(loop, IDLE);
                logger.debug('Sync loop polled', { loop, durationMs: now - startedAt, incomplete });
                if (loop === 'myWork' && firstSuccess) {
                    // The download waited for "my work" (G6).
                    void run(current, 'download');
                }
            } catch (error) {
                if (!isCurrent(current)) {
                    return;
                }

                const pause = readPause(error, loop);
                items.setSyncState(loop, {
                    ...items.getSyncState(loop),
                    lastAttemptAt: startedAt,
                    lastError: error instanceof Error ? error.message : String(error),
                });

                if (pause) {
                    logger.warn('GitHub allowance used up; sync loop paused', {
                        loop,
                        bucket: pause.bucket,
                        pausedForMs: pause.until - clock.now(),
                    });
                    setStatus(loop, {
                        running: false,
                        failing: false,
                        pausedUntil: pause.until,
                        pausedBucket: pause.bucket,
                    });
                } else {
                    logger.warn('Sync loop failed; retrying at the next interval', { loop, error });
                    if (error instanceof GitHubApiError && error.status === 401) {
                        // The token was revoked: checking who it belongs to signs the user out.
                        void auth.refreshViewer();
                    }

                    setStatus(loop, { ...IDLE, failing: true });
                }
            } finally {
                state.running = false;
                if (session === current) {
                    state.lastRunEndedAt = clock.now();
                    arm(current, loop);
                }
            }
        }

        /** Sets `loop`'s next poll: an interval after the last one, or when its pause ends. */
        function arm(current: Session, loop: SyncLoop) {
            const state = current.loops[loop];
            state.cancelTimer?.();

            const now = clock.now();
            const { pausedUntil } = statusRef.value[loop];
            const at =
                pausedUntil !== null && pausedUntil > now
                    ? pausedUntil
                    : (state.lastRunEndedAt ?? now) + intervalOf(loop);

            state.cancelTimer = clock.schedule(
                () => {
                    state.cancelTimer = null;
                    void run(current, loop);
                },
                Math.max(0, at - now),
            );
        }

        async function poll(current: Session, loop: SyncLoop) {
            switch (loop) {
                case 'myWork':
                    return await pollMyWork(current);
                case 'pullRequestStatuses':
                    await pollPullRequestStatuses(current);
                    return { incomplete: false };
                case 'repositories':
                    await trackingSync.pollRepositories(toContext(current));
                    return { incomplete: false };
                case 'projects':
                    await trackingSync.pollProjects(toContext(current));
                    return { incomplete: false };
                case 'download': {
                    // "My work" first: it is what the user waits for, and small (G6).
                    if (items.getSyncState('myWork').lastSuccessAt === null) {
                        return { incomplete: false };
                    }

                    const downloaded = trackingSync.hasDownloadWork();
                    await trackingSync.download(toContext(current));
                    if (downloaded && !trackingSync.hasDownloadWork()) {
                        // Polled at once, so what changed during the download is in, and the surfaces read fresh.
                        void run(current, 'repositories').then(() => run(current, 'projects'));
                    }

                    return { incomplete: false };
                }
                default:
                    return assertNever(loop);
            }
        }

        /**
         * The four searches, one after another (GitHub asks for serial requests). As each answers, its items whose
         * `updated_at` moved — or that are new — are read again, the ones GitHub no longer returns removed, and
         * its group set to what it found: on the first download the groups arrive one by one. Then an item no
         * search found leaves "my work" and the store.
         */
        async function pollMyWork(current: Session) {
            let incomplete = false;
            // Across the groups: an item two searches find is read once.
            const read = new Set<string>();
            const gone = new Set<string>();

            for (const group of MY_WORK_GROUPS) {
                checkAllowance('search');
                const result = await searchIssues(current.rest, {
                    q: MY_WORK_SEARCHES[group],
                    perPage: SEARCH_PAGE_SIZE,
                    sort: 'updated',
                });
                if (!isCurrent(current)) {
                    return { incomplete };
                }

                incomplete ||= result.incompleteResults || result.totalCount > result.items.length;
                const changed: string[] = [];
                for (const hit of result.items) {
                    if (!read.has(hit.nodeId) && items.getStored(hit.nodeId)?.updatedAt !== hit.updatedAt) {
                        changed.push(hit.nodeId);
                        read.add(hit.nodeId);
                    }
                }

                for (const ids of splitIntoChunks(changed, NODES_BATCH_SIZE)) {
                    const batchGone = await readItems(current, ids);
                    if (!batchGone) {
                        return { incomplete };
                    }

                    for (const id of batchGone) {
                        gone.add(id);
                    }
                }

                const ids: string[] = [];
                for (const hit of result.items) {
                    if (!gone.has(hit.nodeId)) {
                        ids.push(hit.nodeId);
                    }
                }

                items.setMembership(group, ids);
            }

            const left = removeItemsOutsideMyWork();
            logger.debug('My work polled', { reread: read.size, removed: gone.size, left: left.length });
            return { incomplete };
        }

        /** Re-reads `ids` (one batch) into the store and removes the gone ones; returns those, or `null` when the session ended. */
        async function readItems(current: Session, ids: readonly string[]): Promise<ReadonlySet<string> | null> {
            checkAllowance('graphql');
            const { read, gone } = await readItemsByIds({ sdk: current.account.sdk, ids, logger });
            if (!isCurrent(current)) {
                return null;
            }

            items.upsertMany(read);
            items.remove(gone);
            return gone;
        }

        /**
         * Removes from the store the items no "my work" group holds any more, and returns their ids — but not the
         * items of tracked repositories and projects: they stay, whatever "my work" says.
         */
        function removeItemsOutsideMyWork() {
            return trackedItems.evict(items.all.map(item => item.id));
        }

        /** What a tracked repository's or project's loop needs of the session. */
        function toContext(current: Session): TrackingSyncContext {
            return {
                account: current.account,
                rest: current.rest,
                isCurrent: () => isCurrent(current),
                checkAllowance,
            };
        }

        async function pollPullRequestStatuses(current: Session) {
            const open = new Set<string>();
            for (const group of MY_WORK_GROUPS) {
                for (const id of items.membership[group] ?? []) {
                    const item = items.get(id);
                    if (item?.kind === 'pullRequest' && item.state === 'OPEN') {
                        open.add(id);
                    }
                }
            }

            // Those copied for their stack only: nothing else re-reads them.
            for (const item of items.all) {
                if (item.kind === 'pullRequest' && item.state === 'OPEN' && item.stack) {
                    open.add(item.id);
                }
            }

            // Those copied for their stack only whose `updatedAt` moved: nothing else re-reads the rest of their row.
            const moved: string[] = [];
            for (const ids of splitIntoChunks([...open], NODES_BATCH_SIZE)) {
                checkAllowance('graphql');
                const errors: GitHubGraphQLErrorEntry[] = [];
                const { nodes } = await current.account.sdk.PullRequestStatuses(
                    { ids },
                    { onPartialErrors: found => errors.push(...found) },
                );
                if (!isCurrent(current)) {
                    return;
                }

                if (errors.length > 0) {
                    logger.warn('Pull request statuses read in part', { errors });
                }

                const updated: PullRequestItem[] = [];
                for (const node of nodes) {
                    // Gone or no longer a pull request: the next search finds out.
                    if (!isPullRequestNode(node)) {
                        continue;
                    }

                    // As stored: a change of the user's still on its way must not become part of it.
                    const item = items.getStored(node.id);
                    if (item?.kind === 'pullRequest') {
                        updated.push({ ...item, ...toPullRequestStatus(node) });
                        if (node.updatedAt !== item.updatedAt && !trackedItems.keepsForItself(item)) {
                            moved.push(item.id);
                        }
                    }
                }

                items.upsertMany(updated);
            }

            for (const ids of splitIntoChunks(moved, NODES_BATCH_SIZE)) {
                if (!(await readItems(current, ids))) {
                    return;
                }
            }

            await readIncompleteStacks(current);
        }

        /**
         * Reads whole the stacks the copy holds fewer pull requests of than they have — merged and closed ones too —
         * so a stack's entry is whole whichever of its pull requests brought it in (stacked PRs, D7). Once the copy
         * holds them all, nothing is asked. The answer is what the stack holds: a held pull request it does not list
         * has left the stack — all of them when the stack is gone — which moves no `updated_at`, so nothing else
         * would tell a closed one.
         */
        async function readIncompleteStacks(current: Session) {
            const held = new Map<string, { size: number; positions: Set<number> }>();
            for (const item of items.all) {
                if (item.kind !== 'pullRequest' || !item.stack) {
                    continue;
                }

                const stack = held.get(item.stack.id) ?? { size: 0, positions: new Set<number>() };
                stack.size = Math.max(stack.size, item.stack.size);
                stack.positions.add(item.stack.position);
                held.set(item.stack.id, stack);
            }

            const incomplete = [...held].filter(([, stack]) => stack.positions.size < stack.size);
            for (const batch of splitIntoChunks(incomplete, NODES_BATCH_SIZE)) {
                checkAllowance('graphql');
                const errors: GitHubGraphQLErrorEntry[] = [];
                const { nodes } = await current.account.sdk.PullRequestStacks(
                    {
                        ids: batch.map(([id]) => id),
                        // The batch's largest stack: GitHub charges for the entries asked, not those found.
                        first: Math.min(STACK_MAX_SIZE, Math.max(...batch.map(([, stack]) => stack.size))),
                    },
                    { onPartialErrors: found => errors.push(...found) },
                );
                if (!isCurrent(current)) {
                    return;
                }

                if (errors.length > 0) {
                    logger.warn('Pull request stacks read in part', { errors });
                }

                const read: Item[] = [];
                for (const [index, [id]] of batch.entries()) {
                    const node = nodes[index] ?? null;
                    const nodeErrors = errors.filter(error => error.path?.[0] === 'nodes' && error.path[1] === index);
                    if (node === null || !('entries' in node)) {
                        if (isNodeGone(nodeErrors)) {
                            read.push(...leaveStack(id, new Set()));
                        }

                        continue;
                    }

                    const listed = new Set<string>();
                    for (const entry of node.entries.nodes ?? []) {
                        const item = toItem(entry?.pullRequest ?? null);
                        if (item) {
                            read.push(item);
                            listed.add(item.id);
                        }
                    }

                    // Only a whole answer tells who left: not one cut by `first`, or with an entry GitHub refused.
                    if (nodeErrors.length === 0 && listed.size === node.entries.totalCount) {
                        read.push(...leaveStack(id, listed));
                    }
                }

                items.upsertMany(read);
                logger.debug('Pull request stacks read whole', { stacks: batch.length, read: read.length });
            }
        }

        /**
         * The held pull requests of stack `id` but those `listed`, out of it — as stored, so a change of the user's
         * still on its way does not become part of them.
         */
        function leaveStack(id: string, listed: ReadonlySet<string>) {
            const left: PullRequestItem[] = [];
            for (const { id: itemId } of items.all) {
                const item = items.getStored(itemId);
                if (item?.kind === 'pullRequest' && item.stack?.id === id && !listed.has(itemId)) {
                    left.push({ ...item, stack: null });
                }
            }

            return left;
        }

        /** Throws a pause instead of asking GitHub while `bucket` is used up — but for what is kept for edits. */
        function checkAllowance(bucket: string) {
            const pause = getAllowancePause(rateLimits.get(bucket), clock.now());
            if (pause) {
                throw new SyncPausedError(pause);
            }
        }

        /** The pause a failure calls for — a bucket used up, or GitHub asking to slow down — or `null`. */
        function readPause(error: unknown, loop: SyncLoop): SyncPause | null {
            if (error instanceof SyncPausedError) {
                return error.pause;
            }

            if (!(error instanceof GitHubApiError) || !isRateLimitRefusal(error)) {
                return null;
            }

            const now = clock.now();
            if (error.retryAfter != null) {
                return { until: now + error.retryAfter * 1000, bucket: null };
            }

            for (const bucket of LOOP_BUCKETS[loop]) {
                const limit = rateLimits.get(bucket);
                if (limit && limit.remaining === 0 && limit.resetAt.getTime() > now) {
                    return { until: limit.resetAt.getTime(), bucket };
                }
            }

            return { until: now + UNKNOWN_PAUSE_MS, bucket: null };
        }

        function followVisibility() {
            visibleRef.value = tabs.anyVisible;
            touch();

            const current = session;
            if (!current) {
                return;
            }

            for (const loop of SYNC_LOOPS) {
                if (current.loops[loop].running) {
                    continue;
                }

                const { lastSuccessAt } = items.getSyncState(loop);
                if (visibleRef.value && (lastSuccessAt === null || clock.now() - lastSuccessAt > intervalOf(loop))) {
                    void run(current, loop);
                } else {
                    arm(current, loop);
                }
            }
        }

        function followConnection() {
            const online = browser.isOnline();
            if (online === onlineRef.value) {
                return;
            }

            onlineRef.value = online;
            if (!online) {
                offlineSinceRef.value = clock.now();
            }

            touch();

            const current = session;
            if (online && current) {
                for (const loop of SYNC_LOOPS) {
                    void run(current, loop);
                }
            }
        }

        function setStatus(loop: SyncLoop, status: SyncLoopStatus) {
            statusRef.value = { ...statusRef.value, [loop]: status };
            publishStatus();
            touch();
        }

        function publishStatus() {
            tabs.publish({ kind: 'syncStatus', status: statusRef.value });
        }

        /** Moves `now` to the present, and again at the next moment freshness turns by time alone. */
        function touch() {
            const now = clock.now();
            nowRef.value = now;
            cancelTouch?.();
            cancelTouch = null;
            if (!activeRef.value) {
                return;
            }

            let next = Number.POSITIVE_INFINITY;
            for (const loop of FRESHNESS_LOOPS) {
                const { lastSuccessAt } = items.getSyncState(loop);
                if (lastSuccessAt !== null) {
                    const freshUntil = lastSuccessAt + intervalOf(loop) + FRESH_SLACK_MS + 1;
                    if (freshUntil > now) {
                        next = Math.min(next, freshUntil);
                    }
                }
            }

            for (const loop of SYNC_LOOPS) {
                const { pausedUntil } = statusRef.value[loop];
                if (pausedUntil !== null && pausedUntil > now) {
                    next = Math.min(next, pausedUntil);
                }
            }

            if (next !== Number.POSITIVE_INFINITY) {
                cancelTouch = clock.schedule(touch, next - now);
            }
        }

        function intervalOf(loop: SyncLoop) {
            return INTERVALS[loop][visibleRef.value ? 'visible' : 'hidden'];
        }
    },
});

/** A `PullRequestStatuses` node that is still a pull request: GitHub answers `{}` for another node, `null` for a gone one. */
function isPullRequestNode(node: PullRequestStatusesQuery['nodes'][number]): node is PullRequestStatusFieldsFragment {
    return node !== null && '__typename' in node;
}

/** The loops' status without a poll running: taken over from a tab that may have closed mid-poll. */
function withoutRunning(
    status: Readonly<Record<SyncLoop, SyncLoopStatus>>,
): Readonly<Record<SyncLoop, SyncLoopStatus>> {
    const result = { ...status };
    for (const loop of SYNC_LOOPS) {
        result[loop] = { ...status[loop], running: false };
    }

    return result;
}

function createLoopRun(): LoopRun {
    return { running: false, cancelTimer: null, lastRunEndedAt: null };
}
