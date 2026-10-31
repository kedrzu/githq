import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { computed, shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import type { PersistedProject } from '@/projects/ProjectPersistence.js';
import type { ProjectItem } from '@/projects/ProjectTypes.js';
import type { AnsweredView, ProjectViewAnswer } from '@/projects/ProjectViewAnswers.js';
import { Browser } from '@/services/Browser.js';
import type { BrowserChannel } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { LOCAL_DATABASE_VERSION } from '@/store/IndexedDbPersistence.js';
import type { ItemDetail } from '@/store/ItemDetailTypes.js';
import type { MyWorkGroup, SyncLoop, SyncLoopState } from '@/store/ItemStoreTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import type { TrackedSyncState, Tracking } from '@/tracking/TrackingTypes.js';

import type { SyncLoopStatus } from './SyncEngine.js';

/**
 * A change one tab made to what the app's tabs show, for the others to take into memory: each store sends what it
 * changed itself — the syncing tab what it read from GitHub, any tab the edits GitHub confirmed to it — and takes
 * in what the others sent, without writing it (the sender wrote it to the local copy they share) and without
 * sending it on.
 */
export type TabMessage =
    | { readonly kind: 'items'; readonly upserted: readonly Item[]; readonly removed: readonly string[] }
    | { readonly kind: 'membership'; readonly group: MyWorkGroup; readonly ids: readonly string[] }
    | { readonly kind: 'syncState'; readonly loop: SyncLoop; readonly state: SyncLoopState }
    | { readonly kind: 'details'; readonly details: readonly ItemDetail[] }
    | { readonly kind: 'tracking'; readonly tracking: Tracking }
    | { readonly kind: 'trackedSyncState'; readonly state: TrackedSyncState; readonly deleted: boolean }
    | { readonly kind: 'project'; readonly project: PersistedProject }
    | { readonly kind: 'projectRemoved'; readonly projectId: string }
    | { readonly kind: 'projectItems'; readonly upserted: readonly ProjectItem[]; readonly removed: readonly string[] }
    | { readonly kind: 'rateLimit'; readonly rateLimit: GitHubRateLimit }
    | { readonly kind: 'syncStatus'; readonly status: Readonly<Record<SyncLoop, SyncLoopStatus>> }
    | { readonly kind: 'projectViewAnswer'; readonly key: string; readonly answer: ProjectViewAnswer };

/** How often a tab says again how it is, so the others know it is still there. */
const HEARTBEAT_MS = 30_000;
/**
 * How long another tab is believed without hearing from it: two heartbeats missed — it crashed, or the browser
 * discarded it without `pagehide`. A hidden tab's timers may run only once a minute, still within it.
 */
const PRESENCE_EXPIRES_MS = 75_000;

/** What a tab tells the others about itself: whether it is shown, and the view GitHub answers it shows. */
interface TabPresence {
    readonly visible: boolean;
    readonly shownView: AnsweredView | null;
}

/** The tabs' own conversation: one joins (and asks the others to say how they are), says how it is, or leaves. */
type PresenceMessage =
    | { readonly kind: 'hello'; readonly presence: TabPresence }
    | { readonly kind: 'presence'; readonly presence: TabPresence }
    | { readonly kind: 'bye' };

/** A message as it travels: from which tab, for which account. */
interface Envelope {
    readonly login: string;
    readonly from: string;
    readonly body: TabMessage | PresenceMessage;
}

/** The channel of one account in this tab. */
interface Session {
    readonly account: Account;
    readonly channel: BrowserChannel;
    /** When each other tab was last heard from (epoch ms), by its id. */
    readonly heardAt: Map<string, number>;
    /** Cancels the next heartbeat; `null` while none is due — no other tab is known, none needs to hear it. */
    stopHeartbeat: (() => void) | null;
}

/**
 * How the app's tabs of one account talk (Q10): over the `BroadcastChannel` `githq-<login>-v<N>`, `N` being the
 * local copy's layout ({@link LOCAL_DATABASE_VERSION}) — tabs of a githq that keeps its copy another way do not
 * understand each other, and do not hear each other. Only the tab that holds the sync lock (`SyncLeadership`)
 * asks GitHub for changes; every tab sends what it changed ({@link TabMessage}) and takes in what the others did,
 * so they show the same.
 *
 * Why the changes themselves travel, rather than a ping to read them again from IndexedDB: the stores keep
 * everything in memory and write behind, so a re-read would race the writer's pending batch, cost a full read
 * per change, and still need a message per kind of change to know what to read.
 *
 * It also keeps how the other tabs are — shown or hidden, which view GitHub answers in them — so the syncing
 * tab polls as often as the most visible tab needs, and answers the views shown anywhere. While it knows another
 * tab, every tab says how it is again every {@link HEARTBEAT_MS}; one not heard from for
 * {@link PRESENCE_EXPIRES_MS} is forgotten — it ended without saying goodbye.
 *
 * It follows the signed-in account: another one (or none) leaves the channel, says goodbye, and forgets the
 * other tabs. A message of another account is never delivered.
 */
export type TabChannel = Resolved<typeof TabChannel>;
export const TabChannel = defineService({
    name: 'TabChannel',
    deps: {
        accounts: AccountSession,
        browser: Browser,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, browser, clock, logger }) {
        const tabId = createTabId();
        const visibleRef = shallowRef(browser.isVisible());
        const shownViewRef = shallowRef<AnsweredView | null>(null);
        const othersRef = shallowRef<ReadonlyMap<string, TabPresence>>(new Map());
        const messageListeners: ((message: TabMessage, login: string) => void)[] = [];
        const joinListeners: (() => void)[] = [];
        const viewListeners: ((view: AnsweredView) => void)[] = [];

        const anyVisible = computed(() => visibleRef.value || [...othersRef.value.values()].some(tab => tab.visible));
        const otherViews = computed(() => {
            const views: AnsweredView[] = [];
            for (const tab of othersRef.value.values()) {
                if (tab.shownView) {
                    views.push(tab.shownView);
                }
            }

            return views;
        });

        let session: Session | null = null;

        accounts.onChange(follow);
        browser.onVisibilityChange(() => {
            visibleRef.value = browser.isVisible();
            sayPresence();
        });
        browser.onPageLifecycle(event => {
            switch (event) {
                case 'pagehide':
                    post({ kind: 'bye' });
                    break;
                case 'resume':
                    // Its heartbeats stopped while frozen: the others may have forgotten it.
                    sayPresence();
                    break;
                case 'freeze':
                    break;
            }
        });

        return {
            /** Whether this tab or another of the account is shown; reactive. */
            get anyVisible() {
                return anyVisible.value;
            },
            /** The views GitHub answers that the account's other tabs show; reactive. */
            get otherViews(): readonly AnsweredView[] {
                return otherViews.value;
            },
            publish,
            onMessage,
            onTabJoined,
            onViewShown,
            setShownView,
        };

        /** Sends `message` to the account's other tabs; nothing while signed out. */
        function publish(message: TabMessage) {
            post(message);
        }

        /** Calls `listener` with each change another tab of the account sends, and the account's login. */
        function onMessage(listener: (message: TabMessage, login: string) => void) {
            messageListeners.push(listener);
        }

        /** Calls `listener` when another tab of the account opens: what only memory holds may be sent to it. */
        function onTabJoined(listener: () => void) {
            joinListeners.push(listener);
        }

        /**
         * Calls `listener` when another tab of the account starts showing a view GitHub answers — it opened with
         * it, or went to it: an answer this tab holds may be sent to it.
         */
        function onViewShown(listener: (view: AnsweredView) => void) {
            viewListeners.push(listener);
        }

        /** Tells the other tabs which view GitHub answers this one shows (`null`: none). */
        function setShownView(view: AnsweredView | null) {
            // A copy: a component's view may be reactive, which cannot be posted.
            shownViewRef.value = view && { projectId: view.projectId, filter: view.filter, term: view.term };
            sayPresence();
        }

        function follow(account: Account | null) {
            if (session) {
                post({ kind: 'bye' });
                session.stopHeartbeat?.();
                session.channel.close();
                session = null;
                othersRef.value = new Map();
            }

            if (!account) {
                return;
            }

            const name = `githq-${account.login}-v${LOCAL_DATABASE_VERSION}`;
            const current: Session = {
                account,
                channel: browser.openChannel(name, receive),
                heardAt: new Map(),
                stopHeartbeat: null,
            };
            session = current;
            post({ kind: 'hello', presence: getPresence() });
            logger.debug('Tab channel joined', { name });
        }

        /**
         * Says how this tab is again after a while, and forgets the tabs not heard from for too long — while another
         * tab is known: a tab that knows this one answered its `hello`, or sent its own.
         */
        function scheduleHeartbeat(current: Session) {
            current.stopHeartbeat = clock.schedule(() => {
                current.stopHeartbeat = null;
                if (session !== current) {
                    return;
                }

                sayPresence();
                forgetSilent(current);
                if (current.heardAt.size > 0) {
                    scheduleHeartbeat(current);
                }
            }, HEARTBEAT_MS);
        }

        function forgetSilent(current: Session) {
            const silent = [...current.heardAt].filter(([, at]) => clock.now() - at >= PRESENCE_EXPIRES_MS);
            if (silent.length === 0) {
                return;
            }

            const next = new Map(othersRef.value);
            for (const [id] of silent) {
                current.heardAt.delete(id);
                next.delete(id);
            }

            othersRef.value = next;
        }

        function receive(data: unknown) {
            const current = session;
            // A late message of an account this tab left, or of another githq.
            if (!current || !isEnvelope(data) || data.login !== current.account.login) {
                return;
            }

            const { from, body } = data;
            switch (body.kind) {
                case 'hello':
                    setOther(current, from, body.presence);
                    post({ kind: 'presence', presence: getPresence() });
                    for (const listener of joinListeners) {
                        listener();
                    }

                    return;
                case 'presence':
                    setOther(current, from, body.presence);
                    return;
                case 'bye': {
                    current.heardAt.delete(from);
                    const next = new Map(othersRef.value);
                    next.delete(from);
                    othersRef.value = next;
                    return;
                }
                default:
                    for (const listener of messageListeners) {
                        listener(body, current.account.login);
                    }
            }
        }

        function setOther(current: Session, from: string, presence: TabPresence) {
            current.heardAt.set(from, clock.now());
            if (!current.stopHeartbeat) {
                scheduleHeartbeat(current);
            }

            const known = othersRef.value.get(from);
            // A heartbeat that changes nothing changes nothing for those following the other tabs.
            if (known?.visible === presence.visible && isSameView(known.shownView, presence.shownView)) {
                return;
            }

            const before = known?.shownView;
            othersRef.value = new Map(othersRef.value).set(from, presence);

            const view = presence.shownView;
            if (view && !isSameView(before ?? null, view)) {
                for (const listener of viewListeners) {
                    listener(view);
                }
            }
        }

        function sayPresence() {
            post({ kind: 'presence', presence: getPresence() });
        }

        function getPresence(): TabPresence {
            return { visible: visibleRef.value, shownView: shownViewRef.value };
        }

        function post(body: TabMessage | PresenceMessage) {
            const current = session;
            if (!current) {
                return;
            }

            const envelope: Envelope = { login: current.account.login, from: tabId, body };
            try {
                current.channel.post(envelope);
            } catch (error) {
                // Something that cannot be cloned: the other tabs miss this change until the next one of it.
                logger.warn('A change could not be sent to the other tabs', { kind: body.kind, error });
            }
        }

        function createTabId() {
            const bytes = new Uint8Array(8);
            browser.getRandomValues(bytes);
            return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        }
    },
});

/**
 * Whether `data` is a message of the tabs' protocol. Its body is trusted beyond its `kind`: only githq posts on
 * the channel, and only a githq of the same copy layout listens on it (the channel's name says which).
 */
function isEnvelope(data: unknown): data is Envelope {
    return (
        isPlainObject(data) &&
        typeof data.login === 'string' &&
        typeof data.from === 'string' &&
        isPlainObject(data.body) &&
        typeof data.body.kind === 'string'
    );
}

function isSameView(a: AnsweredView | null, b: AnsweredView | null) {
    return a?.projectId === b?.projectId && a?.filter === b?.filter;
}
