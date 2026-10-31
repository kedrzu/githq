import type {
    TrackingProjectFieldsFragment,
    TrackingRepositoryFieldsFragment,
    TrackingRepositoryPageFieldsFragment,
} from '@githq/github/generated.gen.js';
import { readTrackingCandidates } from '@githq/github/tracking/readTrackingCandidates.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { ItemStore } from '@/store/ItemStore.js';
import { TabChannel } from '@/sync/TabChannel.js';
import { createTabInbox } from '@/sync/createTabInbox.js';
import type { TabInbox } from '@/sync/createTabInbox.js';
import type { TabMessage } from '@/sync/TabChannel.js';

import { TrackingPersistence } from './TrackingPersistence.js';
import { REPOSITORY_DOWNLOAD_PHASES } from './TrackingTypes.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';
import type {
    CandidateProject,
    CandidateRepositories,
    CandidateRepository,
    ProjectSyncPatch,
    ProjectSyncState,
    RepositorySyncPatch,
    RepositorySyncState,
    TrackedProject,
    TrackedRepository,
    TrackedSyncState,
    TrackedTarget,
    Tracking,
    TrackingCandidates,
    TrackingProgress,
} from './TrackingTypes.js';

/** What the user chose to track on the tracking screen (G2, G8). */
export interface TrackingChoice {
    readonly repositories: readonly TrackedRepository[];
    readonly projects: readonly TrackedProject[];
}

/** Called with what the user stopped tracking, for its copy to go. */
export type UntrackListener = (target: TrackedTarget) => void;

const NOTHING_TRACKED: Tracking = { chosen: false, repositories: [], projects: [] };

/** The signed-in user the tracking is kept for, captured when they signed in. */
interface Session {
    readonly account: Account;
    /** Resolves once the kept tracking is in memory; never rejects. */
    ready: Promise<void>;
    candidatesInFlight: Promise<TrackingCandidates | null> | null;
    /** The page reads under way, by owner. */
    readonly pagesInFlight: Map<string, Promise<void>>;
    /** What other tabs send: held until the kept copy is read, then taken in over it. */
    readonly inbox: TabInbox;
}

/**
 * What the signed-in user tracks (D4) — repositories and projects in their order, which is the sidebar's and
 * D12's precedence — whether they made the choice yet (G2), and how far each tracked copy is (its first download
 * and its polling, written by the sync). Kept in the account's local copy; what the tracking screens offer
 * ({@link loadCandidates}) is read from GitHub when asked and kept in memory only.
 *
 * It follows the signed-in user like the item store: their choice leaves memory when they sign out (the item
 * store deletes the copy holding it), and an answer arriving for a session that ended is dropped. Like the item
 * store, it sends its changes to the user's other tabs and takes theirs into memory — what another tab stopped
 * tracking is dropped by that tab, which sends what it dropped.
 */
