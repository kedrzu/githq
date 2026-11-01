import type {
    TrackingProjectFieldsFragment,
    TrackingRepositoryFieldsFragment,
    TrackingRepositoryPageFieldsFragment,
} from '@githq/github/generated.gen.js';
import { SETTINGS_REPOSITORY_NAME } from '@githq/github/settings/getSettingsRepository.js';
import { readTrackingCandidates } from '@githq/github/tracking/readTrackingCandidates.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { deepEquals } from '@nzyme/utils/deepEquals.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { computed, shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { Browser } from '@/services/Browser.js';
import { EMPTY_SETTINGS_DOCUMENT, readSettingsDocument } from '@/settings/sync/SettingsDocument.js';
import type { SettingsDocument, SettingsProject, SettingsRepository } from '@/settings/sync/SettingsDocument.js';
import { readSettingsSaving, SETTINGS_SAVING_OFF } from '@/settings/sync/SettingsSaving.js';
import type { SettingsSaving } from '@/settings/sync/SettingsSaving.js';
import { ItemStore } from '@/store/ItemStore.js';
import { TabChannel } from '@/sync/TabChannel.js';
import { createTabInbox } from '@/sync/createTabInbox.js';
import type { TabInbox } from '@/sync/createTabInbox.js';
import type { TabMessage } from '@/sync/TabChannel.js';

import { TrackingPersistence } from './TrackingPersistence.js';
import type { PersistedTracking } from './TrackingPersistence.js';
import { REPOSITORY_DOWNLOAD_PHASES } from './TrackingTypes.js';
import { getTrackedKey } from './utils/getTrackedKey.js';
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

/** Where the user's settings are kept, per user: `githq.settings.<login>` (D8). */
const KEY_PREFIX = 'githq.settings.';

/** Whether the user chose (G2), and their settings in the file's shape (D13). */
interface KeptSettings {
    readonly chosen: boolean;
    readonly document: SettingsDocument;
}

/** What the account slot keeps for the user: their settings, and whether and how they are synced (`SettingsSync`). */
interface StoredSettings extends KeptSettings {
    readonly saving: SettingsSaving;
}

const NOTHING_KEPT: KeptSettings = { chosen: false, document: EMPTY_SETTINGS_DOCUMENT };

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
 * and its polling, written by the sync). The choice is kept in this browser's `localStorage` as a settings
 * document ({@link SettingsDocument}, settings-sync D8, D13): every repository and project ever tracked, the tracked
 * ones flagged — what it exposes is those, in the document's order. It survives a new cache database and is
 * deleted at sign-out. A choice kept by an older githq in the local copy is taken over from there once. The sync
 * states stay in the local copy. What the tracking screens offer ({@link loadCandidates}) is read from GitHub when
 * asked and kept in memory only.
 *
 * It follows the signed-in user like the item store: their choice leaves memory when they sign out, and an answer
 * arriving for a session that ended is dropped. Like the item store, it tells the user's other tabs what it changed
 * and takes their changes into memory — what another tab stopped tracking is dropped by that tab, which sends what
 * it dropped.
 */
