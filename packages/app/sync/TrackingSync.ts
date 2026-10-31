import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { getProjectConditional } from '@githq/github/rest/getProjectConditional.js';
import { listRepositoryIssuesSince } from '@githq/github/rest/listRepositoryIssuesSince.js';
import type { ProjectItemPageFieldsFragment } from '@githq/github/generated.gen.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { splitIntoChunks } from '@nzyme/utils/array/splitIntoChunks.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { Account } from '@/auth/AccountSession.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { toProject, toProjectItem } from '@/projects/toProject.js';
import type { ReadProjectItem } from '@/projects/toProject.js';
import { Clock } from '@/services/Clock.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { toItem } from '@/store/toItem.js';
import { TrackedItems } from '@/tracking/TrackedItems.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { REPOSITORY_DOWNLOAD_PHASES } from '@/tracking/TrackingTypes.js';
import type {
    ProjectSyncPatch,
    ProjectSyncState,
    RepositoryDownloadPhase,
    RepositorySyncPatch,
    RepositorySyncState,
    TrackedProject,
    TrackedRepository,
    TrackedSyncState,
    TrackedTarget,
} from '@/tracking/TrackingTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { isRateLimitRefusal } from './isRateLimitRefusal.js';
import { readItemsByIds } from './readItemsByIds.js';

/** The session a poll runs for, as the sync engine hands it over. */
export interface TrackingSyncContext {
    readonly account: Account;
    readonly rest: GitHubRestRequester;
    /** Whether the session is still the one signed in: an answer for one that ended is dropped. */
    isCurrent(): boolean;
    /** Throws `SyncPausedError` instead of asking GitHub while `bucket` is used up. */
    checkAllowance(bucket: string): void;
}

/**
 * How many pull requests one page of the first download reads: 100 with their status summary time out on big
 * repositories (measured on vitejs/vite).
 */
const PULL_REQUEST_PAGE_SIZE = 30;
/** How many items one page of a project's download or full re-read asks for (`ProjectFull` reads 100 too). */
const PROJECT_PAGE_SIZE = 100;
/**
 * How many items one page of a changed project's re-read asks for: GitHub charges for the items asked, not the
 * ones found — 20 cost 1 point, 100 cost 7 — and a change touches a few items.
 */
const CHANGED_PAGE_SIZE = 20;
/** How many node ids one `ItemsByIds` asks for. */
const NODES_BATCH_SIZE = 50;
/**
 * How far back of a poll's start the next change list asks from: a change GitHub stamps a little before the
 * browser's clock says (clock skew, a write still landing) is not missed. A wider window costs nothing while
 * nothing changes: the list's ETag is a hash of its body.
 */
const SINCE_SLACK_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
/** How long a change check GitHub refused (a lasting 4xx) waits before it is asked again. */
const REFUSED_RETRY_MS = 60 * 60_000;

/**
 * How often a project whose REST GitHub refuses is asked whether it changed through GraphQL instead: that costs a
 * point where the REST 304 was free.
 */
export const PROJECT_PROBE_INTERVAL_MS = 5 * 60_000;

/** The GraphQL states of a phase. */
const ISSUE_STATES = { openIssues: ['OPEN'], closedIssues: ['CLOSED'] } as const;
const PULL_REQUEST_STATES = { openPullRequests: ['OPEN'], closedPullRequests: ['CLOSED', 'MERGED'] } as const;