export type TrackingStore = Resolved<typeof TrackingStore>;
export const TrackingStore = defineService({
    name: 'TrackingStore',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        persistence: TrackingPersistence,
        tabs: TabChannel,
        logger: Logger,
    },
    setup({ accounts, items, persistence, tabs, logger }) {
        const trackingRef = shallowRef<Tracking>(NOTHING_TRACKED);
        const syncRef = shallowRef<ReadonlyMap<string, TrackedSyncState>>(new Map());
        const loadedRef = shallowRef(false);
        const candidatesRef = shallowRef<TrackingCandidates | null>(null);
        const untrackListeners: UntrackListener[] = [];

        let session: Session | null = null;

        accounts.onChange(follow);
        tabs.onMessage(receive);

        return {
            /** Whether the signed-in user's kept choice is in memory; reactive. */
            get loaded() {
                return loadedRef.value;
            },
            /** Whether the user made the choice (G2); reactive. */
            get chosen() {
                return trackingRef.value.chosen;
            },
            /** The tracked repositories in the user's order; reactive. */
            get repositories() {
                return trackingRef.value.repositories;
            },
            /** The tracked projects in the user's order; reactive. */
            get projects() {
                return trackingRef.value.projects;
            },
            /** What the tracking screens offer, once {@link loadCandidates} read it; reactive. */
            get candidates() {
                return candidatesRef.value;
            },
            ready,
            isTracked,
            choose,
            track,
            untrack,
            onUntrack,
            getSyncState,
            updateSyncState,
            getProgress,
            loadCandidates,
            loadMoreRepositories,
            findCandidate,
        };

        /**
         * Resolves once the signed-in user's kept choice is in memory (at once when signed out); never rejects. It
         * looks a moment later, like the item store's, so it waits for the user who just signed in.
         */
        async function ready() {
            await Promise.resolve();
            await session?.ready;
        }

        /** Whether the repository or project is tracked; reactive. */
        function isTracked(target: TrackedTarget) {
            return target.kind === 'repository'
                ? trackingRef.value.repositories.some(repo => repo.nameWithOwner === target.nameWithOwner)
                : trackingRef.value.projects.some(project => project.id === target.id);
        }

        /**
         * The user's choice on the tracking screen (G2, G8): exactly these, in this order — the ones tracked before
         * keep their place and their copy, the ones left out are untracked.
         */
        function choose(choice: TrackingChoice) {
            const before = trackingRef.value;
            const repositories = keepOrder(before.repositories, choice.repositories, repo => repo.nameWithOwner);
            const projects = keepOrder(before.projects, choice.projects, project => project.id);
            write({ chosen: true, repositories, projects });

            for (const repo of before.repositories) {
                if (!repositories.some(other => other.nameWithOwner === repo.nameWithOwner)) {
                    dropped({ kind: 'repository', nameWithOwner: repo.nameWithOwner });
                }
            }

            for (const project of before.projects) {
                if (!projects.some(other => other.id === project.id)) {
                    dropped({ kind: 'project', id: project.id });
                }
            }
        }

        /** Tracks one more repository or project, after the others; nothing when it already is. */
        function track(target: { repository: TrackedRepository } | { project: TrackedProject }) {
            const { chosen, repositories, projects } = trackingRef.value;
            if ('repository' in target) {
                const { repository } = target;
                if (!isTracked({ kind: 'repository', nameWithOwner: repository.nameWithOwner })) {
                    write({ chosen, repositories: [...repositories, repository], projects });
                }
            } else if (!isTracked({ kind: 'project', id: target.project.id })) {
                write({ chosen, repositories, projects: [...projects, target.project] });
            }
        }

        /** Stops tracking the repository or project; its copy goes unless something else keeps it. */
        function untrack(target: TrackedTarget) {
            if (!isTracked(target)) {
                return;
            }

            const { chosen, repositories, projects } = trackingRef.value;
            write(
                target.kind === 'repository'
                    ? {
                          chosen,
                          repositories: repositories.filter(repo => repo.nameWithOwner !== target.nameWithOwner),
                          projects,
                      }
                    : { chosen, repositories, projects: projects.filter(project => project.id !== target.id) },
            );
            dropped(target);
        }

        /** Calls `listener` with each repository or project the user stops tracking, once it is no longer tracked. */
        function onUntrack(listener: UntrackListener) {
            untrackListeners.push(listener);
        }

        /** The sync state of a tracked repository or project, `undefined` before its download started; reactive. */
        function getSyncState(target: { kind: 'repository'; nameWithOwner: string }): RepositorySyncState | undefined;
        function getSyncState(target: { kind: 'project'; id: string }): ProjectSyncState | undefined;
        function getSyncState(target: TrackedTarget): TrackedSyncState | undefined {
            const state = syncRef.value.get(getSyncKey(target));
            return state?.kind === target.kind ? state : undefined;
        }

        /**
         * Records how far a tracked repository's or project's copy is: `patch` holds only the fields its writer owns
         * (the download its progress, a poll what it found), applied to the record as it is now — so the download
         * and a poll running side by side never restore each other's older fields. A record not there yet starts
         * from nothing read. Resolves once it is written — a download writes its next cursor only after the items
         * it read, so a tab closed in between reads them again rather than skipping them. Ignored while signed out
         * or once it is no longer tracked; never rejects.
         */
        async function updateSyncState(
            target: { kind: 'repository'; nameWithOwner: string },
            patch: RepositorySyncPatch,
        ): Promise<void>;
        async function updateSyncState(target: { kind: 'project'; id: string }, patch: ProjectSyncPatch): Promise<void>;
        async function updateSyncState(target: TrackedTarget, patch: RepositorySyncPatch | ProjectSyncPatch) {
            const current = session;
            if (!current || !isTracked(target)) {
                return;
            }

            const key = getSyncKey(target);
            const before = syncRef.value.get(key);
            const state: TrackedSyncState =
                target.kind === 'repository'
                    ? {
                          ...(before?.kind === 'repository' ? before : startRepositoryState(target.nameWithOwner)),
                          ...patch,
                      }
                    : { ...(before?.kind === 'project' ? before : startProjectState(target.id)), ...patch };
            syncRef.value = new Map(syncRef.value).set(key, state);
            tabs.publish({ kind: 'trackedSyncState', state, deleted: false });
            try {
                await persistence.saveSyncState(current.account.login, state);
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Could not keep the sync state of a tracked copy', { error });
                }
            }
        }

        /** How far the first download of a tracked repository or project is; reactive. */
        function getProgress(target: TrackedTarget): TrackingProgress {
            const state = syncRef.value.get(getSyncKey(target));
            if (!state) {
                return { state: 'downloading', done: 0, total: null };
            }

            if (state.hidden) {
                return { state: 'hidden', done: 0, total: null };
            }

            if (state.kind === 'project') {
                return { state: state.downloaded ? 'done' : 'downloading', ...state.count };
            }

            let done = 0;
            let total: number | null = null;
            for (const phase of REPOSITORY_DOWNLOAD_PHASES) {
                const count = state.counts[phase];
                done += count?.done ?? 0;
                if (count?.total != null) {
                    total = (total ?? 0) + count.total;
                }
            }

            return { state: state.phase === 'done' ? 'done' : 'downloading', done, total };
        }

        /**
         * Reads what the tracking screens offer — the user's own repositories and projects, and each organisation's
         * first repositories and its projects — or gives what was read before. `null` when signed out or GitHub
         * cannot be reached; rejects never. An organisation hiding its private resources from githq is marked
         * instead of failing the read (G5).
         */
        async function loadCandidates(): Promise<TrackingCandidates | null> {
            const current = session;
            if (!current) {
                return null;
            }

            if (candidatesRef.value) {
                return candidatesRef.value;
            }

            current.candidatesInFlight ??= readCandidates(current).finally(() => {
                current.candidatesInFlight = null;
            });
            return await current.candidatesInFlight;
        }

        /**
         * Reads the next page of an owner's repositories — the user's own (their login) or an organisation's — into
         * {@link candidates}: an organisation may have hundreds (G4). Nothing when every one was read.
         */
        async function loadMoreRepositories(owner: string) {
            const current = session;
            const candidates = candidatesRef.value;
            if (!current || !candidates) {
                return;
            }

            let running = current.pagesInFlight.get(owner);
            if (!running) {
                running = readMoreRepositories(current, candidates, owner).finally(() =>
                    current.pagesInFlight.delete(owner),
                );
                current.pagesInFlight.set(owner, running);
            }

            await running;
        }

        /**
         * Reads the repository or project the user named to track it (G10, G8) — anyone's, not only theirs. `null`
         * when GitHub shows them no such thing, when it cannot be reached, or when signed out; rejects never.
         */
        async function findCandidate(
            reference: TrackingReference,
        ): Promise<CandidateRepository | CandidateProject | null> {
            const current = session;
            if (!current) {
                return null;
            }

            try {
                let found: CandidateRepository | CandidateProject | null = null;
                if (reference.kind === 'repository') {
                    const { repository } = await current.account.sdk.RepositoryForTracking({
                        owner: reference.owner,
                        name: reference.name,
                    });
                    found = repository ? toCandidateRepository(repository) : null;
                } else {
                    const { repositoryOwner } = await current.account.sdk.ProjectForTracking({
                        login: reference.owner,
                        number: reference.number,
                    });
                    const project =
                        repositoryOwner && 'projectV2' in repositoryOwner ? repositoryOwner.projectV2 : null;
                    found = project ? toCandidateProject(project) : null;
                }

                return isCurrent(current) ? found : null;
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('A repository or project to track could not be read', { kind: reference.kind, error });
                }

                return null;
            }
        }

        async function readCandidates(current: Session) {
            try {
                const read = await readTrackingCandidates(current.account.sdk, {
                    onPartialErrors: errors => logger.warn('Tracking candidates read in part', { errors }),
                });
                if (!isCurrent(current)) {
                    return null;
                }

                const candidates: TrackingCandidates = {
                    login: read.login,
                    repositories: toCandidateRepositories(read.repositories),
                    projects: read.projects.map(project => toCandidateProject(project)),
                    organizations: read.organizations.map(organization => ({
                        login: organization.login,
                        avatarUrl: organization.avatarUrl,
                        hiddenPrivate: organization.hiddenPrivate,
                        repositories: organization.repositories && toCandidateRepositories(organization.repositories),
                        projects: organization.projects.map(project => toCandidateProject(project)),
                    })),
                };
                candidatesRef.value = candidates;
                return candidates;
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Tracking candidates could not be read', { error });
                }

                return null;
            }
        }

        async function readMoreRepositories(current: Session, candidates: TrackingCandidates, owner: string) {
            const own = owner === candidates.login;
            const list = own
                ? candidates.repositories
                : candidates.organizations.find(organization => organization.login === owner)?.repositories;
            const after = list?.nextCursor;
            if (!list || after == null) {
                return;
            }

            let page: TrackingRepositoryPageFieldsFragment | null | undefined;
            try {
                page = own
                    ? (await current.account.sdk.ViewerRepositories({ after })).viewer.repositories
                    : (await current.account.sdk.OrganizationRepositories({ login: owner, after })).organization
                          ?.repositories;
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('A page of repositories could not be read', { owner, error });
                }

                return;
            }

            const latest = candidatesRef.value;
            if (!isCurrent(current) || !page || !latest) {
                return;
            }

            const read = toCandidateRepositories(page);
            const more: CandidateRepositories = {
                repositories: [...list.repositories, ...read.repositories],
                totalCount: read.totalCount,
                nextCursor: read.nextCursor,
            };
            candidatesRef.value = own
                ? { ...latest, repositories: more }
                : {
                      ...latest,
                      organizations: latest.organizations.map(organization =>
                          organization.login === owner ? { ...organization, repositories: more } : organization,
                      ),
                  };
        }

        function write(tracking: Tracking) {
            const current = session;
            if (!current) {
                return;
            }

            trackingRef.value = tracking;
            tabs.publish({ kind: 'tracking', tracking });
            persistence.saveTracking(current.account.login, tracking).catch((error: unknown) => {
                if (isCurrent(current)) {
                    logger.warn('Could not keep the tracking choice', { error });
                }
            });
        }

        /** No longer tracked: its sync state goes, and the listeners drop its copy. */
        function dropped(target: TrackedTarget) {
            const current = session;
            const key = getSyncKey(target);
            const state = syncRef.value.get(key);
            if (current && state) {
                const next = new Map(syncRef.value);
                next.delete(key);
                syncRef.value = next;
                tabs.publish({ kind: 'trackedSyncState', state, deleted: true });
                persistence.deleteSyncState(current.account.login, state).catch((error: unknown) => {
                    if (isCurrent(current)) {
                        logger.warn('Could not delete the sync state of an untracked copy', { error });
                    }
                });
            }

            for (const listener of untrackListeners) {
                listener(target);
            }
        }

        /** Takes in what another tab of the user changed — in memory only: that tab writes it. */
        function receive(message: TabMessage, login: string) {
            const current = session;
            if (current?.account.login !== login) {
                return;
            }

            current.inbox.deliver(message);
        }

        function takeIn(message: TabMessage) {
            switch (message.kind) {
                case 'tracking':
                    trackingRef.value = message.tracking;
                    break;
                case 'trackedSyncState': {
                    const next = new Map(syncRef.value);
                    const key = getSyncKey(toTarget(message.state));
                    if (message.deleted) {
                        next.delete(key);
                    } else {
                        next.set(key, message.state);
                    }

                    syncRef.value = next;
                    break;
                }
                default:
                    break;
            }
        }

        /** Another account signed in, or none: the choice of whoever was before leaves memory. */
        function follow(account: Account | null) {
            session = null;
            trackingRef.value = NOTHING_TRACKED;
            syncRef.value = new Map();
            candidatesRef.value = null;
            loadedRef.value = false;
            if (!account) {
                return;
            }

            const current: Session = {
                account,
                ready: Promise.resolve(),
                candidatesInFlight: null,
                pagesInFlight: new Map(),
                inbox: createTabInbox(takeIn),
            };
            session = current;
            current.ready = readKept(current);
        }

        /** Puts the kept choice into memory once the item store opened the copy. */
        async function readKept(current: Session) {
            await items.ready();
            if (!isCurrent(current)) {
                return;
            }

            try {
                const persisted = await persistence.loadTracking(current.account.login);
                if (!isCurrent(current)) {
                    return;
                }

                trackingRef.value = persisted.tracking ?? NOTHING_TRACKED;
                syncRef.value = new Map(persisted.syncStates.map(state => [getSyncKey(toTarget(state)), state]));
            } catch (error) {
                logger.warn('Could not read the kept tracking choice; starting from none', { error });
            }

            if (isCurrent(current)) {
                loadedRef.value = true;
                current.inbox.open();
            }
        }

        /** Whether `current` is still the session — here and in the store every request was authorised by. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }
    },
});

function startRepositoryState(nameWithOwner: string): RepositorySyncState {
    return {
        kind: 'repository',
        nameWithOwner,
        phase: 'openIssues',
        cursor: null,
        counts: {},
        since: null,
        etag: null,
        hidden: false,
        refused: null,
        lastSuccessAt: null,
    };
}

function startProjectState(id: string): ProjectSyncState {
    return {
        kind: 'project',
        id,
        downloaded: false,
        cursor: null,
        count: { done: 0, total: null },
        etag: null,
        readAt: null,
        hidden: false,
        refused: null,
        updatedAt: null,
        lastSuccessAt: null,
    };
}

function getSyncKey(target: TrackedTarget) {
    return target.kind === 'repository' ? `repository:${target.nameWithOwner}` : `project:${target.id}`;
}

function toTarget(state: TrackedSyncState): TrackedTarget {
    return state.kind === 'repository'
        ? { kind: 'repository', nameWithOwner: state.nameWithOwner }
        : { kind: 'project', id: state.id };
}

/** `chosen` in the order of `before` for the ones already there, the new ones after in their own order. */
function keepOrder<T>(before: readonly T[], chosen: readonly T[], keyOf: (value: T) => string): T[] {
    const keys = new Set(chosen.map(keyOf));
    const kept = before.filter(value => keys.has(keyOf(value)));
    const keptKeys = new Set(kept.map(keyOf));
    return [...kept, ...chosen.filter(value => !keptKeys.has(keyOf(value)))];
}

function toCandidateRepositories(page: TrackingRepositoryPageFieldsFragment): CandidateRepositories {
    return {
        repositories: filterNotNull(page.nodes ?? []).map(toCandidateRepository),
        totalCount: page.totalCount,
        nextCursor: page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null,
    };
}

function toCandidateRepository(repository: TrackingRepositoryFieldsFragment): CandidateRepository {
    return {
        id: repository.id,
        nameWithOwner: repository.nameWithOwner,
        owner: repository.owner.login,
        isPrivate: repository.isPrivate,
        isArchived: repository.isArchived,
        pushedAt: repository.pushedAt,
        openIssues: repository.issues.totalCount,
        openPullRequests: repository.pullRequests.totalCount,
    };
}

function toCandidateProject(project: TrackingProjectFieldsFragment): CandidateProject {
    const { owner } = project;
    return {
        id: project.id,
        title: project.title,
        number: project.number,
        url: project.url,
        closed: project.closed,
        updatedAt: project.updatedAt,
        itemCount: project.items.totalCount,
        owner: 'login' in owner ? owner.login : '',
        ownerKind: owner.__typename === 'Organization' ? 'org' : 'user',
    };
}
