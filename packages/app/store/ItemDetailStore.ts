import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef, triggerRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import type { Freshness } from '@/sync/Freshness.js';
import { TabChannel } from '@/sync/TabChannel.js';
import type { TabMessage } from '@/sync/TabChannel.js';

import { isOlderCopy } from './isOlderCopy.js';
import { ItemDetailPersistence } from './ItemDetailPersistence.js';
import { ItemOverlay } from './ItemOverlay.js';
import type { ItemDetailVersion } from './ItemDetailPersistence.js';
import type { ItemDetail } from './ItemDetailTypes.js';
import { ItemStore } from './ItemStore.js';
import type { Item } from './ItemTypes.js';
import { toItemComments, toItemDetail } from './toItemDetail.js';

/**
 * How long an opened item's detail is trusted without asking GitHub again. What changes without moving the
 * item's `updatedAt` — checks, reactions — is read again when it is opened after that.
 */
const RECHECK_AFTER_MS = 60_000;
/** How long a kept detail survives without being read again: the copy must not grow without end. */
const KEEP_DETAIL_MS = 30 * 24 * 60 * 60_000;

/** The signed-in user the details are read for, captured when they signed in. */
interface Session {
    readonly account: Account;
    /** Resolves once the kept versions are read; never rejects. */
    ready: Promise<void>;
    /** The version of every detail kept on disk or read since, by item id. */
    versions: Map<string, ItemDetailVersion>;
    /** The reads under way, by item id: an item asked for again waits for the read it is already in. */
    readonly inFlight: Map<string, Promise<void>>;
}

/**
 * The details of the signed-in user's items (D18) — body, comments, the full check list, reviews, every project
 * field — read when an item is opened ({@link ensure}) or prefetched for "my work" ({@link fetchDetails}), then
 * kept in the user's local copy.
 *
 * A kept detail stays on disk until an item is opened (D17: only the rows are read at the start), so opening
 * one shows it at once; one behind its item's `updatedAt` is read again in the background and replaces it. Each
 * read also refreshes the item's row in the {@link ItemStore}, when the store holds it.
 *
 * Like the store, it follows the signed-in user: their details leave memory when they sign out (here or in
 * another tab) — the item store deletes the copy holding them — and an answer arriving for a session that
 * ended is dropped, never kept. Like the store, it sends the details it read or changed to the user's other
 * tabs, and takes theirs into memory.
 */
