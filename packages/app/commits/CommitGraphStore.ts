import type {
    CommitChecksQuery,
    CommitDetailQuery,
    CommitFieldsFragment,
    CommitRefFieldsFragment,
    CommitStatesQuery,
    RepositoryCommitRefsQuery,
    RepositoryCommitRefsQueryVariables,
} from '@githq/github/generated.gen.js';
import { isGitHubNotFound } from '@githq/github/isGitHubNotFound.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { splitIntoChunks } from '@nzyme/utils/array/splitIntoChunks.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { toItemCheck } from '@/store/toItemCheck.js';
import type { Freshness } from '@/sync/Freshness.js';
import { getRefusalPause } from '@/sync/getRefusalPause.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { CommitPersistence } from './CommitPersistence.js';
import type { PersistedCommits } from './CommitPersistence.js';
import type {
    CommitChecksRead,
    CommitDetailRead,
    CommitGraphPlace,
    CommitParent,
    CommitPlace,
    CommitRef,
    CommitState,
    KeptCommit,
    KeptCommitRefs,
} from './CommitTypes.js';
import { layoutCommitGraph } from './layoutCommitGraph.js';
import type { CommitGraphLayout } from './layoutCommitGraph.js';
import { orderCommits } from './orderCommits.js';

/** How many commits of an unjoined branch the first round reads, and each deeper one (git-client D9). */
const FIRST_JOIN_PAGE = 20;
const DEEPER_JOIN_PAGE = 50;
/** How many rounds a branch is followed down before its lane is left to continue off the bottom. */
const JOIN_ROUNDS = 3;
/** How many commits scrolling down reads at a time. */
const MORE_PAGE = 100;
/** The most ids GitHub takes in one `nodes(ids:)`. */
const MAX_IDS = 100;
/** How long a commit's pull request and CI state, or its checks, are used before they are read again. */
const STATES_TTL_MS = 60_000;
/**
 * How long after GitHub failed a graph's refs check it is checked again by itself, as its note says (first run and
 * loading D12).
 */
const FAILED_CHECK_RETRY_MS = 30_000;
/** How long the rows asking for their state are gathered into one request. */
const STATES_BATCH_MS = 50;

/** A repository's commit graph as the view draws it; every field changes only with a new object. */
export interface CommitGraph {
    /** The branches and tags as last read, `null` until they first are. */
    readonly refs: KeptCommitRefs | null;
    /**
     * The commits shown, in `git log --date-order` (`orderCommits`): the loaded commits reachable from the current
     * refs through loaded parents — a force-pushed or deleted branch's old commits are not.
     */
    readonly commits: readonly KeptCommit[];
    /** The lanes of {@link commits}, row by row. */
    readonly layout: CommitGraphLayout;
    /**
     * The whole history is shown: every branch is read, its tip is loaded and no shown commit has a parent left to
     * read.
     */
    readonly endReached: boolean;
    /** Scrolling down is reading the next page ({@link CommitGraphStore} `loadMore`). */
    readonly loadingMore: boolean;
    /** Branches whose tips were not loaded are being read down to the loaded history (git-client D19). */
    readonly joining: boolean;
    /**
     * How current the refs are, for the status bar (githq D15): `partial` (reading commits, first run and loading D14) until first read, `checking` while read again,
     * `filling` while a first open's branches are read down (git-client D19), `fresh` once GitHub answered, `stale` when it did not, `paused` when the allowance was spent.
     */
    readonly freshness: Freshness;
}

/** A repository's graph within a session. */
interface RepositoryGraph {
    /** The session it is read for. */
    readonly session: Session;
    readonly nameWithOwner: string;
    /** Every commit loaded, shown or not, by oid. */
    readonly commits: Map<string, KeptCommit>;
    refs: KeptCommitRefs | null;
    /** {@link refs} list every branch: the kept ones do, and those being read once their last page came. */
    branchesRead: boolean;
    /**
     * Where each branch was last drawn from, by name: a branch that moved to a commit not loaded yet goes on being
     * drawn from there until its new commits arrive, so an open draws without waiting (git-client D9).
     */
    drawnTips: ReadonlyMap<string, string>;
    /** Resolves once the kept copy is in memory; never rejects. */
    ready: Promise<void>;
    /** The refs check under way, joining included; `null` when none is. */
    refreshing: Promise<void> | null;
    /** The refs request is out. */
    checking: boolean;
    /** When the refs were last read in this session (epoch ms). */
    checkedAt: number | null;
    /**
     * Why the last refs check, or the joining after it, failed; `null` when it did not. Kept while the next check runs,
     * until GitHub answers it, so what stood in the way is told until it no longer does.
     */
    problem: GraphProblem | null;
    /** The last refs check, or the joining after it, was not sent: the allowance is spent until then. Kept as `problem`. */
    pausedUntil: number | null;
    /** The check GitHub failing or the allowance asked for by itself; cancels it. */
    cancelRetry: (() => void) | null;
    /** Why the last older page failed; apart from {@link problem}, for a good page says nothing of the refs. */
    moreProblem: GraphProblem | null;
    /** The last older page was refused: the allowance is spent until then. */
    morePausedUntil: number | null;
    joining: boolean;
    /** A first open's branches being read down to the loaded history, and how many of them are (git-client D19). */
    filling: { readonly done: number; readonly total: number } | null;
    /** The `loadMore` under way. */
    more: Promise<void> | null;
    /** The shown commits and their layout, computed once per change of the commits or refs. */
    shown: ShownGraph;
}

interface ShownGraph {
    readonly commits: readonly KeptCommit[];
    readonly layout: CommitGraphLayout;
    /** The parent not loaded whose child is the newest — where scrolling down reads from; `null` at the end. */
    readonly frontier: CommitParent | null;
}