/**
 * Brings tracked repositories and projects into the local copy and keeps them in step with GitHub (D4, D7), as
 * three loops the sync engine runs, paces and pauses:
 *
 * - {@link download}: the first download, resumable page by page — every tracked repository's open items, then
 *   every tracked project, then the repositories' closed items (G6). "My work" comes before it.
 * - {@link pollRepositories}: each downloaded repository's changes since the last poll
 *   (`GET /repos/{o}/{r}/issues?since=` with the last ETag — a 304 is free); on a 200, only the items whose
 *   `updated_at` moved are read again (`ItemsByIds`).
 * - {@link pollProjects}: each downloaded project's REST ETag (a 304 is free); on a 200, its fields and views,
 *   and the items updated since the day before the last read (`updated:>=`, date granularity — D7). When the
 *   count of its items then differs from GitHub's (an item was removed), all of them are read again.
 *
 * A repository or project GitHub does not show (gone, or hidden by its organisation) is marked hidden and
 * skipped by the download; the polls keep asking about it, and it comes back when GitHub shows it again. One whose
 * change check GitHub refuses for a reason that lasts (a 403: an organisation the user is not in, or one
 * restricting OAuth Apps) is marked refused and asked again an hour later; meanwhile a project is asked through
 * GraphQL instead ({@link PROJECT_PROBE_INTERVAL_MS}), a repository's changes wait. Neither fails its loop: only
 * what may concern every target does (GitHub failing, a revoked token, the allowance).
 */