export type ItemDetailStore = Resolved<typeof ItemDetailStore>;
export const ItemDetailStore = defineService({
    name: 'ItemDetailStore',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        persistence: ItemDetailPersistence,
        rateLimits: GitHubRateLimitStore,
        overlay: ItemOverlay,
        tabs: TabChannel,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, items, persistence, rateLimits, overlay, tabs, clock, logger }) {
        const detailsRef = shallowRef(new Map<string, ItemDetail>());
        const fetchingRef = shallowRef<ReadonlySet<string>>(new Set());
        const failedRef = shallowRef<ReadonlySet<string>>(new Set());

        let session: Session | null = null;

        accounts.onChange(follow);
        tabs.onMessage(receive);

        return {
            /** Resolves once the kept details can be told apart from missing ones; never rejects. */
            ready: () => session?.ready ?? Promise.resolve(),
            get,
            getItem,
            getFreshness,
            ensure,
            loadOlderComments,
            needsFetch,
            fetchDetails,
            update,
        };

        /**
         * The item's detail in memory, with the user's changes on their way drawn over it ({@link ItemOverlay}), or
         * `undefined` until {@link ensure} brings it; reactive.
         */
        function get(id: string) {
            const detail = detailsRef.value.get(id);
            return detail && overlay.applyToDetail(detail);
        }

        /**
         * The item's row: the store's, or the one read with its detail for an item the store does not hold
         * (opened from outside "my work"); with the user's changes on their way drawn over it. Reactive.
         */
        function getItem(id: string): Item | undefined {
            const detail = detailsRef.value.get(id);
            return items.get(id) ?? (detail && overlay.applyToItem(detail.item));
        }

        /**
         * Changes the item's detail in memory and on disk — an edit GitHub confirmed. Ignored while it is not in
         * memory: it is read whole when opened.
         */
        function update(id: string, change: (detail: ItemDetail) => ItemDetail) {
            const current = session;
            const detail = detailsRef.value.get(id);
            if (!current || !detail) {
                return;
            }

            const updated = change(detail);
            detailsRef.value.set(id, updated);
            triggerRef(detailsRef);
            write(current, [updated]);
            tabs.publish({ kind: 'details', details: [updated] });
        }

        /**
         * How current the item's detail is, for its segment of the status bar (D15); reactive.
         *
         * - `partial`: none yet — the comments are still loading;
         * - `fresh`: read with the item's current `updatedAt` (re-reading it in the background stays `fresh`);
         * - `checking`: behind the item, being read again;
         * - `stale`: behind the item, or none at all, and GitHub could not be asked or did not answer.
         */
        function getFreshness(id: string): Freshness {
            const detail = detailsRef.value.get(id);
            const failed = failedRef.value.has(id);
            if (!detail) {
                return failed ? { kind: 'stale', since: null, reason: 'failing' } : { kind: 'partial' };
            }

            if (!isBehind(detail)) {
                return { kind: 'fresh', checkedAt: detail.fetchedAt };
            }

            if (fetchingRef.value.has(id)) {
                return { kind: 'checking', since: detail.fetchedAt };
            }

            return { kind: 'stale', since: detail.fetchedAt, reason: failed ? 'failing' : 'late' };
        }

        /**
         * Brings the item's detail into memory for an item being opened: the kept one at once, then — when there
         * is none, it is behind the item, or it was read over a minute ago — a fresh one from GitHub. Resolves
         * when both are done; never rejects (a failure shows in {@link getFreshness}).
         */
        async function ensure(id: string) {
            const current = session;
            if (!current) {
                return;
            }

            await current.ready;
            if (!isCurrent(current)) {
                return;
            }

            await readKept(current, id);
            if (!isCurrent(current)) {
                return;
            }

            const detail = detailsRef.value.get(id);
            if (detail && !isBehind(detail) && clock.now() - detail.fetchedAt < RECHECK_AFTER_MS) {
                return;
            }

            await fetchDetail(current, id);
        }

        /**
         * Whether the prefetch should read the item's detail: none is kept, or the one kept is behind the item.
         * `false` while one is being read. Exact once {@link ready} resolves.
         */
        function needsFetch(id: string) {
            const current = session;
            if (!current || current.inFlight.has(id)) {
                return false;
            }

            const version = current.versions.get(id);
            if (!version) {
                return true;
            }

            const item = items.get(id);
            return item !== undefined && item.updatedAt !== version.itemUpdatedAt;
        }

        /**
         * Reads the details of `ids` in one `ItemDetails` call (at most 10: GitHub's cost grows with them) and
         * keeps them. Returns the ids GitHub would not give (deleted, or hidden from the user); ids being read
         * already are skipped. Rejects when the call fails as a whole.
         */
        async function fetchDetails(ids: readonly string[]): Promise<readonly string[]> {
            const current = session;
            if (!current) {
                return [];
            }

            await current.ready;
            const wanted = ids.filter(id => !current.inFlight.has(id));
            if (!isCurrent(current) || wanted.length === 0) {
                return [];
            }

            const errors: GitHubGraphQLErrorEntry[] = [];
            const answer = current.account.sdk.ItemDetails(
                { ids: wanted },
                { onPartialErrors: found => errors.push(...found) },
            );
            const settled = answer.then(
                () => undefined,
                () => undefined,
            );
            for (const id of wanted) {
                current.inFlight.set(id, settled);
            }

            setFetching(wanted, true);
            try {
                const { nodes } = await answer;
                if (!isCurrent(current)) {
                    return [];
                }

                if (errors.length > 0) {
                    logger.warn('Item details read in part', { errors });
                }

                const fetchedAt = clock.now();
                const read: ItemDetail[] = [];
                const unreadable: string[] = [];
                for (const [index, id] of wanted.entries()) {
                    const detail = toItemDetail(nodes[index] ?? null, fetchedAt);
                    if (detail) {
                        read.push(detail);
                    } else {
                        unreadable.push(id);
                    }
                }

                keep(current, read);
                return unreadable;
            } finally {
                for (const id of wanted) {
                    current.inFlight.delete(id);
                }

                if (isCurrent(current)) {
                    setFetching(wanted, false);
                }
            }
        }

        /**
         * Reads the comments older than those in memory (`MoreComments`, 100 at a time) and puts them before
         * them. Rejects when GitHub does not answer.
         */
        async function loadOlderComments(id: string) {
            const current = session;
            const cursor = detailsRef.value.get(id)?.comments.olderCursor;
            if (!current || !cursor) {
                return;
            }

            const { node } = await current.account.sdk.MoreComments({ id, before: cursor });
            const detail = detailsRef.value.get(id);
            // Read again meanwhile, from another page: these would not join it.
            if (!isCurrent(current) || !detail || detail.comments.olderCursor !== cursor) {
                return;
            }

            if (!node || !('commentPage' in node)) {
                logger.warn('Older comments could not be read', { id });
                return;
            }

            const older = toItemComments(node.commentPage);
            const updated: ItemDetail = {
                ...detail,
                comments: {
                    totalCount: older.totalCount,
                    nodes: [...older.nodes, ...detail.comments.nodes],
                    olderCursor: older.olderCursor,
                },
            };
            detailsRef.value.set(id, updated);
            triggerRef(detailsRef);
            write(current, [updated]);
            tabs.publish({ kind: 'details', details: [updated] });
        }

        /**
         * Takes in the details another tab of the user read or changed — in memory only: that tab writes them. At once,
         * unlike the stores reading their whole copy at sign-in (`createTabInbox`): a kept detail is read later, one
         * at a time, only where memory holds none, and a version received is never replaced by a kept one.
         */
        function receive(message: TabMessage, login: string) {
            const current = session;
            if (message.kind !== 'details' || current?.account.login !== login) {
                return;
            }

            const taken = message.details.filter(detail => !isOlder(detail));
            for (const detail of taken) {
                detailsRef.value.set(detail.id, withOlderComments(detailsRef.value.get(detail.id), detail));
                current.versions.set(detail.id, { itemUpdatedAt: detail.item.updatedAt, fetchedAt: detail.fetchedAt });
            }

            triggerRef(detailsRef);
            setFailed(
                taken.map(detail => detail.id),
                false,
            );
        }

        /** Another account signed in, or none: the details of whoever was before leave memory. */
        function follow(account: Account | null) {
            session = null;
            detailsRef.value = new Map();
            fetchingRef.value = new Set();
            failedRef.value = new Set();
            if (!account) {
                return;
            }

            const current: Session = {
                account,
                ready: Promise.resolve(),
                versions: new Map(),
                inFlight: new Map(),
            };
            session = current;
            current.ready = readVersions(current);
        }

        /** Reads which details the copy keeps, once the item store opened it, and drops the long unread ones. */
        async function readVersions(current: Session) {
            await items.ready();
            if (!isCurrent(current)) {
                return;
            }

            let versions: ReadonlyMap<string, ItemDetailVersion>;
            try {
                versions = await persistence.loadDetailVersions(current.account.login);
            } catch (error) {
                logger.warn('Could not read which item details are kept; reading them again from GitHub', { error });
                return;
            }

            if (!isCurrent(current)) {
                return;
            }

            const expired: string[] = [];
            for (const [id, version] of versions) {
                if (current.versions.has(id)) {
                    // Read since — here or in another tab: that one is newer.
                    continue;
                }

                if (clock.now() - version.fetchedAt > KEEP_DETAIL_MS) {
                    expired.push(id);
                } else {
                    current.versions.set(id, version);
                }
            }

            if (expired.length > 0) {
                persistence.deleteDetails(current.account.login, expired).catch((error: unknown) => {
                    logger.warn('Could not delete item details kept too long', { error });
                });
            }
        }

        /** Puts the kept detail of `id` into memory, unless one is there already. */
        async function readKept(current: Session, id: string) {
            if (detailsRef.value.has(id) || !current.versions.has(id)) {
                return;
            }

            let detail: ItemDetail | null = null;
            try {
                detail = await persistence.loadDetail(current.account.login, id);
            } catch (error) {
                logger.warn('Could not read a kept item detail; reading it from GitHub', { error });
            }

            if (detail && isCurrent(current) && !detailsRef.value.has(id)) {
                detailsRef.value.set(id, detail);
                triggerRef(detailsRef);
            }
        }

        /** Reads one item's detail (`ItemDetail`), or waits for the read it is already in. */
        function fetchDetail(current: Session, id: string) {
            let running = current.inFlight.get(id);
            if (!running) {
                running = readDetail(current, id).finally(() => current.inFlight.delete(id));
                current.inFlight.set(id, running);
            }

            return running;
        }

        async function readDetail(current: Session, id: string) {
            if (rateLimits.remaining('graphql') === 0) {
                setFailed([id], true);
                return;
            }

            setFetching([id], true);
            try {
                const errors: GitHubGraphQLErrorEntry[] = [];
                const { node } = await current.account.sdk.ItemDetail(
                    { id },
                    { onPartialErrors: found => errors.push(...found) },
                );
                if (!isCurrent(current)) {
                    return;
                }

                const detail = toItemDetail(node, clock.now());
                if (detail) {
                    if (errors.length > 0) {
                        logger.warn('Item detail read without the fields GitHub refused', { id, errors });
                    }

                    keep(current, [detail]);
                } else {
                    logger.warn('Item detail could not be read', { id, errors });
                    setFailed([id], true);
                }
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Item detail could not be read', { id, error });
                    setFailed([id], true);
                }
            } finally {
                if (isCurrent(current)) {
                    setFetching([id], false);
                }
            }
        }

        /**
         * Puts details just read into memory and on disk, and their rows into the item store when it holds
         * them — never adding one: an item outside "my work" would leave the store at the next poll. A detail
         * older than the one held ({@link isOlderCopy}) — read before an edit GitHub confirmed meanwhile — is not.
         */
        function keep(current: Session, read: readonly ItemDetail[]) {
            const details = detailsRef.value;
            const kept: ItemDetail[] = [];
            const rows: Item[] = [];
            for (const fresh of read) {
                if (isOlder(fresh)) {
                    continue;
                }

                const detail = withOlderComments(details.get(fresh.id), fresh);
                details.set(detail.id, detail);
                kept.push(detail);
                current.versions.set(detail.id, { itemUpdatedAt: detail.item.updatedAt, fetchedAt: detail.fetchedAt });
                if (items.getStored(detail.id)) {
                    rows.push(detail.item);
                }
            }

            setFailed(
                read.map(detail => detail.id),
                false,
            );
            if (kept.length === 0) {
                return;
            }

            triggerRef(detailsRef);
            items.upsertMany(rows);
            write(current, kept);
            tabs.publish({ kind: 'details', details: kept });
        }

        function write(current: Session, details: readonly ItemDetail[]) {
            persistence.saveDetails(current.account.login, details).catch((error: unknown) => {
                logger.warn('Could not keep item details; they are read again from GitHub next time', { error });
            });
        }

        function isOlder(detail: ItemDetail) {
            const held = detailsRef.value.get(detail.id);
            return held !== undefined && isOlderCopy(detail.item, held.item, clock.now());
        }

        /** Whether the item's row has moved since its detail was read. */
        function isBehind(detail: ItemDetail) {
            const item = items.get(detail.id);
            return item !== undefined && item.updatedAt !== detail.item.updatedAt;
        }

        /** Whether `current` is still the session — here and in the store every request was authorised by. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }

        function setFetching(ids: readonly string[], fetching: boolean) {
            fetchingRef.value = toggle(fetchingRef.value, ids, fetching);
        }

        function setFailed(ids: readonly string[], failed: boolean) {
            failedRef.value = toggle(failedRef.value, ids, failed);
        }
    },
});

/**
 * A detail read again keeps the older comments read before it, when its newest page joins them — so "show
 * older" is not undone by a read in the background.
 */
function withOlderComments(previous: ItemDetail | undefined, fresh: ItemDetail): ItemDetail {
    const first = fresh.comments.nodes[0];
    if (!previous || !first || fresh.comments.olderCursor === null) {
        return fresh;
    }

    const joinAt = previous.comments.nodes.findIndex(comment => comment.id === first.id);
    if (joinAt <= 0) {
        return fresh;
    }

    return {
        ...fresh,
        comments: {
            ...fresh.comments,
            nodes: [...previous.comments.nodes.slice(0, joinAt), ...fresh.comments.nodes],
            olderCursor: previous.comments.olderCursor,
        },
    };
}

function toggle(set: ReadonlySet<string>, ids: readonly string[], present: boolean): ReadonlySet<string> {
    const next = new Set(set);
    for (const id of ids) {
        if (present) {
            next.add(id);
        } else {
            next.delete(id);
        }
    }

    return next;
}