/** A commit's state as read, and when. */
interface ReadState {
    readonly state: CommitState;
    readonly readAt: number;
}

/** The signed-in user the graphs are read for, captured when they signed in. */
interface Session {
    readonly account: Account;
    /** By `owner/name`. */
    readonly graphs: Map<string, RepositoryGraph>;
    /** The commits waiting to be asked for their state, each oid by its commit id, by `owner/name`. */
    readonly pendingStates: Map<string, Map<string, string>>;
    /** The oids whose state is being read, by `owner/name`. */
    readonly statesInFlight: Map<string, Set<string>>;
    /** The oids whose checks are being read, by `owner/name`. */
    readonly checksInFlight: Map<string, Set<string>>;
    /** Where the section was left for a run's page, by `owner/name`; in memory alone, gone with the session. */
    readonly places: Map<string, CommitGraphPlace>;
    /** How many views show each graph, by `owner/name` ({@link CommitGraphStore} `hold`); absent when none does. */
    readonly onScreen: Map<string, number>;
    cancelStatesBatch: (() => void) | null;
}

/**
 * The commit graphs of the repositories the signed-in user opens the Commits section of (git-client D9), in any
 * repository they can see, tracked or not (D11). Nothing is read in the background: a graph is read when it opens
 * ({@link open}) — and again by itself, while a view shows it ({@link hold}), once its check failed or waited for the
 * allowance, and when the connection comes back (first run and loading D12) — and scrolls down ({@link loadMore}), the rows on screen ask for their pull request and CI
 * state ({@link ensureStates}, D8), and a commit whose details open asks for its full message ({@link ensureDetail},
 * D13) and its checks ({@link ensureChecks}).
 *
 * Commits and refs are kept in the user's local copy for good, so a graph opened before draws at once; the refs
 * are then read again and the branches that moved to commits not loaded are read down to the loaded history, as soon
 * as the branches are read, while the remaining pages of tags still are.
 * Pull request and CI state, checks and details are kept in memory only, and a commit read for its details never joins the
 * graph (D12).
 *
 * Like the other stores it follows the signed-in user: their graphs leave memory when they sign out or another
 * user signs in, and an answer arriving for a session that ended is dropped, never kept or shown.
 */