export type TrackingSync = Resolved<typeof TrackingSync>;
export const TrackingSync = defineService({
    name: 'TrackingSync',
    deps: {
        items: ItemStore,
        tracking: TrackingStore,
        projects: ProjectStore,
        trackedItems: TrackedItems,
        clock: Clock,
        logger: Logger,
    },
    setup({ items, tracking, projects, trackedItems, clock, logger }) {
        /** When each project in GraphQL's change check was last asked (epoch ms), in this session. */
        const probedAt = new Map<string, number>();

        return { hasDownloadWork, download, pollRepositories, pollProjects };

        /** Whether a tracked repository or project still waits for (part of) its first download; reactive. */
        function hasDownloadWork() {
            return (
                tracking.repositories.some(repo => getDownloadPhase(repo) !== null) ||
                tracking.projects.some(project => !isDownloaded(project))
            );
        }

        /**
         * Downloads what is left: the open items of each tracked repository, each tracked project, then the closed
         * items — page by page, each page's cursor written after its items, so another session goes on from it.
         */
        async function download(context: TrackingSyncContext) {
            for (const repo of tracking.repositories) {
                if (!(await downloadRepository(context, repo, ['openIssues', 'openPullRequests']))) {
                    return;
                }
            }

            for (const project of tracking.projects) {
                if (!(await downloadProject(context, project))) {
                    return;
                }
            }

            for (const repo of tracking.repositories) {
                if (!(await downloadRepository(context, repo, ['closedIssues', 'closedPullRequests']))) {
                    return;
                }
            }
        }

        /** Reads the repository's pages of `phases`; `false` when the session ended. */
        async function downloadRepository(
            context: TrackingSyncContext,
            repo: TrackedRepository,
            phases: readonly RepositoryDownloadPhase[],
        ) {
            const target = { kind: 'repository', nameWithOwner: repo.nameWithOwner } as const;
            for (;;) {
                let state = tracking.getSyncState(target);
                if (!state) {
                    // What changes while the download runs is picked up by the first poll after it.
                    await tracking.updateSyncState(target, {
                        since: new Date(clock.now() - SINCE_SLACK_MS).toISOString(),
                    });
                    state = tracking.getSyncState(target);
                }

                if (!context.isCurrent()) {
                    return false;
                }

                if (!state || state.hidden || state.phase === 'done' || !phases.includes(state.phase)) {
                    return true;
                }

                const next = await readRepositoryPage(context, state, state.phase);
                if (!context.isCurrent()) {
                    return false;
                }

                await tracking.updateSyncState(target, next);
                if (!context.isCurrent()) {
                    return false;
                }
            }
        }

        /** Reads the next page of the phase under way into the store; returns where the download goes on from. */
        async function readRepositoryPage(
            context: TrackingSyncContext,
            state: RepositorySyncState,
            phase: RepositoryDownloadPhase,
        ): Promise<RepositorySyncPatch> {
            const { owner, name } = parseRepositoryName(state.nameWithOwner);
            const { cursor } = state;
            const errors: GitHubGraphQLErrorEntry[] = [];
            const call = { onPartialErrors: (found: readonly GitHubGraphQLErrorEntry[]) => errors.push(...found) };

            context.checkAllowance('graphql');
            let page: ItemPage | null | undefined;
            switch (phase) {
                case 'openIssues':
                case 'closedIssues': {
                    const issues = (
                        await context.account.sdk.RepositoryIssues(
                            { owner, name, states: [...ISSUE_STATES[phase]], after: cursor },
                            call,
                        )
                    ).repository?.issues;
                    page = issues && { ...issues, items: filterNotNull(issues.nodes ?? []).map(node => toItem(node)) };
                    break;
                }
                case 'openPullRequests':
                case 'closedPullRequests': {
                    const pullRequests = (
                        await context.account.sdk.RepositoryPullRequests(
                            {
                                owner,
                                name,
                                states: [...PULL_REQUEST_STATES[phase]],
                                first: PULL_REQUEST_PAGE_SIZE,
                                after: cursor,
                            },
                            call,
                        )
                    ).repository?.pullRequests;
                    page = pullRequests && {
                        ...pullRequests,
                        items: filterNotNull(pullRequests.nodes ?? []).map(node => toItem(node)),
                    };
                    break;
                }
                default:
                    return assertNever(phase);
            }

            if (!page) {
                logger.warn('Tracked repository not shown by GitHub; its download waits', {
                    repository: state.nameWithOwner,
                    errors,
                });
                return { hidden: true };
            }

            if (errors.length > 0) {
                logger.warn('A page of a tracked repository read in part', { repository: state.nameWithOwner, errors });
            }

            const read = filterNotNull(page.items);
            if (isWanted(context, { kind: 'repository', nameWithOwner: state.nameWithOwner })) {
                items.upsertMany(read);
                // The items are on disk before the cursor that skips them.
                await items.flush();
            }

            const done = (state.counts[phase]?.done ?? 0) + read.length;
            const counts = { ...state.counts, [phase]: { done, total: page.totalCount } };
            const { hasNextPage, endCursor } = page.pageInfo;
            if (hasNextPage && endCursor !== null) {
                return { counts, cursor: endCursor };
            }

            const nextPhase = REPOSITORY_DOWNLOAD_PHASES[REPOSITORY_DOWNLOAD_PHASES.indexOf(phase) + 1] ?? 'done';
            return { counts, cursor: null, phase: nextPhase };
        }

        /** Reads the project's items not read yet; `false` when the session ended. */
        async function downloadProject(context: TrackingSyncContext, tracked: TrackedProject) {
            const target = { kind: 'project', id: tracked.id } as const;
            for (;;) {
                let state = tracking.getSyncState(target);
                if (!state) {
                    await tracking.updateSyncState(target, { readAt: clock.now() });
                    state = tracking.getSyncState(target);
                }

                if (!context.isCurrent()) {
                    return false;
                }

                if (!state || state.hidden || state.downloaded) {
                    return true;
                }

                const next = await readProjectPage(context, tracked, state);
                if (!context.isCurrent()) {
                    return false;
                }

                await tracking.updateSyncState(target, next);
                if (!context.isCurrent()) {
                    return false;
                }
            }
        }

        /** The project with its first page (`ProjectFull`), or the page after the cursor (`ProjectItems`). */
        async function readProjectPage(
            context: TrackingSyncContext,
            tracked: TrackedProject,
            state: ProjectSyncState,
        ): Promise<ProjectSyncPatch> {
            const errors: GitHubGraphQLErrorEntry[] = [];
            const call = { onPartialErrors: (found: readonly GitHubGraphQLErrorEntry[]) => errors.push(...found) };
            context.checkAllowance('graphql');

            let page: ProjectItemPageFieldsFragment;
            const fromStart = state.cursor === null || !projects.get(tracked.id);
            if (fromStart) {
                const { node } = await context.account.sdk.ProjectFull({ id: tracked.id }, call);
                if (!isPresent(node)) {
                    logger.warn('Tracked project not shown by GitHub; its download waits', {
                        project: tracked.id,
                        errors,
                    });
                    return { hidden: true };
                }

                if (isWanted(context, { kind: 'project', id: tracked.id })) {
                    projects.setProject(
                        toProject({
                            ...node,
                            owner: 'login' in node.owner ? node.owner.login : tracked.owner,
                            ownerKind: tracked.ownerKind,
                        }),
                    );
                }

                page = node.items;
            } else {
                const { node } = await context.account.sdk.ProjectItems(
                    { id: tracked.id, query: '', first: PROJECT_PAGE_SIZE, after: state.cursor },
                    call,
                );
                if (!isPresent(node)) {
                    return { hidden: true };
                }

                page = node.items;
            }

            if (errors.length > 0) {
                logger.warn('A page of a tracked project read in part', { project: tracked.id, errors });
            }

            const read = readProjectItems(tracked.id, page);
            if (isWanted(context, { kind: 'project', id: tracked.id })) {
                await keepProjectItems(read);
            }

            // Read from its first page, it counts from nothing, whatever an earlier attempt counted.
            const count = { done: (fromStart ? 0 : state.count.done) + read.length, total: page.totalCount };
            const { hasNextPage, endCursor } = page.pageInfo;
            return hasNextPage && endCursor !== null
                ? { count, cursor: endCursor }
                : { count, cursor: null, downloaded: true };
        }

        /**
         * Asks each downloaded repository what changed since the last poll, and reads again the items whose
         * `updated_at` moved. A repository GitHub answers 404 for is marked hidden, one it refuses otherwise is
         * marked refused (and asked again later); one failing otherwise is logged, the others go on, and the poll
         * fails at the end.
         */
        async function pollRepositories(context: TrackingSyncContext) {
            let failed = 0;
            for (const repo of tracking.repositories) {
                const target = { kind: 'repository', nameWithOwner: repo.nameWithOwner } as const;
                const state = tracking.getSyncState(target);
                if (!state?.since || isRefusedNow(state)) {
                    continue;
                }

                try {
                    await pollRepository(context, state);
                } catch (error) {
                    if (!isTargetFailure(error)) {
                        throw error;
                    }

                    if (error.status === 404) {
                        await tracking.updateSyncState(target, { hidden: true });
                    } else if (isLastingRefusal(error)) {
                        logger.warn('GitHub refuses the changes of a tracked repository; asking again later', {
                            repository: repo.nameWithOwner,
                            status: error.status,
                        });
                        await tracking.updateSyncState(target, { refused: { status: error.status, at: clock.now() } });
                    } else {
                        failed++;
                        logger.warn('A tracked repository could not be polled', {
                            repository: repo.nameWithOwner,
                            error,
                        });
                    }
                }

                if (!context.isCurrent()) {
                    return;
                }
            }

            if (failed > 0) {
                throw new Error(`${failed} tracked repositories could not be polled`);
            }
        }

        async function pollRepository(context: TrackingSyncContext, state: RepositorySyncState) {
            const { owner, name } = parseRepositoryName(state.nameWithOwner);
            const startedAt = clock.now();
            context.checkAllowance('core');
            const result = await listRepositoryIssuesSince(context.rest, {
                owner,
                name,
                since: state.since ?? new Date(startedAt).toISOString(),
                etag: state.etag ?? undefined,
            });
            if (!context.isCurrent()) {
                return;
            }

            const target = { kind: 'repository', nameWithOwner: state.nameWithOwner } as const;
            if (result.status === 304) {
                await tracking.updateSyncState(target, { hidden: false, refused: null, lastSuccessAt: clock.now() });
                return;
            }

            const changed: string[] = [];
            for (const hit of result.items) {
                if (items.getStored(hit.nodeId)?.updatedAt !== hit.updatedAt) {
                    changed.push(hit.nodeId);
                }
            }

            const removed = await readChangedItems(context, target, changed);
            if (!removed) {
                return;
            }

            logger.debug('Tracked repository polled', {
                repository: state.nameWithOwner,
                listed: result.items.length,
                reread: changed.length,
            });
            await tracking.updateSyncState(target, {
                hidden: false,
                refused: null,
                etag: result.etag ?? null,
                since: new Date(startedAt - SINCE_SLACK_MS).toISOString(),
                lastSuccessAt: clock.now(),
            });
        }

        /** Reads `ids` of `target` again in batches into the store; `false` when it is no longer wanted. */
        async function readChangedItems(context: TrackingSyncContext, target: TrackedTarget, ids: readonly string[]) {
            for (const batch of splitIntoChunks([...ids], NODES_BATCH_SIZE)) {
                context.checkAllowance('graphql');
                const { read, gone } = await readItemsByIds({ sdk: context.account.sdk, ids: batch, logger });
                if (!isWanted(context, target)) {
                    return false;
                }

                items.upsertMany(read);
                items.remove(gone);
            }

            return true;
        }

        /**
         * Asks each downloaded project whether it changed (free while it did not); a changed one has its fields,
         * views and recently updated items read again. One hidden before its first download finished is asked
         * whether GitHub shows it again. One whose REST GitHub refuses is asked through GraphQL instead, less often.
         */
        async function pollProjects(context: TrackingSyncContext) {
            let failed = 0;
            for (const tracked of tracking.projects) {
                const target = { kind: 'project', id: tracked.id } as const;
                const state = tracking.getSyncState(target);
                // One hidden during its first download is asked about too: shown again, its download goes on.
                if (!state || (!state.downloaded && !state.hidden)) {
                    continue;
                }

                try {
                    if (isRefusedNow(state)) {
                        await probeProject(context, tracked, state);
                    } else {
                        await pollProject(context, tracked, state);
                    }
                } catch (error) {
                    if (!isTargetFailure(error)) {
                        throw error;
                    }

                    if (error.status === 404) {
                        await tracking.updateSyncState(target, { hidden: true });
                    } else if (isLastingRefusal(error)) {
                        logger.warn('GitHub refuses a tracked project over REST; asking through GraphQL instead', {
                            project: tracked.id,
                            status: error.status,
                        });
                        await tracking.updateSyncState(target, { refused: { status: error.status, at: clock.now() } });
                    } else {
                        failed++;
                        logger.warn('A tracked project could not be polled', { project: tracked.id, error });
                    }
                }

                if (!context.isCurrent()) {
                    return;
                }
            }

            if (failed > 0) {
                throw new Error(`${failed} tracked projects could not be polled`);
            }
        }

        async function pollProject(context: TrackingSyncContext, tracked: TrackedProject, state: ProjectSyncState) {
            const startedAt = clock.now();
            context.checkAllowance('core');
            const result = await getProjectConditional(context.rest, {
                ownerKind: tracked.ownerKind,
                owner: tracked.owner,
                number: tracked.number,
                etag: state.etag ?? undefined,
            });
            if (!context.isCurrent()) {
                return;
            }

            const target = { kind: 'project', id: tracked.id } as const;
            if (!state.downloaded) {
                // Shown again before its first download finished: the download reads it, from where it stopped.
                await tracking.updateSyncState(target, { hidden: false, refused: null });
                return;
            }

            if (result.status === 304) {
                await tracking.updateSyncState(target, { hidden: false, refused: null, lastSuccessAt: clock.now() });
                return;
            }

            const reread = await rereadProject(context, tracked, state);
            if (!reread || !context.isCurrent()) {
                return;
            }

            // The ETag only now: a re-read that failed is tried again by the next poll.
            await tracking.updateSyncState(target, {
                hidden: false,
                refused: null,
                etag: result.etag ?? null,
                readAt: startedAt,
                lastSuccessAt: clock.now(),
            });
        }

        /**
         * Asks whether a project whose REST GitHub refuses changed, by its `updatedAt` (the field the REST ETag moves
         * with) — every {@link PROJECT_PROBE_INTERVAL_MS}, as it costs a point — and reads it again when it did.
         */
        async function probeProject(context: TrackingSyncContext, tracked: TrackedProject, state: ProjectSyncState) {
            const startedAt = clock.now();
            const askedAt = probedAt.get(tracked.id);
            if (askedAt !== undefined && startedAt - askedAt < PROJECT_PROBE_INTERVAL_MS) {
                return;
            }

            probedAt.set(tracked.id, startedAt);
            context.checkAllowance('graphql');
            const { node } = await context.account.sdk.ProjectUpdatedAt({ id: tracked.id });
            if (!context.isCurrent()) {
                return;
            }

            const target = { kind: 'project', id: tracked.id } as const;
            if (!isPresent(node)) {
                await tracking.updateSyncState(target, { hidden: true });
                return;
            }

            if (!state.downloaded) {
                await tracking.updateSyncState(target, { hidden: false });
                return;
            }

            if (node.updatedAt === state.updatedAt) {
                await tracking.updateSyncState(target, { hidden: false, lastSuccessAt: clock.now() });
                return;
            }

            const reread = await rereadProject(context, tracked, state);
            if (!reread || !context.isCurrent()) {
                return;
            }

            await tracking.updateSyncState(target, {
                hidden: false,
                updatedAt: node.updatedAt,
                readAt: startedAt,
                lastSuccessAt: clock.now(),
            });
        }

        /**
         * The project changed: its fields and views, then the items updated since the day before the last read;
         * all of them when the count differs from GitHub's after that. `false` when GitHub no longer shows it, it
         * is no longer tracked or the session ended.
         */
        async function rereadProject(context: TrackingSyncContext, tracked: TrackedProject, state: ProjectSyncState) {
            context.checkAllowance('graphql');
            const { node } = await context.account.sdk.ProjectSchema({ id: tracked.id });
            const kept = projects.get(tracked.id);
            if (!isWanted(context, { kind: 'project', id: tracked.id }) || !isPresent(node) || !kept) {
                return false;
            }

            projects.setProject(
                toProject({
                    id: kept.id,
                    number: kept.number,
                    url: kept.url,
                    owner: kept.owner,
                    ownerKind: kept.ownerKind,
                    title: node.title,
                    closed: node.closed,
                    viewerCanUpdate: node.viewerCanUpdate,
                    fields: node.fields,
                    views: node.views,
                }),
            );

            const since = new Date((state.readAt ?? clock.now()) - DAY_MS).toISOString().slice(0, 10);
            const changed = await readAllProjectItems(context, tracked.id, `updated:>=${since}`, CHANGED_PAGE_SIZE);
            if (!changed) {
                return false;
            }

            await keepProjectItems(changed);
            // The count tells a removal apart even when an item was added meanwhile: the added one is in the
            // narrowed read (adding it updates it), so the copy holds one more than GitHub counts. What it cannot
            // tell: a removal paired with an addition the narrowed read does not see — none GitHub documents —
            // which stays until a later count differs. Comparing every id would mean reading them all each time.
            if (projects.getStoredItems(tracked.id).length === node.items.totalCount) {
                logger.debug('Tracked project re-read', { project: tracked.id, reread: changed.length });
                return true;
            }

            // An item left the project, which the narrowed read cannot see: all of them, once.
            const all = await readAllProjectItems(context, tracked.id, '', PROJECT_PAGE_SIZE);
            if (!all) {
                return false;
            }

            const before = projects.getStoredItems(tracked.id);
            projects.replaceItems(
                tracked.id,
                all.map(entry => entry.item),
            );
            items.upsertMany(filterNotNull(all.map(entry => entry.content)));
            const left = new Set(all.map(entry => entry.item.itemId));
            trackedItems.evict(
                filterNotNull(before.filter(place => !left.has(place.itemId)).map(place => place.contentId)),
            );
            logger.debug('Tracked project read whole', { project: tracked.id, items: all.length });
            return true;
        }

        /**
         * Every page of the project's items matching `query`, `first` to a page; `null` when GitHub no longer shows
         * it, it is no longer tracked or the session ended.
         */
        async function readAllProjectItems(
            context: TrackingSyncContext,
            projectId: string,
            query: string,
            first: number,
        ) {
            const read: ReadProjectItem[] = [];
            let after: string | null = null;
            for (;;) {
                context.checkAllowance('graphql');
                const { node } = await context.account.sdk.ProjectItems({ id: projectId, query, first, after });
                if (!isWanted(context, { kind: 'project', id: projectId }) || !isPresent(node)) {
                    return null;
                }

                read.push(...readProjectItems(projectId, node.items));
                const { hasNextPage, endCursor } = node.items.pageInfo;
                if (!hasNextPage || endCursor === null) {
                    return read;
                }

                after = endCursor;
            }
        }

        function readProjectItems(projectId: string, page: ProjectItemPageFieldsFragment) {
            return filterNotNull(page.nodes ?? []).map(node => toProjectItem(node, projectId));
        }

        /** Puts read project items and their issues' and pull requests' rows in the stores, on disk. */
        async function keepProjectItems(read: readonly ReadProjectItem[]) {
            projects.upsertItems(read.map(entry => entry.item));
            items.upsertMany(filterNotNull(read.map(entry => entry.content)));
            await Promise.all([projects.flush(), items.flush()]);
        }

        /** GitHub refused the target's change check lately: it is not asked again yet. */
        function isRefusedNow(state: TrackedSyncState) {
            return state.refused !== null && clock.now() - state.refused.at < REFUSED_RETRY_MS;
        }

        /** Whether what was read for `target` may be written: the session is current and it is still tracked. */
        function isWanted(context: TrackingSyncContext, target: TrackedTarget) {
            return context.isCurrent() && tracking.isTracked(target);
        }

        function getDownloadPhase(repo: TrackedRepository) {
            const state = tracking.getSyncState({ kind: 'repository', nameWithOwner: repo.nameWithOwner });
            if (!state) {
                return 'openIssues';
            }

            return state.hidden || state.phase === 'done' ? null : state.phase;
        }

        function isDownloaded(project: TrackedProject) {
            const state = tracking.getSyncState({ kind: 'project', id: project.id });
            return state !== undefined && (state.hidden || state.downloaded);
        }
    },
});

/**
 * A failure that concerns the one target polled: GitHub answering it with an error status other than the
 * allowance's and a revoked token's (which concern every target, and fail the loop).
 */
function isTargetFailure(error: unknown): error is GitHubApiError {
    return error instanceof GitHubApiError && !isRateLimitRefusal(error) && error.status !== 401;
}

/** GitHub refusing a target for a reason that lasts — a 4xx other than a 404 (hidden) — rather than failing. */
function isLastingRefusal(error: GitHubApiError) {
    return error.status >= 400 && error.status < 500 && error.status !== 404;
}

/** A page of a repository's issues or pull requests, as rows. */
interface ItemPage {
    readonly totalCount: number;
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    /** `null` for a node `toItem` could not read. */
    readonly items: readonly (Item | null)[];
}

/** A `node(id:)` answer that is the project asked for: GitHub answers `{}` for a node of another type, `null` for none. */
function isPresent<T extends object>(node: T | Record<PropertyKey, never> | null): node is T {
    return node !== null && Object.keys(node).length > 0;
}
