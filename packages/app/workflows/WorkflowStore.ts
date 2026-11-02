import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { computed, shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { ItemStore } from '@/store/ItemStore.js';
import { createTabInbox } from '@/sync/createTabInbox.js';
import type { TabInbox } from '@/sync/createTabInbox.js';
import { TabChannel } from '@/sync/TabChannel.js';
import type { TabMessage } from '@/sync/TabChannel.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { createUnreadWorkflows } from './utils/createUnreadWorkflows.js';
import { getRepositoryWorkflowState } from './utils/getRepositoryWorkflowState.js';
import { WorkflowPersistence } from './WorkflowPersistence.js';
import type { RepositoryWorkflowState, RepositoryWorkflows, WorkflowRefSettings } from './WorkflowTypes.js';

/** A tracked repository's workflows' state, for the cross-repository screen and the sidebar's markers. */
export interface TrackedRepositoryWorkflowState {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly state: RepositoryWorkflowState;
}

/** What the sidebar's cross-repository entry says, over every tracked repository (actions D6). */
export interface WorkflowTotals {
    /** Broken workflows in all tracked repositories. */
    readonly brokenCount: number;
    /** Some workflow broke less than a day ago. */
    readonly hasNewBreak: boolean;
    /** Some tracked repository's workflows were never read: the total may be short. */
    readonly hasUnread: boolean;
    /** GitHub shows no workflow state for some tracked repository. */
    readonly hasUnavailable: boolean;
}

/** The refs that count while a repository's settings say nothing else (actions D5). */
const DEFAULT_REF_SETTINGS: WorkflowRefSettings = { countDefaultBranch: true, patterns: [] };

/** The signed-in user the workflows are kept for, captured when they signed in. */
interface Session {
    readonly account: Account;
    /** Resolves once the kept workflows are in memory; never rejects. */
    ready: Promise<void>;
    /** What other tabs send: held until the kept copy is read, then taken in over it. */
    readonly inbox: TabInbox;
}

/**
 * The tracked repositories' GitHub Actions workflows and their latest counted runs (actions D2, D4), as the sync last
 * read them, and how each repository's workflows stand — worked out on read from them and from the refs that count
 * ({@link getRefSettings}), so a changed pattern needs no new read. Only tracked repositories are kept: one the user
 * stops tracking has its workflows dropped, here and on disk.
 *
 * Kept in the account's local copy, one record per repository, written as the sync sets it; it follows the signed-in
 * user like the other stores, and sends its changes to the user's other tabs and takes theirs into memory. "Broken
 * for less than a day" is told against the time of the latest change, so it turns at the next poll at worst.
 */
export type WorkflowStore = Resolved<typeof WorkflowStore>;
export const WorkflowStore = defineService({
    name: 'WorkflowStore',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        tracking: TrackingStore,
        persistence: WorkflowPersistence,
        tabs: TabChannel,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, items, tracking, persistence, tabs, clock, logger }) {
        const storedRef = shallowRef<ReadonlyMap<string, RepositoryWorkflows>>(new Map());
        const loadedRef = shallowRef(false);
        // When the copy last changed: what "new" is told against, so it moves with the polls.
        const nowRef = shallowRef(clock.now());

        const repositories = computed((): readonly TrackedRepositoryWorkflowState[] =>
            tracking.repositories.map(repo => ({
                nameWithOwner: repo.nameWithOwner,
                state: getState(repo.nameWithOwner),
            })),
        );
        const totals = computed((): WorkflowTotals => {
            let brokenCount = 0;
            let hasNewBreak = false;
            let hasUnread = false;
            let hasUnavailable = false;
            for (const { state } of repositories.value) {
                brokenCount += state.brokenCount;
                hasNewBreak ||= state.hasNewBreak;
                hasUnread ||= state.status === 'unread';
                hasUnavailable ||= state.status === 'unavailable';
            }

            return { brokenCount, hasNewBreak, hasUnread, hasUnavailable };
        });

        let session: Session | null = null;

        accounts.onChange(follow);
        tabs.onMessage(receive);
        tracking.onUntrack(target => {
            if (target.kind === 'repository') {
                remove(target.nameWithOwner);
            }
        });

        return {
            /** Whether the signed-in user's kept workflows are in memory; reactive. */
            get loaded() {
                return loadedRef.value;
            },
            /** Every tracked repository's workflows' state, in the user's order; reactive. */
            get repositories() {
                return repositories.value;
            },
            /** The sidebar's total over every tracked repository; reactive. */
            get totals() {
                return totals.value;
            },
            ready,
            get,
            getState,
            getRefSettings,
            set,
            remove,
        };

        /** Resolves once the signed-in user's kept workflows are in memory (at once when signed out); never rejects. */
        async function ready() {
            await Promise.resolve();
            await session?.ready;
        }

        /** The tracked repository's workflows as last read, or `undefined` before the first read; reactive. */
        function get(nameWithOwner: string): RepositoryWorkflows | undefined {
            return storedRef.value.get(nameWithOwner);
        }

        /** How the tracked repository's workflows stand on the refs that count; `unread` before the first read. Reactive. */
        function getState(nameWithOwner: string): RepositoryWorkflowState {
            const stored = storedRef.value.get(nameWithOwner) ?? createUnreadWorkflows(nameWithOwner);
            return getRepositoryWorkflowState(stored, getRefSettings(nameWithOwner), nowRef.value);
        }

        /**
         * Which refs light the repository's counters (actions D5): its default branch for now, for every repository.
         * The one place they are decided — the repository's settings (D14) are read here once they exist.
         */
        function getRefSettings(_nameWithOwner: string): WorkflowRefSettings {
            return DEFAULT_REF_SETTINGS;
        }

        /** Keeps what the sync read of a tracked repository; ignored while signed out or once it is no longer tracked. */
        function set(workflows: RepositoryWorkflows) {
            const current = session;
            if (!current || !tracking.isTracked({ kind: 'repository', nameWithOwner: workflows.nameWithOwner })) {
                return;
            }

            put(workflows.nameWithOwner, workflows);
            tabs.publish({ kind: 'workflows', nameWithOwner: workflows.nameWithOwner, workflows });
            persistence.saveWorkflows(current.account.login, workflows).catch((error: unknown) => {
                if (isCurrent(current)) {
                    logger.warn('Could not keep the workflows of a tracked repository', { error });
                }
            });
        }

        /** Drops the repository's workflows — it is no longer tracked. Ignored while signed out. */
        function remove(nameWithOwner: string) {
            const current = session;
            if (!current) {
                return;
            }

            put(nameWithOwner, null);
            tabs.publish({ kind: 'workflows', nameWithOwner, workflows: null });
            deleteKept(current, nameWithOwner);
        }

        function put(nameWithOwner: string, workflows: RepositoryWorkflows | null) {
            const next = new Map(storedRef.value);
            if (workflows) {
                next.set(nameWithOwner, workflows);
            } else {
                next.delete(nameWithOwner);
            }

            storedRef.value = next;
            nowRef.value = clock.now();
        }

        function deleteKept(current: Session, nameWithOwner: string) {
            persistence.deleteWorkflows(current.account.login, nameWithOwner).catch((error: unknown) => {
                if (isCurrent(current)) {
                    logger.warn('Could not delete the workflows of an untracked repository', { error });
                }
            });
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
            if (message.kind === 'workflows') {
                put(message.nameWithOwner, message.workflows);
            }
        }

        /** Another account signed in, or none: the workflows of whoever was before leave memory. */
        function follow(account: Account | null) {
            session = null;
            storedRef.value = new Map();
            loadedRef.value = false;
            if (!account) {
                return;
            }

            const current: Session = { account, ready: Promise.resolve(), inbox: createTabInbox(takeIn) };
            session = current;
            current.ready = readKept(current);
        }

        /**
         * Puts the kept workflows into memory once the local copy is open and the tracking choice is in, under what was
         * read since. Those of a repository no longer tracked — its untrack's delete was cut off — are deleted.
         */
        async function readKept(current: Session) {
            await Promise.all([items.ready(), tracking.ready()]);
            if (!isCurrent(current)) {
                return;
            }

            try {
                const kept = await persistence.loadWorkflows(current.account.login);
                if (!isCurrent(current)) {
                    return;
                }

                const next = new Map<string, RepositoryWorkflows>();
                for (const workflows of kept) {
                    if (tracking.isTracked({ kind: 'repository', nameWithOwner: workflows.nameWithOwner })) {
                        next.set(workflows.nameWithOwner, workflows);
                    } else {
                        deleteKept(current, workflows.nameWithOwner);
                    }
                }

                storedRef.value = new Map([...next, ...storedRef.value]);
                nowRef.value = clock.now();
            } catch (error) {
                logger.warn('Could not read the kept workflows; reading them again from GitHub', { error });
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