export type CommitGraphStore = Resolved<typeof CommitGraphStore>;
export const CommitGraphStore = defineService({
    name: 'CommitGraphStore',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        persistence: CommitPersistence,
        rateLimits: GitHubRateLimitStore,
        browser: Browser,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, items, persistence, rateLimits, browser, clock, logger }) {
        const graphsRef = shallowRef<ReadonlyMap<string, CommitGraph>>(new Map());
        const statesRef = shallowRef<ReadonlyMap<string, ReadonlyMap<string, ReadState>>>(new Map());
        const detailsRef = shallowRef<ReadonlyMap<string, ReadonlyMap<string, CommitDetailRead>>>(new Map());
        const checksRef = shallowRef<ReadonlyMap<string, ReadonlyMap<string, CommitChecksRead>>>(new Map());

        let session: Session | null = null;

        accounts.onChange(follow);
        browser.onOnlineChange(reopenOffline);

        return {
            get,
            getFreshness,
            getState,
            getCommit,
            getCommitPlace,
            getDetail,
            getChecks,
            open,
            hold,
            loadMore,
            ensureStates,
            ensureDetail,
            ensureChecks,
            setPlace,
            takePlace,
        };

        /** The graph of `owner/name`, or `undefined` until {@link open} brought its kept copy; reactive. */
        function get(nameWithOwner: string): CommitGraph | undefined {
            return graphsRef.value.get(nameWithOwner);
        }

        /** How current the graph of `owner/name` is (see {@link CommitGraph.freshness}); reactive. */
        function getFreshness(nameWithOwner: string): Freshness {
            return graphsRef.value.get(nameWithOwner)?.freshness ?? { kind: 'partial', readingCommits: true };
        }

        /**
         * The pull request and CI state of the commit `oid` of `owner/name` as last read — `undefined` while it is
         * not known yet, unlike a commit that has neither (D18). Reactive.
         */
        function getState(nameWithOwner: string, oid: string): CommitState | undefined {
            return statesRef.value.get(nameWithOwner)?.get(oid)?.state;
        }

        /** The commit `oid` of `owner/name` as known: loaded, shown or not, or read for its details; reactive. */
        function getCommit(nameWithOwner: string, oid: string): KeptCommit | undefined {
            const read = getDetail(nameWithOwner, oid);
            return findLoadedCommit(nameWithOwner, oid) ?? (read?.kind === 'read' ? read.commit : undefined);
        }

        /** Where the commit `oid` of `owner/name` stands with the graph; reactive. */
        function getCommitPlace(nameWithOwner: string, oid: string): CommitPlace {
            if (graphsRef.value.get(nameWithOwner)?.commits.some(commit => commit.oid === oid)) {
                return 'shown';
            }

            return findLoadedCommit(nameWithOwner, oid) ? 'gone' : 'notLoaded';
        }

        /** What is known of the details of the commit `oid` of `owner/name`; `undefined` until asked for. Reactive. */
        function getDetail(nameWithOwner: string, oid: string): CommitDetailRead | undefined {
            return detailsRef.value.get(nameWithOwner)?.get(oid);
        }

        /** What is known of the checks of the commit `oid` of `owner/name`; `undefined` until asked for. Reactive. */
        function getChecks(nameWithOwner: string, oid: string): CommitChecksRead | undefined {
            return checksRef.value.get(nameWithOwner)?.get(oid);
        }

        /**
         * Opens the graph of `owner/name`: its kept copy at once (the first time in the session), then its refs read
         * again in the background — every time it opens, one cheap request (git-client D9) — and the branches that
         * moved read down to the loaded history. While that runs, opening it again waits for the same. Resolves when
         * it is done; never rejects.
         */
        function open(nameWithOwner: string): Promise<void> {
            const current = session;
            if (!current) {
                return Promise.resolve();
            }

            let graph = current.graphs.get(nameWithOwner);
            if (!graph) {
                graph = createGraph(current, nameWithOwner);
                current.graphs.set(nameWithOwner, graph);
                graph.ready = readKept(graph);
            }

            if (graph.refreshing) {
                return graph.refreshing;
            }

            const refreshing = refresh(graph).finally(() => {
                graph.refreshing = null;
                // A reconnect while this ran found nothing to start. With the allowance spent the retry would send
                // nothing and clear nothing, and come straight back here; a retry that sends fails as `failing` online.
                if (rateLimits.remaining('graphql') !== 0) {
                    reopenOffline();
                }
            });
            graph.refreshing = refreshing;
            return refreshing;
        }

        /**
         * Marks the graph of `owner/name` as shown until the returned function is called. Only a shown graph is read
         * again by itself — after a failure, a pause or a reconnect — so a repository left asks GitHub nothing more;
         * the last release drops its retry, and showing it again opens it anyway.
         */
        function hold(nameWithOwner: string): () => void {
            const current = session;
            if (!current) {
                return () => {};
            }

            current.onScreen.set(nameWithOwner, (current.onScreen.get(nameWithOwner) ?? 0) + 1);
            let released = false;
            return () => {
                if (released || session !== current) {
                    return;
                }

                released = true;
                const count = (current.onScreen.get(nameWithOwner) ?? 1) - 1;
                if (count > 0) {
                    current.onScreen.set(nameWithOwner, count);
                    return;
                }

                current.onScreen.delete(nameWithOwner);
                const graph = current.graphs.get(nameWithOwner);
                graph?.cancelRetry?.();
                if (graph) {
                    graph.cancelRetry = null;
                }
            };
        }

        /**
         * Reads the next page of history below the shown graph — from the parent not loaded whose child is the
         * newest — and shows it. One at a time; nothing once the end is reached. Never rejects.
         */
        function loadMore(nameWithOwner: string): Promise<void> {
            const current = session;
            const graph = current?.graphs.get(nameWithOwner);
            if (!current || !graph) {
                return Promise.resolve();
            }

            if (graph.more) {
                return graph.more;
            }

            const frontier = graph.shown.frontier;
            if (!frontier || rateLimits.remaining('graphql') === 0) {
                return Promise.resolve();
            }

            const more = readMore(graph, frontier).finally(() => {
                graph.more = null;
                if (isCurrent(current)) {
                    publish(graph);
                }
            });
            graph.more = more;
            publish(graph);
            return more;
        }

        /**
         * Asks for the pull request and CI state of `commits` of `owner/name` — those not known, or read over a minute
         * ago — gathering the calls of a short moment into requests of up to 100. They need not be loaded (D12).
         */
        function ensureStates(nameWithOwner: string, commits: readonly CommitParent[]) {
            const current = session;
            if (!current) {
                return;
            }

            const read = statesRef.value.get(nameWithOwner);
            const inFlight = current.statesInFlight.get(nameWithOwner);
            const pending = current.pendingStates.get(nameWithOwner) ?? new Map<string, string>();
            for (const { oid, id } of commits) {
                const state = read?.get(oid);
                if ((state && clock.now() - state.readAt < STATES_TTL_MS) || inFlight?.has(oid)) {
                    continue;
                }

                pending.set(id, oid);
            }

            if (pending.size === 0) {
                return;
            }

            current.pendingStates.set(nameWithOwner, pending);
            current.cancelStatesBatch ??= clock.schedule(() => {
                current.cancelStatesBatch = null;
                sendStates(current);
            }, STATES_BATCH_MS);
        }

        /**
         * Asks for the details of `commit` of `owner/name` — once a session, for a commit never changes — and keeps them
         * apart from the graph. Asked again only after a read that failed. With the allowance spent nothing is sent and
         * it reads as failed, for the panel not to wait for good.
         */
        function ensureDetail(nameWithOwner: string, commit: CommitParent) {
            const current = session;
            const known = getDetail(nameWithOwner, commit.oid);
            if (!current || known?.kind === 'read' || known?.kind === 'reading') {
                return;
            }

            if (rateLimits.remaining('graphql') === 0) {
                setDetail(nameWithOwner, commit.oid, { kind: 'failed' });
                return;
            }

            setDetail(nameWithOwner, commit.oid, { kind: 'reading' });
            void readDetail(current, nameWithOwner, commit);
        }

        /**
         * Asks for the checks of `commit` of `owner/name`, at most once a minute, a read that failed included. A commit
         * known to have none is not asked; one whose state is not known yet is, for nothing would ask again once it is.
         * With the allowance spent nothing is sent, and with no list to keep it reads as failed, for the panel not to
         * wait for good.
         */
        function ensureChecks(nameWithOwner: string, commit: CommitParent) {
            const current = session;
            if (
                !current ||
                getState(nameWithOwner, commit.oid)?.ci === null ||
                current.checksInFlight.get(nameWithOwner)?.has(commit.oid)
            ) {
                return;
            }

            const known = getChecks(nameWithOwner, commit.oid);
            if (known && clock.now() - known.readAt < STATES_TTL_MS) {
                return;
            }

            if (rateLimits.remaining('graphql') === 0) {
                if (known?.kind !== 'read') {
                    setChecks(nameWithOwner, commit.oid, { kind: 'failed', readAt: clock.now() });
                }

                return;
            }

            void readChecks(current, nameWithOwner, commit);
        }

        /** Keeps where the Commits section of `owner/name` was left for a run's page, in place of any kept before. */
        function setPlace(nameWithOwner: string, place: CommitGraphPlace) {
            session?.places.set(nameWithOwner, place);
        }

        /** Where the Commits section of `owner/name` was left, if it was; used once, for it is forgotten here. */
        function takePlace(nameWithOwner: string): CommitGraphPlace | undefined {
            const place = session?.places.get(nameWithOwner);
            session?.places.delete(nameWithOwner);
            return place;
        }

        /** Another account signed in, or none: the graphs of whoever was before leave memory. */
        function follow(account: Account | null) {
            session?.cancelStatesBatch?.();
            for (const graph of session?.graphs.values() ?? []) {
                graph.cancelRetry?.();
            }

            session = null;
            graphsRef.value = new Map();
            statesRef.value = new Map();
            detailsRef.value = new Map();
            checksRef.value = new Map();
            if (!account) {
                return;
            }

            session = {
                account,
                graphs: new Map(),
                pendingStates: new Map(),
                statesInFlight: new Map(),
                checksInFlight: new Map(),
                places: new Map(),
                onScreen: new Map(),
                cancelStatesBatch: null,
            };
        }

        /** The connection came back: the shown graphs that could not be read for want of it are read again. */
        function reopenOffline() {
            if (!session || !browser.isOnline()) {
                return;
            }

            for (const [nameWithOwner, graph] of session.graphs) {
                if (!session.onScreen.has(nameWithOwner)) {
                    continue;
                }

                if (graph.problem === 'offline' || graph.moreProblem === 'offline') {
                    void open(nameWithOwner);
                }
            }
        }

        function createGraph(current: Session, nameWithOwner: string): RepositoryGraph {
            return {
                session: current,
                nameWithOwner,
                commits: new Map(),
                refs: null,
                branchesRead: false,
                drawnTips: new Map(),
                ready: Promise.resolve(),
                refreshing: null,
                checking: false,
                checkedAt: null,
                problem: null,
                pausedUntil: null,
                cancelRetry: null,
                moreProblem: null,
                morePausedUntil: null,
                joining: false,
                filling: null,
                more: null,
                shown: { commits: [], layout: { rows: [], maxWidth: 0, hasMainLane: false }, frontier: null },
            };
        }

        /** Puts the kept commits and refs into memory, once the item store opened the copy, and shows them. */
        async function readKept(graph: RepositoryGraph) {
            const current = graph.session;
            await items.ready();
            if (!isCurrent(current)) {
                return;
            }

            let persisted: PersistedCommits = { commits: [], refs: null };
            try {
                persisted = await persistence.loadCommits(current.account.login, graph.nameWithOwner);
            } catch (error) {
                logger.warn('Could not read the kept commits; reading them again from GitHub', { error });
            }

            if (!isCurrent(current)) {
                return;
            }

            for (const commit of persisted.commits) {
                if (!graph.commits.has(commit.oid)) {
                    graph.commits.set(commit.oid, commit);
                }
            }

            graph.refs ??= persisted.refs;
            graph.branchesRead = persisted.refs !== null;
            regraph(graph);
        }

        /**
         * Reads the refs again, unless the allowance is spent. What stood in the way of the last check stays until
         * GitHub answers this one ({@link readRefs}).
         */
        async function refresh(graph: RepositoryGraph) {
            await graph.ready;
            if (!isCurrent(graph.session)) {
                return;
            }

            graph.cancelRetry?.();
            graph.cancelRetry = null;
            if (rateLimits.remaining('graphql') === 0) {
                pause(graph);
                return;
            }

            graph.checking = true;
            publish(graph);
            await readRefs(graph);
        }

        /**
         * Reads every branch and tag, replacing the kept ones, and joins the branches whose tips are not loaded. One
         * request brings the default branch, the first page of both lists and on a first open the default branch's
         * first page of history, shown at once. The remaining pages of branches come next: with the last of them the
         * branches are shown and joined, the old tags kept and the old date too, for a page of tags that fails must
         * not claim the refs are fresh. Only the remaining pages of tags complete the refs, which are then kept.
         * Resolves when the joining is done too; never rejects.
         */
        async function readRefs(graph: RepositoryGraph) {
            const current = graph.session;
            let joined: Promise<void> | null = null;
            const firstOpen = graph.refs === null || graph.commits.size === 0;
            try {
                const first = await readRefsPage(graph, {
                    withHistory: firstOpen,
                    withBranches: true,
                    withTags: true,
                });
                if (!first) {
                    return;
                }

                // GitHub answered: what stood in the way of the last check, or of an older page, no longer does.
                graph.problem = null;
                graph.pausedUntil = null;
                graph.moreProblem = null;
                graph.morePausedUntil = null;

                const target = first.defaultBranchRef?.target;
                if (target && 'history' in target && target.history) {
                    keepCommits(graph, toKeptCommits(graph.nameWithOwner, target.history.nodes));
                }

                const defaultBranch = first.defaultBranchRef?.name ?? null;
                // The first pages of branches may not reach the default branch: it is shown, and joined, all the same.
                const defaultRef = toCommitRefs([first.defaultBranchRef])[0] ?? null;
                const branches = toCommitRefs(first.branches?.nodes);
                const tags = toCommitRefs(first.tags?.nodes);
                const before: KeptCommitRefs = graph.refs ?? {
                    repository: graph.nameWithOwner,
                    defaultBranch,
                    branches: withDefaultBranch(branches, defaultRef),
                    tags: [...tags],
                    fetchedAt: clock.now(),
                };
                if (graph.refs === null) {
                    graph.refs = before;
                    regraph(graph);
                }

                let branchesInfo = first.branches?.pageInfo;
                while (branchesInfo?.hasNextPage) {
                    const page = await readRefsPage(graph, {
                        withBranches: true,
                        branchesAfter: branchesInfo.endCursor,
                    });
                    if (!page) {
                        return;
                    }

                    branches.push(...toCommitRefs(page.branches?.nodes));
                    branchesInfo = page.branches?.pageInfo;
                }

                const allBranches: KeptCommitRefs = {
                    ...before,
                    defaultBranch,
                    branches: withDefaultBranch(branches, defaultRef),
                };
                graph.drawnTips = toDrawnTips(graph);
                graph.refs = allBranches;
                graph.branchesRead = true;
                regraph(graph);
                joined = join(graph, allBranches.branches, firstOpen);

                let tagsInfo = first.tags?.pageInfo;
                while (tagsInfo?.hasNextPage) {
                    const page = await readRefsPage(graph, { withTags: true, tagsAfter: tagsInfo.endCursor });
                    if (!page) {
                        return;
                    }

                    tags.push(...toCommitRefs(page.tags?.nodes));
                    tagsInfo = page.tags?.pageInfo;
                }

                const refs: KeptCommitRefs = { ...allBranches, tags, fetchedAt: clock.now() };
                graph.refs = refs;
                graph.checkedAt = refs.fetchedAt;
                regraph(graph);
                persistence.saveCommitRefs(current.account.login, refs).catch((error: unknown) => {
                    logger.warn('Could not keep branches and tags', { error });
                });
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Branches and tags could not be read', { nameWithOwner: graph.nameWithOwner, error });
                    noteFailure(graph, error);
                }
            } finally {
                graph.checking = false;
            }

            if (isCurrent(current)) {
                publish(graph);
                await joined;
            }
        }

        /**
         * One `RepositoryCommitRefs` request for what `page` names, nothing else. `null` for a session that ended;
         * rejects when GitHub does not answer or does not show the repository.
         */
        async function readRefsPage(graph: RepositoryGraph, page: RefsPage): Promise<ReadRepository | null> {
            const answer = await graph.session.account.sdk.RepositoryCommitRefs({
                ...parseRepositoryName(graph.nameWithOwner),
                withHistory: false,
                withBranches: false,
                withTags: false,
                branchesAfter: null,
                tagsAfter: null,
                ...page,
            });
            if (!isCurrent(graph.session)) {
                return null;
            }

            if (!answer.repository) {
                throw new Error(`Repository ${graph.nameWithOwner} not found`);
            }

            return answer.repository;
        }

        /**
         * Reads the branches whose tips are not loaded down to the loaded history: a short stretch of each in one
         * request, then deeper — from the oldest commit read — only for those that met no loaded commit, for a few
         * rounds. A branch still not joined then continues off the bottom; scrolling down fills it in.
         */
        async function join(graph: RepositoryGraph, branches: readonly CommitRef[], firstOpen: boolean) {
            const tips = new Set<string>();
            for (const branch of branches) {
                if (!graph.commits.has(branch.oid)) {
                    tips.add(branch.commitId);
                }
            }

            let ids = [...tips];
            if (ids.length === 0) {
                return;
            }

            graph.joining = true;
            const total = ids.length;
            graph.filling = firstOpen ? { done: 0, total } : null;
            publish(graph);
            try {
                for (let round = 0; round < JOIN_ROUNDS && ids.length > 0; round++) {
                    if (rateLimits.remaining('graphql') === 0) {
                        pause(graph);
                        return;
                    }

                    const loadedBefore = new Set(graph.commits.keys());
                    const pages = await readHistories(graph, {
                        ids,
                        first: round === 0 ? FIRST_JOIN_PAGE : DEEPER_JOIN_PAGE,
                    });
                    if (!pages) {
                        return;
                    }

                    keepCommits(graph, pages.flat());
                    const next = new Set<string>();
                    for (const page of pages) {
                        if (page.some(commit => loadedBefore.has(commit.oid))) {
                            continue;
                        }

                        for (const parent of page.at(-1)?.parents ?? []) {
                            if (!graph.commits.has(parent.oid)) {
                                next.add(parent.id);
                            }
                        }
                    }

                    ids = [...next];
                    if (graph.filling) {
                        // A merge at the bottom of a page leaves more to follow than it took: what is done stays done.
                        graph.filling = { done: Math.max(graph.filling.done, total - ids.length), total };
                        publish(graph);
                    }
                }
            } catch (error) {
                if (isCurrent(graph.session)) {
                    logger.warn('Branches could not be read down to the loaded history', {
                        nameWithOwner: graph.nameWithOwner,
                        error,
                    });
                    noteFailure(graph, error);
                }
            } finally {
                graph.filling = null;
                graph.joining = false;
                if (isCurrent(graph.session)) {
                    publish(graph);
                }
            }
        }

        async function readMore(graph: RepositoryGraph, frontier: CommitParent) {
            try {
                const pages = await readHistories(graph, { ids: [frontier.id], first: MORE_PAGE });
                if (!pages) {
                    return;
                }

                // GitHub answered: an older page failing before no longer holds. A refs check failing still does.
                graph.moreProblem = null;
                graph.morePausedUntil = null;
                keepCommits(graph, pages[0] ?? []);
            } catch (error) {
                if (isCurrent(graph.session)) {
                    logger.warn('More history could not be read', { nameWithOwner: graph.nameWithOwner, error });
                    const failure = readFailure(error);
                    graph.moreProblem = failure.problem;
                    graph.morePausedUntil = failure.pausedUntil;
                }
            }
        }

        /**
         * The history below each of `ids` (`CommitHistories`, up to 100 ids a request), in their order — empty for
         * one GitHub gives none. `null` for a session that ended; rejects when GitHub does not answer.
         */
        async function readHistories(
            graph: RepositoryGraph,
            params: ReadHistoriesParams,
        ): Promise<KeptCommit[][] | null> {
            const answers = await Promise.all(
                splitIntoChunks(params.ids, MAX_IDS).map(ids =>
                    graph.session.account.sdk.CommitHistories({ ids, first: params.first }),
                ),
            );
            if (!isCurrent(graph.session)) {
                return null;
            }

            const pages: KeptCommit[][] = [];
            for (const answer of answers) {
                for (const node of answer.nodes) {
                    pages.push(node && 'history' in node ? toKeptCommits(graph.nameWithOwner, node.history.nodes) : []);
                }
            }

            return pages;
        }

        /** Adds the commits not loaded yet to the graph, shows them, and keeps them. */
        function keepCommits(graph: RepositoryGraph, commits: readonly KeptCommit[]) {
            const added: KeptCommit[] = [];
            for (const commit of commits) {
                if (!graph.commits.has(commit.oid)) {
                    graph.commits.set(commit.oid, commit);
                    added.push(commit);
                }
            }

            if (added.length === 0) {
                return;
            }

            regraph(graph);
            persistence.saveCommits(graph.session.account.login, added).catch((error: unknown) => {
                logger.warn('Could not keep commits; they are read again from GitHub next time', { error });
            });
        }

        /** Sends the oids waiting for their state, per repository, in requests of up to 100. */
        function sendStates(current: Session) {
            if (!isCurrent(current)) {
                return;
            }

            const pending = [...current.pendingStates];
            current.pendingStates.clear();
            if (rateLimits.remaining('graphql') === 0) {
                return;
            }

            for (const [nameWithOwner, oids] of pending) {
                for (const chunk of splitIntoChunks([...oids], MAX_IDS)) {
                    void readStates({ session: current, nameWithOwner, oids: new Map(chunk) });
                }
            }
        }

        /** Reads the state of the commits `oids` (by commit id); never rejects — those not read stay unknown. */
        async function readStates({ session: current, nameWithOwner, oids }: ReadStatesParams) {
            const inFlight = current.statesInFlight.get(nameWithOwner) ?? new Set<string>();
            current.statesInFlight.set(nameWithOwner, inFlight);
            for (const oid of oids.values()) {
                inFlight.add(oid);
            }

            try {
                const answer = await current.account.sdk.CommitStates({ ids: [...oids.keys()] });
                if (!isCurrent(current)) {
                    return;
                }

                const readAt = clock.now();
                const states = new Map(statesRef.value.get(nameWithOwner));
                for (const [index, oid] of [...oids.values()].entries()) {
                    states.set(oid, { state: toCommitState(answer.nodes[index] ?? null), readAt });
                }

                statesRef.value = new Map(statesRef.value).set(nameWithOwner, states);
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Pull request and CI state of commits could not be read', { nameWithOwner, error });
                }
            } finally {
                for (const oid of oids.values()) {
                    inFlight.delete(oid);
                }
            }
        }

        /** Reads a commit's details; never rejects — a read that fails says so. An ended session's answer is dropped. */
        async function readDetail(current: Session, nameWithOwner: string, { id, oid }: CommitParent) {
            let read: CommitDetailRead = { kind: 'failed' };
            try {
                const { node } = await current.account.sdk.CommitDetail({ id });
                if (isCommitNode(node)) {
                    const [commit] = toKeptCommits(nameWithOwner, [node]);
                    read = commit ? { kind: 'read', commit, ...splitMessage(node.message) } : read;
                }
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('The details of a commit could not be read', { nameWithOwner, error });
                }
            }

            if (isCurrent(current)) {
                setDetail(nameWithOwner, oid, read);
            }
        }

        function setDetail(nameWithOwner: string, oid: string, read: CommitDetailRead) {
            const details = new Map(detailsRef.value.get(nameWithOwner)).set(oid, read);
            detailsRef.value = new Map(detailsRef.value).set(nameWithOwner, details);
        }

        /**
         * Reads a commit's checks; never rejects. A failure leaves a list read before in place and says so otherwise; either
         * way it counts as a read for the minute. An ended session's answer is dropped.
         */
        async function readChecks(current: Session, nameWithOwner: string, { id, oid }: CommitParent) {
            const inFlight = current.checksInFlight.get(nameWithOwner) ?? new Set<string>();
            current.checksInFlight.set(nameWithOwner, inFlight);
            inFlight.add(oid);

            let answer: ReturnType<typeof toCommitChecks> = null;
            try {
                const { node } = await current.account.sdk.CommitChecks({ id });
                answer = toCommitChecks(node);
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('The checks of a commit could not be read', { nameWithOwner, error });
                }
            } finally {
                inFlight.delete(oid);
            }

            if (!isCurrent(current)) {
                return;
            }

            const now = clock.now();
            if (answer) {
                setChecks(nameWithOwner, oid, { kind: 'read', ...answer, readAt: now });
                return;
            }

            const known = getChecks(nameWithOwner, oid);
            setChecks(
                nameWithOwner,
                oid,
                known?.kind === 'read' ? { ...known, readAt: now } : { kind: 'failed', readAt: now },
            );
        }

        function setChecks(nameWithOwner: string, oid: string, read: CommitChecksRead) {
            const checks = new Map(checksRef.value.get(nameWithOwner)).set(oid, read);
            checksRef.value = new Map(checksRef.value).set(nameWithOwner, checks);
        }

        /** The commit if loaded, shown or not; reactive, for every change of the loaded commits publishes the graph. */
        function findLoadedCommit(nameWithOwner: string, oid: string) {
            return graphsRef.value.has(nameWithOwner)
                ? session?.graphs.get(nameWithOwner)?.commits.get(oid)
                : undefined;
        }

        /** Computes the shown commits and their layout again — the commits or refs changed — and publishes them. */
        function regraph(graph: RepositoryGraph) {
            graph.shown = toShownGraph(graph);
            publish(graph);
        }

        /**
         * The allowance is spent, or GitHub asked to wait: says until when, publishes it, and checks the refs again
         * then by itself.
         */
        function pause(graph: RepositoryGraph, until = rateLimits.get('graphql')?.resetAt.getTime() ?? clock.now()) {
            graph.problem = null;
            graph.pausedUntil = until;
            retryLater(graph, until - clock.now());
            publish(graph);
        }

        /**
         * Says why the refs check, or the joining after it, failed: GitHub refusing for the rate is a pause. GitHub
         * failing is asked again by itself; offline waits for the connection ({@link reopenOffline}), a repository
         * GitHub doesn't show for the user to open again.
         */
        function noteFailure(graph: RepositoryGraph, error: unknown) {
            const failure = readFailure(error);
            if (failure.pausedUntil !== null) {
                pause(graph, failure.pausedUntil);
                return;
            }

            graph.problem = failure.problem;
            graph.pausedUntil = null;
            if (failure.problem === 'failing') {
                retryLater(graph, FAILED_CHECK_RETRY_MS);
            }
        }

        /** Checks the graph's refs again in `delayMs`, once, if it is shown: an earlier such check is dropped. */
        function retryLater(graph: RepositoryGraph, delayMs: number) {
            graph.cancelRetry?.();
            graph.cancelRetry = null;
            if (!graph.session.onScreen.has(graph.nameWithOwner)) {
                return;
            }

            graph.cancelRetry = clock.schedule(
                () => {
                    graph.cancelRetry = null;
                    if (isCurrent(graph.session)) {
                        void open(graph.nameWithOwner);
                    }
                },
                Math.max(0, delayMs),
            );
        }

        /** What a read's failure says: GitHub refusing for the rate is a pause, anything else a problem. */
        function readFailure(error: unknown): ReadFailure {
            const refusal = getRefusalPause({ error, limits: [rateLimits.get('graphql')], now: clock.now() });
            return refusal
                ? { problem: null, pausedUntil: refusal.until }
                : { problem: readProblem(error), pausedUntil: null };
        }

        function readProblem(error: unknown): GraphProblem {
            if (isGitHubNotFound(error)) {
                return 'hidden';
            }

            return browser.isOnline() ? 'failing' : 'offline';
        }

        /** Publishes the graph's state for the view. */
        function publish(graph: RepositoryGraph) {
            const { shown, refs } = graph;
            const view: CommitGraph = {
                refs,
                commits: shown.commits,
                layout: shown.layout,
                // A branch not read yet, or left unjoined — its read failed or the allowance ran out — has history yet
                // to show.
                endReached:
                    refs !== null &&
                    graph.branchesRead &&
                    shown.frontier === null &&
                    refs.branches.every(branch => graph.commits.has(branch.oid)),
                loadingMore: graph.more !== null,
                joining: graph.joining,
                freshness: toFreshness(graph, clock.now()),
            };
            graphsRef.value = new Map(graphsRef.value).set(graph.nameWithOwner, view);
        }

        /** Whether `current` is still the session — here and in the store every request was authorised by. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }
    },
});

/** What a `RepositoryCommitRefs` request asks for; what it does not name, it does not. */
type RefsPage = Partial<Omit<RepositoryCommitRefsQueryVariables, 'owner' | 'name'>>;

