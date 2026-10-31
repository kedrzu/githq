import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { computed, shallowRef, watch } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Freshness } from '@/sync/Freshness.js';
import { getAllowancePause } from '@/sync/getAllowancePause.js';
import { SyncLeadership } from '@/sync/SyncLeadership.js';
import { SyncPausedError } from '@/sync/SyncPausedError.js';
import { TabChannel } from '@/sync/TabChannel.js';
import type { TabMessage } from '@/sync/TabChannel.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { ProjectStore } from './ProjectStore.js';
import { toProjectItem } from './toProject.js';
import type { ReadProjectItem } from './toProject.js';

/** How often GitHub is asked again for a view it answers (K6): slower than the project's own poll (D15). */
export const ANSWER_INTERVAL_MS = 120_000;

/** Items asked for a page; GitHub counts what is asked for, not what is found. */
const PAGE_SIZE = 100;

/** GitHub's answer to a saved view's filter, as far as it has come. */
export interface ProjectViewAnswer {
    /** The project item ids GitHub answered with; `null` until it first has. */
    readonly ids: ReadonlySet<string> | null;
    /** When it last answered (epoch ms). */
    readonly checkedAt: number | null;
    /** The last time it was asked, it did not answer. */
    readonly failing: boolean;
}

/** A saved view whose filter githq can't evaluate, shown now. */
export interface AnsweredView {
    readonly projectId: string;
    /** The view's filter, as GitHub takes it (`items(query:)`). */
    readonly filter: string;
    /** The term githq can't evaluate, as written — what the view says it is answered for. */
    readonly term: string;
}

const NOT_ANSWERED: ProjectViewAnswer = { ids: null, checkedAt: null, failing: false };

/**
 * The saved views GitHub answers instead of githq (K6, D13): a filter githq can't evaluate is run by GitHub
 * (`ProjectItems` with the filter as `query`), and the items it answers with are what the view shows — never the
 * unfiltered items. Asked while the view is shown ({@link show}), again every {@link ANSWER_INTERVAL_MS}; the
 * items read come into the stores too, so they show with their latest fields. Like the sync, it waits for the
 * reset rather than use what is kept of the allowance for the user's edits (`EDIT_RESERVE`). Answers live as long as the
 * signed-in user: kept for another visit of the view, gone with the account.
 *
 * Only the tab that syncs ({@link SyncLeadership}) asks GitHub — for the views shown in any tab of the account,
 * each once whichever tabs show it — and sends every answer to the other tabs, and the one it holds to a tab that
 * starts showing the view.
 */