export type TrackingStore = Resolved<typeof TrackingStore>;
export const TrackingStore = defineService({
    name: 'TrackingStore',
    deps: {
        accounts: AccountSession,
        browser: Browser,
        items: ItemStore,
        persistence: TrackingPersistence,
        tabs: TabChannel,
        logger: Logger,
    },
    setup({ accounts, browser, items, persistence, tabs, logger }) {
        const keptRef = shallowRef<KeptSettings>(NOTHING_KEPT);
        const savingRef = shallowRef<SettingsSaving>(SETTINGS_SAVING_OFF);
        const trackingRef = computed(() => toTracking(keptRef.value));
        const syncRef = shallowRef<ReadonlyMap<string, TrackedSyncState>>(new Map());
        const loadedRef = shallowRef(false);
        const candidatesRef = shallowRef<TrackingCandidates | null>(null);
        const untrackListeners: UntrackListener[] = [];
        const changeListeners: (() => void)[] = [];

        let session: Session | null = null;

        // Set up before `follow` subscribes, so the slot names the new user by the time `follow` runs.
        const slot = createAccountSlot({
            accounts,
            browser,
            keyPrefix: KEY_PREFIX,
            parse: readStoredSettings,
            follow: () => {
                // Read once the item store opened the local copy (`readKept`): an older choice is taken over from it.
            },
        });

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
            /**
             * Every repository and project the user ever tracked, in the file's shape (settings-sync D13); the tracked
             * ones are {@link repositories} and {@link projects}. Reactive.
             */
            get document() {
                return keptRef.value.document;
            },
            /**
             * Whether and how the settings are synced with the settings repository, as this tab last read it; reactive.
             * Kept here, in the settings' slot, for `SettingsSync`, its only writer.
             */
            get saving() {
                return savingRef.value;
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
            replaceDocument,
            onUntrack,
            onLocalChange,
            readSaving,
            saveSaving,
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
         * The user's choice on the tracking screen (G2, G8): exactly these tracked — the ones tracked before keep
         * their place and their copy, one tracked earlier returns to its old place, a new one comes after the others
         * in the order given, and the ones left out are untracked.
         */
        function choose(choice: TrackingChoice) {
            write({ ...keptRef.value, chosen: true, document: applyChoice(keptRef.value.document, choice) });
            changedHere();
        }

        /**
         * Tracks one more repository or project — in its old place when it was tracked before, else after the others;
         * nothing when it already is.
         */
        function track(target: { repository: TrackedRepository } | { project: TrackedProject }) {
            const { repositories, projects } = trackingRef.value;
            if ('repository' in target) {
                const { repository } = target;
                if (!isTracked({ kind: 'repository', nameWithOwner: repository.nameWithOwner })) {
                    retrack({ repositories: [...repositories, repository], projects });
                }
            } else if (!isTracked({ kind: 'project', id: target.project.id })) {
                retrack({ repositories, projects: [...projects, target.project] });
            }
        }

        /** Stops tracking the repository or project; its copy goes unless something else keeps it. */
        function untrack(target: TrackedTarget) {
            if (!isTracked(target)) {
                return;
            }

            const { repositories, projects } = trackingRef.value;
            retrack(
                target.kind === 'repository'
                    ? {
                          repositories: repositories.filter(repo => repo.nameWithOwner !== target.nameWithOwner),
                          projects,
                      }
                    : { repositories, projects: projects.filter(project => project.id !== target.id) },
            );
        }

        /**
         * Replaces the settings document wholesale — with the settings repository's, merged (settings-sync D11). What
         * it no longer tracks is untracked, its copy dropped; what it newly tracks is downloaded. Kept and sent to the
         * other tabs like any change; nothing while signed out.
         */
        function replaceDocument(document: SettingsDocument) {
            write({ ...keptRef.value, document });
        }

        /** Tracks exactly `choice`, as {@link choose} does, without counting as the user's choice. */
        function retrack(choice: TrackingChoice) {
            write({ ...keptRef.value, document: applyChoice(keptRef.value.document, choice) });
            changedHere();
        }

        /** Calls `listener` with each repository or project the user stops tracking, once it is no longer tracked. */
        function onUntrack(listener: UntrackListener) {
            untrackListeners.push(listener);
        }

        /**
         * Calls `listener` after the user changed what is tracked in this tab — chose, tracked or untracked — not when
         * another tab did, nor when the document was replaced.
         */
        function onLocalChange(listener: () => void) {
            changeListeners.push(listener);
        }

        /**
         * The saving state as the slot holds it now — another tab may have moved it since — taken into
         * {@link saving}; off while signed out or before the kept settings are read.
         */
        function readSaving(): SettingsSaving {
            const stored = loadedRef.value ? slot.read() : null;
            if (stored && !deepEquals(stored.saving, savingRef.value)) {
                savingRef.value = stored.saving;
            }

            return savingRef.value;
        }

        /** Keeps the saving state next to the settings; nothing while signed out or before they are read. */
        function saveSaving(saving: SettingsSaving) {
            if (!session || !loadedRef.value) {
                return;
            }

            savingRef.value = saving;
            slot.save({ ...keptRef.value, saving });
        }

        function changedHere() {
            if (!session) {
                return;
            }

            for (const listener of changeListeners) {
                listener();
            }
        }

        /** The sync state of a tracked repository or project, `undefined` before its download started; reactive. */
        function getSyncState(target: { kind: 'repository'; nameWithOwner: string }): RepositorySyncState | undefined;
        function getSyncState(target: { kind: 'project'; id: string }): ProjectSyncState | undefined;
        function getSyncState(target: TrackedTarget): TrackedSyncState | undefined {
            const state = syncRef.value.get(getTrackedKey(target));
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

            const key = getTrackedKey(target);
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
            const state = syncRef.value.get(getTrackedKey(target));
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
                    found =
                        repository && !isSettingsRepository(repository.nameWithOwner, current.account.login)
                            ? toCandidateRepository(repository)
                            : null;
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
                    repositories: toCandidateRepositories(read.repositories, current.account.login),
                    projects: read.projects.map(project => toCandidateProject(project)),
                    organizations: read.organizations.map(organization => ({
                        login: organization.login,
                        avatarUrl: organization.avatarUrl,
                        hiddenPrivate: organization.hiddenPrivate,
                        repositories:
                            organization.repositories &&
                            toCandidateRepositories(organization.repositories, current.account.login),
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

            const read = toCandidateRepositories(page, current.account.login);
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

        /**
         * Keeps `next` and tells the other tabs; what was tracked and no longer is gets dropped — its sync state and
         * its copy.
         */
        function write(next: KeptSettings) {
            if (!session) {
                return;
            }

            const before = trackingRef.value;
            keptRef.value = next;
            // The saving state as another tab's sync may have left it, kept with this tab's settings.
            savingRef.value = slot.read()?.saving ?? savingRef.value;
            slot.save({ ...next, saving: savingRef.value });
            const after = trackingRef.value;
            tabs.publish({ kind: 'tracking', tracking: after });

            for (const repo of before.repositories) {
                if (!after.repositories.some(other => other.nameWithOwner === repo.nameWithOwner)) {
                    dropped({ kind: 'repository', nameWithOwner: repo.nameWithOwner });
                }
            }

            for (const project of before.projects) {
                if (!after.projects.some(other => other.id === project.id)) {
                    dropped({ kind: 'project', id: project.id });
                }
            }
        }

        /** No longer tracked: its sync state goes, and the listeners drop its copy. */
        function dropped(target: TrackedTarget) {
            const current = session;
            const key = getTrackedKey(target);
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
                case 'tracking': {
                    // The sending tab saved its document before it sent: read it, as it holds what the message cannot
                    // (the untracked entries and their places). A slot that does not hold it yet — a tab of an older
                    // githq sent it — takes the message's tracking in, as a choice of exactly these would.
                    const stored = slot.read();
                    const base = stored ?? keptRef.value;
                    keptRef.value = {
                        chosen: message.tracking.chosen,
                        document: applyChoice(base.document, message.tracking),
                    };
                    savingRef.value = stored?.saving ?? savingRef.value;
                    break;
                }
                case 'trackedSyncState': {
                    const next = new Map(syncRef.value);
                    const key = getTrackedKey(message.state);
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
            keptRef.value = NOTHING_KEPT;
            savingRef.value = SETTINGS_SAVING_OFF;
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

        /**
         * Puts the kept choice and the sync states into memory once the item store opened the local copy. With no
         * choice kept in `localStorage`, one an older githq kept in the local copy is taken over (all of it tracked).
         */
        async function readKept(current: Session) {
            await items.ready();
            if (!isCurrent(current)) {
                return;
            }

            let persisted: PersistedTracking | null = null;
            try {
                persisted = await persistence.loadTracking(current.account.login);
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Could not read the sync states of the tracked copies; starting from none', { error });
                }
            }

            if (!isCurrent(current)) {
                return;
            }

            const stored = slot.read();
            keptRef.value = stored
                ? { chosen: stored.chosen, document: stored.document }
                : takeOver(persisted?.tracking ?? null);
            savingRef.value = stored?.saving ?? SETTINGS_SAVING_OFF;
            syncRef.value = new Map((persisted?.syncStates ?? []).map(state => [getTrackedKey(state), state]));
            loadedRef.value = true;
            current.inbox.open();
        }

        /** The choice an older githq kept in the local copy, kept in `localStorage` from now on. */
        function takeOver(tracking: Tracking | null) {
            if (!tracking) {
                return NOTHING_KEPT;
            }

            const kept: KeptSettings = {
                chosen: tracking.chosen,
                document: applyChoice(EMPTY_SETTINGS_DOCUMENT, tracking),
            };
            slot.save({ ...kept, saving: SETTINGS_SAVING_OFF });
            return kept;
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

/** What the slot holds, `null` when nothing understood: a document of another version is not. */
function readStoredSettings(stored: unknown): StoredSettings | null {
    if (!isPlainObject(stored) || typeof stored.chosen !== 'boolean') {
        return null;
    }

    const document = readSettingsDocument(stored.document);
    return document && { chosen: stored.chosen, document, saving: readSettingsSaving(stored.saving) };
}

/** The tracked entries of the document, in its order. */
function toTracking(kept: KeptSettings): Tracking {
    const { repositories, projects } = kept.document;
    return {
        chosen: kept.chosen,
        repositories: repositories
            .filter(repository => repository.tracking)
            .map(({ nameWithOwner, id }) => ({ nameWithOwner, id })),
        projects: projects
            .filter(project => project.tracking)
            .map(({ id, owner, ownerKind, number, title }) => ({ id, owner, ownerKind, number, title })),
    };
}

/**
 * The document tracking exactly `choice`: an entry chosen is tracked in its place and takes the choice's details, one
 * not chosen is untracked and stays, and one new to the document comes after the others in the order given.
 */
function applyChoice(document: SettingsDocument, choice: TrackingChoice): SettingsDocument {
    return {
        ...document,
        repositories: applyEntries(
            document.repositories,
            choice.repositories.map(({ nameWithOwner, id }): SettingsRepository => ({
                nameWithOwner,
                id,
                tracking: true,
            })),
            repository => repository.nameWithOwner,
        ),
        projects: applyEntries(
            document.projects,
            choice.projects.map(({ id, owner, ownerKind, number, title }): SettingsProject => ({
                id,
                owner,
                ownerKind,
                number,
                title,
                tracking: true,
            })),
            project => project.id,
        ),
    };
}

function applyEntries<T extends SettingsRepository | SettingsProject>(
    entries: readonly T[],
    chosen: readonly T[],
    keyOf: (entry: T) => string,
): T[] {
    const chosenByKey = new Map(chosen.map(entry => [keyOf(entry), entry]));
    const known = new Set(entries.map(keyOf));
    const next = entries.map(
        entry => chosenByKey.get(keyOf(entry)) ?? (entry.tracking ? { ...entry, tracking: false } : entry),
    );
    for (const entry of chosen) {
        if (!known.has(keyOf(entry))) {
            known.add(keyOf(entry));
            next.push(entry);
        }
    }

    return next;
}

/** A page of repositories as offered: without the user's settings repository, counted without it too. */
function toCandidateRepositories(page: TrackingRepositoryPageFieldsFragment, login: string): CandidateRepositories {
    const nodes = filterNotNull(page.nodes ?? []);
    const offered = nodes.filter(repository => !isSettingsRepository(repository.nameWithOwner, login));
    return {
        repositories: offered.map(toCandidateRepository),
        totalCount: page.totalCount - (nodes.length - offered.length),
        nextCursor: page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null,
    };
}

/**
 * Whether it is the repository githq keeps the user's settings in (settings-sync D6): never offered to track. One of
 * that name owned by someone else is theirs to track.
 */
function isSettingsRepository(nameWithOwner: string, login: string) {
    return nameWithOwner.toLowerCase() === `${login}/${SETTINGS_REPOSITORY_NAME}`.toLowerCase();
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