/** The repository as a `RepositoryCommitRefs` request answers it. */
type ReadRepository = NonNullable<RepositoryCommitRefsQuery['repository']>;

/** Why GitHub gave no answer; `hidden`: it doesn't show the repository, or the repository is gone. */
type GraphProblem = 'offline' | 'failing' | 'hidden';

/** What a read's failure says; one of the two is set. */
interface ReadFailure {
    readonly problem: GraphProblem | null;
    readonly pausedUntil: number | null;
}

/** The parameters of a `CommitHistories` read. */
interface ReadHistoriesParams {
    readonly ids: readonly string[];
    /** How many commits below each. */
    readonly first: number;
}

/**
 * What the status bar and the section say of the graph. What stood in the way of the last check is told while the next
 * one runs, until GitHub answers it, rather than "Reading commits" in between.
 */
function toFreshness(graph: RepositoryGraph, now: number): Freshness {
    if (graph.filling) {
        return { kind: 'filling', ...graph.filling };
    }

    const since = graph.refs?.fetchedAt ?? null;
    const pausedUntil = Math.max(graph.pausedUntil ?? 0, graph.morePausedUntil ?? 0);
    if (pausedUntil > now) {
        return { kind: 'paused', since, until: pausedUntil };
    }

    const problem = graph.problem ?? graph.moreProblem;
    if (problem === 'hidden') {
        return { kind: 'stale', since, reason: 'hidden', of: 'repository' };
    }

    if (problem) {
        return { kind: 'stale', since, reason: problem };
    }

    if (graph.checking) {
        return since === null ? { kind: 'partial', readingCommits: true } : { kind: 'checking', since };
    }

    if (graph.checkedAt !== null) {
        return { kind: 'fresh', checkedAt: graph.checkedAt };
    }

    return since === null ? { kind: 'partial', readingCommits: true } : { kind: 'checking', since };
}