export type ProjectViewAnswers = Resolved<typeof ProjectViewAnswers>;
export const ProjectViewAnswers = defineService({
    name: 'ProjectViewAnswers',
    deps: {
        accounts: AccountSession,
        projects: ProjectStore,
        items: ItemStore,
        tracking: TrackingStore,
        leadership: SyncLeadership,
        tabs: TabChannel,
        rateLimits: GitHubRateLimitStore,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, projects, items, tracking, leadership, tabs, rateLimits, clock, logger }) {
        const answersRef = shallowRef<ReadonlyMap<string, ProjectViewAnswer>>(new Map());
        const shownRef = shallowRef<AnsweredView | null>(null);
        /** The views GitHub is being asked for now, by key: shown again meanwhile, they are not asked twice. */
        const asking = new Set<string>();
        /** The next question of each view asked for, by key. */
        const timers = new Map<string, () => void>();

        /** The views this tab asks GitHub for, by key: none unless it syncs. */
        const asked = computed(() => {
            const views = new Map<string, AnsweredView>();
            if (!leadership.isLeader) {
                return views;
            }

            for (const view of [shownRef.value, ...tabs.otherViews]) {
                if (view) {
                    views.set(keyOf(view.projectId, view.filter), view);
                }
            }

            return views;
        });

        watch(asked, followAsked, { flush: 'sync' });
        accounts.onChange(() => {
            setShown(null);
            for (const cancel of timers.values()) {
                cancel();
            }

            timers.clear();
            answersRef.value = new Map();
        });
        tabs.onMessage(receive);
        tabs.onViewShown(sendAnswer);

        return {
            /** The view GitHub answers that is shown now, or `null`; reactive. */
            get shown() {
                return shownRef.value;
            },
            get,
            getFreshness,
            show,
        };

        /** GitHub's answer to the view's filter so far; reactive. */
        function get(projectId: string, filter: string): ProjectViewAnswer {
            return answersRef.value.get(keyOf(projectId, filter)) ?? NOT_ANSWERED;
        }

        /** How fresh the shown view GitHub answers is (D15): answered, or not answering; reactive. */
        function getFreshness(view: AnsweredView): Freshness {
            const answer = get(view.projectId, view.filter);
            return answer.failing
                ? { kind: 'stale', since: answer.checkedAt, reason: 'failing' }
                : { kind: 'answered', term: view.term, checkedAt: answer.checkedAt };
        }

        /**
         * The view is shown: GitHub is asked now unless it answered within the interval, then every interval while
         * it stays shown. Returns what stops it — the view is left, or its filter changed.
         */
        function show(view: AnsweredView) {
            setShown(view);
            return () => {
                if (shownRef.value === view) {
                    setShown(null);
                }
            };
        }

        function setShown(view: AnsweredView | null) {
            shownRef.value = view;
            tabs.setShownView(view);
        }

        /**
         * The views to ask for changed: those no longer shown anywhere are not asked again; one shown anew is asked
         * now unless it was answered within the interval.
         */
        function followAsked(views: ReadonlyMap<string, AnsweredView>) {
            for (const [key, cancel] of timers) {
                if (!views.has(key)) {
                    cancel();
                    timers.delete(key);
                }
            }

            for (const [key, view] of views) {
                if (timers.has(key) || asking.has(key)) {
                    continue;
                }

                const answer = answersRef.value.get(key);
                const due = answer?.checkedAt == null ? 0 : answer.checkedAt + ANSWER_INTERVAL_MS - clock.now();
                schedule(view, Math.max(0, due));
            }
        }

        function schedule(view: AnsweredView, delayMs: number) {
            const key = keyOf(view.projectId, view.filter);
            timers.set(
                key,
                clock.schedule(() => {
                    timers.delete(key);
                    void ask(view);
                }, delayMs),
            );
        }

        async function ask(view: AnsweredView) {
            const account = accounts.current;
            if (!account) {
                return;
            }

            const key = keyOf(view.projectId, view.filter);
            if (asking.has(key)) {
                return;
            }

            asking.add(key);
            let pausedUntil: number | null = null;
            try {
                const read = await readAll(account, view);
                if (!accounts.isCurrent(account)) {
                    return;
                }

                // Untracked while GitHub answered: its items must not come back into the stores.
                if (tracking.isTracked({ kind: 'project', id: view.projectId })) {
                    keep(read);
                }

                setAnswer(key, {
                    ids: new Set(read.map(entry => entry.item.itemId)),
                    checkedAt: clock.now(),
                    failing: false,
                });
            } catch (error) {
                if (!accounts.isCurrent(account)) {
                    return;
                }

                if (error instanceof SyncPausedError) {
                    pausedUntil = error.pause.until;
                } else {
                    logger.warn('GitHub did not answer a saved view; asking again later', { error });
                    setAnswer(key, { ...get(view.projectId, view.filter), failing: true });
                }
            } finally {
                asking.delete(key);
            }

            // Still shown somewhere — perhaps shown again meanwhile — it is asked again after the interval, or
            // once the allowance is back.
            const shown = asked.value.get(key);
            if (shown && !timers.has(key)) {
                schedule(shown, pausedUntil === null ? ANSWER_INTERVAL_MS : Math.max(0, pausedUntil - clock.now()));
            }
        }

        /**
         * Another tab shows the view: the syncing tab sends it the answer it holds, rather than let it wait for
         * the next question.
         */
        function sendAnswer(view: AnsweredView) {
            const key = keyOf(view.projectId, view.filter);
            const answer = answersRef.value.get(key);
            if (leadership.isLeader && answer) {
                tabs.publish({ kind: 'projectViewAnswer', key, answer });
            }
        }

        /** Takes in an answer the syncing tab got. */
        function receive(message: TabMessage) {
            if (message.kind === 'projectViewAnswer') {
                answersRef.value = new Map(answersRef.value).set(message.key, message.answer);
            }
        }

        async function readAll(account: Account, view: AnsweredView) {
            const read: ReadProjectItem[] = [];
            let after: string | null = null;
            for (;;) {
                const pause = getAllowancePause(rateLimits.get('graphql'), clock.now());
                if (pause) {
                    throw new SyncPausedError(pause);
                }

                const { node } = await account.sdk.ProjectItems({
                    id: view.projectId,
                    query: view.filter,
                    first: PAGE_SIZE,
                    after,
                });
                if (!node || !('items' in node)) {
                    // Gone, or hidden from the user — at the start or midway: not an answer, let alone an empty one.
                    throw new Error('GitHub did not show the project of a saved view');
                }

                read.push(...filterNotNull(node.items.nodes ?? []).map(item => toProjectItem(item, view.projectId)));
                const { hasNextPage, endCursor } = node.items.pageInfo;
                if (!hasNextPage || endCursor === null) {
                    return read;
                }

                after = endCursor;
            }
        }

        /** The items read go into the stores, but not over a newer copy read meanwhile (the stores see to that). */
        function keep(read: readonly ReadProjectItem[]) {
            projects.upsertItems(read.map(entry => entry.item));
            items.upsertMany(filterNotNull(read.map(entry => entry.content)));
        }

        function setAnswer(key: string, answer: ProjectViewAnswer) {
            answersRef.value = new Map(answersRef.value).set(key, answer);
            tabs.publish({ kind: 'projectViewAnswer', key, answer });
        }
    },
});

function keyOf(projectId: string, filter: string) {
    return `${projectId}\n${filter}`;
}