/** The parameters of a `CommitStates` read. */
interface ReadStatesParams {
    readonly session: Session;
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** The oids asked for, by commit id. */
    readonly oids: ReadonlyMap<string, string>;
}

/**
 * The loaded commits reachable from the refs through loaded parents, ordered and laid out, and the parent not
 * loaded whose child is the newest.
 */
/** Where each branch is drawn from now: its tip when that is loaded, else where it was drawn from before. */
function toDrawnTips(graph: RepositoryGraph): ReadonlyMap<string, string> {
    const tips = new Map<string, string>();
    for (const branch of graph.refs?.branches ?? []) {
        const tip = graph.commits.has(branch.oid) ? branch.oid : graph.drawnTips.get(branch.name);
        if (tip !== undefined) {
            tips.set(branch.name, tip);
        }
    }

    return tips;
}

function toShownGraph(graph: RepositoryGraph): ShownGraph {
    const reachable = new Map<string, KeptCommit>();
    const queue: string[] = [];
    for (const branch of graph.refs?.branches ?? []) {
        queue.push(graph.commits.has(branch.oid) ? branch.oid : (graph.drawnTips.get(branch.name) ?? branch.oid));
    }

    for (const tag of graph.refs?.tags ?? []) {
        queue.push(tag.oid);
    }

    let frontier: CommitParent | null = null;
    let frontierTime = -Infinity;
    for (let oid = queue.pop(); oid !== undefined; oid = queue.pop()) {
        const commit = graph.commits.get(oid);
        if (!commit || reachable.has(oid)) {
            continue;
        }

        reachable.set(oid, commit);
        for (const parent of commit.parents) {
            if (graph.commits.has(parent.oid)) {
                queue.push(parent.oid);
                continue;
            }

            const time = Date.parse(commit.committedDate);
            if (time > frontierTime) {
                frontier = parent;
                frontierTime = time;
            }
        }
    }

    const commits = orderCommits([...reachable.values()]);
    const main = graph.refs?.branches.find(branch => branch.name === graph.refs?.defaultBranch);
    const mainTip = main && (graph.commits.has(main.oid) ? main.oid : graph.drawnTips.get(main.name));
    return { commits, layout: layoutCommitGraph(commits, mainTip), frontier };
}

/** The branches read so far, with the default branch while its own page has not come yet. */
function withDefaultBranch(branches: readonly CommitRef[], defaultRef: CommitRef | null): CommitRef[] {
    return defaultRef && !branches.some(branch => branch.name === defaultRef.name)
        ? [...branches, defaultRef]
        : [...branches];
}

/** The commit a ref's target is — none for a tag whose target is not a commit. */
function toCommitRefs(nodes: readonly (CommitRefFieldsFragment | null)[] | null | undefined): CommitRef[] {
    const refs: CommitRef[] = [];
    for (const node of nodes ?? []) {
        const target = node?.target;
        if (!node || !target) {
            continue;
        }

        const commit = 'target' in target ? target.target : target;
        if ('oid' in commit && commit.oid) {
            refs.push({ name: node.name, oid: commit.oid, commitId: commit.id, committedDate: commit.committedDate });
        }
    }

    return refs;
}

function toKeptCommits(
    repository: string,
    nodes: readonly (CommitFieldsFragment | null)[] | null | undefined,
): KeptCommit[] {
    return filterNotNull(nodes ?? []).map(node => ({
        repository,
        oid: node.oid,
        id: node.id,
        headline: node.messageHeadline,
        committedDate: node.committedDate,
        author: {
            name: node.author?.name ?? null,
            login: node.author?.user?.login ?? null,
            avatarUrl: node.author?.user?.avatarUrl ?? null,
        },
        parents: filterNotNull(node.parents.nodes ?? []),
    }));
}

/**
 * Whether `node(id:)` answered with the commit asked for. A guard, not `'message' in node` where it is used: the
 * generated type's `Record<PropertyKey, never>` for any other node survives that test, and isn't a commit's fields.
 */
function isCommitNode(
    node: CommitDetailQuery['node'],
): node is Extract<NonNullable<CommitDetailQuery['node']>, { message: string }> {
    return node !== null && node !== undefined && 'message' in node;
}

/**
 * A commit's message as its author wrote it: its first line whole, and the rest. Not GitHub's `messageHeadline` and
 * `messageBody`, which cut a long first line and start the body with what they cut.
 */
function splitMessage(message: string) {
    const end = message.indexOf('\n');
    return end === -1
        ? { headline: message.trim(), body: '' }
        : { headline: message.slice(0, end).trim(), body: message.slice(end).trim() };
}

/** A commit's checks as read; `null` when GitHub gave no commit. A commit with no rollup has no checks. */
function toCommitChecks(node: CommitChecksQuery['node']) {
    if (!node || !('statusCheckRollup' in node)) {
        return null;
    }

    const page = node.statusCheckRollup?.contextPage;
    return {
        checks: mapNotNull(page?.nodes ?? [], context => context && toItemCheck(context)),
        checkCount: page?.totalCount ?? 0,
    };
}

/** A commit GitHub gave nothing for has neither a pull request nor checks. */
function toCommitState(node: CommitStatesQuery['nodes'][number]): CommitState {
    if (!node || !('id' in node)) {
        return { pullRequest: null, ci: null };
    }

    const pullRequest = node.associatedPullRequests?.nodes?.[0] ?? null;
    return {
        pullRequest: pullRequest && {
            number: pullRequest.number,
            state: pullRequest.state,
            title: pullRequest.title,
            url: pullRequest.url,
            isDraft: pullRequest.isDraft,
        },
        ci: node.statusCheckRollup?.state ?? null,
    };
}
