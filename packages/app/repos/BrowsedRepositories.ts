import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import { listRepositoryIssuesSince } from '@githq/github/rest/listRepositoryIssuesSince.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { splitIntoChunks } from '@nzyme/utils/array/splitIntoChunks.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed, shallowRef, triggerRef, watch } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { REPOSITORY_STATES } from '@/repository/buildRepositoryList.js';
import type { RepositoryState } from '@/repository/buildRepositoryList.js';
import { getSectionItemKind } from '@/repository/RepositorySection.js';
import type { RepositoryItemSection } from '@/repository/RepositorySection.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { toItem } from '@/store/toItem.js';
import type { Freshness } from '@/sync/Freshness.js';
import { FRESH_SLACK_MS, getFreshness } from '@/sync/Freshness.js';
import { getAllowancePause } from '@/sync/getAllowancePause.js';
import { getRefusalPause } from '@/sync/getRefusalPause.js';
import { readItemsByIds } from '@/sync/readItemsByIds.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { SyncPausedError } from '@/sync/SyncPausedError.js';
import { NODES_BATCH_SIZE, PULL_REQUEST_PAGE_SIZE, SINCE_SLACK_MS } from '@/sync/TrackingSync.js';
import { TrackedItems } from '@/tracking/TrackedItems.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { RepositoryHolds } from './RepositoryHolds.js';

/** A section read this recently asks nothing on entering (D34). */
export const BROWSE_FRESH_MS = 10_000;
/** How often the section on screen is checked: the interval of a tracked repository's change poll (D34). */
export const BROWSE_POLL_MS = 60_000;

const SECTIONS: readonly RepositoryItemSection[] = ['issues', 'pullRequests'];
/** The GraphQL states of each state the list filters by. */
const ISSUE_STATES = { open: ['OPEN'], closed: ['CLOSED'], all: ['OPEN', 'CLOSED'] } as const;
const PULL_REQUEST_STATES = {
    open: ['OPEN'],
    closed: ['CLOSED', 'MERGED'],
    all: ['OPEN', 'CLOSED', 'MERGED'],
} as const;

/** What a screen shows of a browsed repository. */
export interface BrowsedSectionView {
    readonly nameWithOwner: string;
    readonly section: RepositoryItemSection;
    readonly state: RepositoryState;
}

/** How the reading of one state of a browsed section stands; reactive. */
export interface BrowsedStatus {
    /** A page of this state is on its way. */
    readonly reading: boolean;
    /** GitHub's total for the section and state, as of the last page read; `null` before the first. */
    readonly total: number | null;
    readonly hasMore: boolean;
    /** Where the next page starts, `null` with none: it moves only as a page is read, a refused one leaving it. */
    readonly cursor: string | null;
    /** GitHub does not show the repository to this user. */
    readonly notShown: boolean;
    /** GitHub's own name, when it differs from the name asked by: the section's state is under it already. */
    readonly settledName: string | null;
}

/** How far one state of a section is read. */
interface StatePages {
    cursor: string | null;
    /** `null` until its first page is read. */
    total: number | null;
    reading: boolean;
}

/** One repository section's reading state. The object lasts until its hold is let go, whatever name it moves to. */
interface BrowsedSectionState {
    nameWithOwner: string;
    readonly section: RepositoryItemSection;
    since: string;
    etag: string | undefined;
    /** When GitHub last answered for the section as a whole. */
    checkedAt: number | null;
    /** When it was last asked at a refresh: the timer counts from it, as scrolling for more pages must not delay it. */
    askedAt: number | null;
    /** The last check stopped before reading all that moved, the tab hidden: it is asked again as soon as it can be. */
    checkCutShort: boolean;
    pages: Record<RepositoryState, StatePages>;
    notShown: boolean;
    /** Requests on their way. */
    running: number;
    failing: boolean;
    pausedUntil: number | null;
    cancelTimer: (() => void) | null;
    /** The holds this service took for the screen showing it, until that screen is gone. */
    screenHolds: (() => void)[];
}

/**
 * The only thing reading for a repository only browsed (D34), per tab and in memory, and only for the section a screen
 * shows while this tab is visible: its pages as the user scrolls, and a conditional check on entering (past
 * {@link BROWSE_FRESH_MS}) and every {@link BROWSE_POLL_MS}. A screen holds the repository through {@link hold} for its
 * whole life, which is what keeps the section's state: it goes when the hold is let go, or with the account. An answer
 * for an account gone or a section no longer shown is dropped, never written.
 */
export type BrowsedRepositories = Resolved<typeof BrowsedRepositories>;
export const BrowsedRepositories = defineService({
    name: 'BrowsedRepositories',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        tracking: TrackingStore,
        projects: ProjectStore,
        trackedItems: TrackedItems,
        holds: RepositoryHolds,
        sync: SyncEngine,
        rateLimits: GitHubRateLimitStore,
        browser: Browser,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, items, tracking, projects, trackedItems, holds, sync, rateLimits, browser, clock, logger }) {
        const sectionsRef = shallowRef(new Map<string, BrowsedSectionState>());
        /** GitHub's name of each address it was asked by, lower-cased; read along with `sectionsRef`. */
        const settledNames = new Map<string, string>();
        const shows = new Set<BrowsedSectionView>();
        /** The repositories whose fresh start waits for the kept copy, which alone says what else keeps a row. */
        const waitingFreshStart = new Set<string>();
        const onlineRef = shallowRef(browser.isOnline());
        const visibleRef = shallowRef(browser.isVisible());
        // Freshness changes with time alone; this moves when it may have (`touch`).
        const nowRef = shallowRef(clock.now());
        const copyLoaded = computed(() => items.loaded && tracking.loaded && projects.loaded);
        /** Until when GitHub asked this tab to slow down (epoch ms). */
        let slowDownUntil = 0;
        let cancelTouch: (() => void) | null = null;

        accounts.onChange(followAccount);
        holds.onLetGo(forget);
        browser.onVisibilityChange(followPresence);
        browser.onOnlineChange(followPresence);
        watch(copyLoaded, followPresence, { flush: 'sync' });

        return { hold, show, loadMore, readNow, getStatus, getFreshness: getSectionFreshness, isTabVisible };

        /**
         * Holds the repository for a screen's whole life; returns the release. With no tab holding it yet, what is kept
         * of its rows only for browsing is dropped first: left on disk by a reload, they would show stale.
         */
        function hold(nameWithOwner: string) {
            if (!holds.isHeld(nameWithOwner)) {
                waitingFreshStart.add(nameWithOwner.toLowerCase());
                startFresh();
            }

            return holds.hold(nameWithOwner);
        }

        /**
         * A screen shows the section and state until the function returned is called: what is not read yet is read, what
         * was read over {@link BROWSE_FRESH_MS} ago is checked, and it is checked again every {@link BROWSE_POLL_MS}.
         */
        function show(view: BrowsedSectionView) {
            shows.add(view);
            enter(view);

            return () => {
                if (!shows.delete(view)) {
                    return;
                }

                const section = findSection(view.nameWithOwner, view.section);
                if (section && !isShown(section)) {
                    cancelTimer(section);
                    releaseScreenHolds(section);
                }

                touch();
            };
        }

        /** Reads the next page of the state, if it has one and the section is on screen in a visible tab. */
        async function loadMore(nameWithOwner: string, sectionName: RepositoryItemSection, state: RepositoryState) {
            const section = findSection(nameWithOwner, sectionName);
            if (section && canAsk() && isShown(section) && !section.notShown && section.pages[state].cursor !== null) {
                await readPage(section, state);
            }
        }

        /**
         * "Try again" on a section GitHub failed on (first run and loading ES17): asks now what it would ask at its next
         * refresh, settling when GitHub has answered. Nothing while it can't be asked or isn't on screen.
         */
        async function readNow(nameWithOwner: string, sectionName: RepositoryItemSection) {
            const section = findSection(nameWithOwner, sectionName);
            if (section && isShown(section) && !section.notShown) {
                await refresh(section, 0);
            }
        }

        /** How the reading of the section's state stands; reactive. */
        function getStatus(
            nameWithOwner: string,
            sectionName: RepositoryItemSection,
            state: RepositoryState,
        ): BrowsedStatus {
            const section = findSection(nameWithOwner, sectionName);
            const settled = settledNames.get(nameWithOwner.toLowerCase());
            const page = section?.pages[state];
            return {
                reading: page?.reading === true,
                total: page?.total ?? null,
                hasMore: page != null && page.cursor !== null,
                cursor: page?.cursor ?? null,
                notShown: section?.notShown === true,
                settledName: settled !== undefined && settled !== nameWithOwner ? settled : null,
            };
        }

        /**
         * How fresh the section is, by this service's own reads; `partial` with nothing read yet. Reactive. For one `state`
         * of it, that state with no page read yet has nothing fresh to stand on, whatever the section's others had: what
         * stands in its way tells at once, not once they are stale.
         */
        function getSectionFreshness(
            nameWithOwner: string,
            sectionName: RepositoryItemSection,
            state?: RepositoryState,
        ): Freshness {
            const section = findSection(nameWithOwner, sectionName);
            if (!section) {
                return { kind: 'partial' };
            }

            if (section.notShown) {
                return { kind: 'stale', since: section.checkedAt, reason: 'refused' };
            }

            return getFreshness({
                now: nowRef.value,
                lastSuccessAt: state && section.pages[state].total === null ? null : section.checkedAt,
                intervalMs: BROWSE_POLL_MS,
                checking: section.running > 0,
                online: onlineRef.value,
                failing: section.failing,
                pausedUntil: section.pausedUntil,
            });
        }

        /** Whether this tab is visible, which alone lets anything be asked about a browsed repository; reactive. */
        function isTabVisible() {
            return visibleRef.value;
        }

        function enter(view: BrowsedSectionView) {
            if (!accounts.current) {
                return;
            }

            const section =
                findSection(view.nameWithOwner, view.section) ?? addSection(view.nameWithOwner, view.section);
            if (section.notShown) {
                // Back on a screen that said so a moment ago (a remount): that answer stands.
                if (clock.now() - (section.askedAt ?? 0) < BROWSE_FRESH_MS) {
                    return;
                }

                section.notShown = false;
                triggerRef(sectionsRef);
            }

            void refresh(section, BROWSE_FRESH_MS);
            touch();
        }

        /**
         * What the section needs now, given it was last checked: the first page of a state shown without one — all
         * over, if its rows have gone — else a check when older than `minAgeMs`. Then its timer. Settles when what it
         * asked has been answered, however that went: the section's freshness tells.
         */
        async function refresh(section: BrowsedSectionState, minAgeMs: number) {
            if (!canAsk()) {
                cancelTimer(section);
                return;
            }

            if (hasLostRows(section)) {
                logger.debug('Rows of a browsed section have gone; reading it again', {
                    repository: section.nameWithOwner,
                    section: section.section,
                });
                section.since = new Date(clock.now() - SINCE_SLACK_MS).toISOString();
                section.etag = undefined;
                section.checkedAt = null;
                section.pages = createPages();
                triggerRef(sectionsRef);
            }

            const now = clock.now();
            const missing = getShownStates(section).filter(state => section.pages[state].total === null);
            const asked: Promise<void>[] = [];
            if (missing.length > 0) {
                section.askedAt = now;
                asked.push(...missing.map(state => readPage(section, state)));
            } else if (section.checkCutShort || now - (section.checkedAt ?? 0) >= minAgeMs) {
                section.askedAt = now;
                asked.push(check(section));
            }

            arm(section);
            await Promise.all(asked);
        }

        /** Sets the section's next refresh: an interval after the last, or when its pause ends; none while it can't be. */
        function arm(section: BrowsedSectionState) {
            cancelTimer(section);
            if (!canAsk() || section.notShown || !isShown(section)) {
                return;
            }

            const now = clock.now();
            const at =
                section.pausedUntil !== null && section.pausedUntil > now
                    ? section.pausedUntil
                    : (section.askedAt ?? now) + BROWSE_POLL_MS;
            section.cancelTimer = clock.schedule(
                () => {
                    section.cancelTimer = null;
                    void refresh(section, 0);
                },
                Math.max(0, at - now),
            );
        }

        async function readPage(section: BrowsedSectionState, state: RepositoryState) {
            const page = section.pages[state];
            if (page.reading) {
                return;
            }

            await attempt(section, async account => {
                checkAllowance('graphql');
                page.reading = true;
                triggerRef(sectionsRef);
                try {
                    const read = await fetchPage(account, section, state, page.cursor);
                    if (!isWanted(section, account) || section.pages[state] !== page) {
                        return;
                    }

                    if (!read) {
                        markNotShown(section);
                        return;
                    }

                    settleName(section, read.nameWithOwner);
                    items.upsertMany(read.items);
                    const { hasNextPage, endCursor } = read.pageInfo;
                    page.cursor = hasNextPage && endCursor != null ? endCursor : null;
                    page.total = read.totalCount;
                    section.checkedAt ??= clock.now();
                } finally {
                    page.reading = false;
                }
            });
        }

        /** The page after `after` of the state, or `null` when GitHub does not show the repository. */
        async function fetchPage(
            account: Account,
            section: BrowsedSectionState,
            state: RepositoryState,
            after: string | null,
        ) {
            const { owner, name } = parseRepositoryName(section.nameWithOwner);
            const call = {
                onPartialErrors(errors: readonly GitHubGraphQLErrorEntry[]) {
                    logger.warn('A page of a browsed repository read in part or not shown', {
                        repository: section.nameWithOwner,
                        errors,
                    });
                },
            };

            switch (section.section) {
                case 'issues': {
                    const { repository } = await account.sdk.RepositoryIssues(
                        { owner, name, states: [...ISSUE_STATES[state]], after },
                        call,
                    );
                    return repository
                        ? {
                              ...repository.issues,
                              nameWithOwner: repository.nameWithOwner,
                              items: filterNotNull((repository.issues.nodes ?? []).map(node => toItem(node))),
                          }
                        : null;
                }
                case 'pullRequests': {
                    const { repository } = await account.sdk.RepositoryPullRequests(
                        {
                            owner,
                            name,
                            states: [...PULL_REQUEST_STATES[state]],
                            first: PULL_REQUEST_PAGE_SIZE,
                            after,
                        },
                        call,
                    );
                    return repository
                        ? {
                              ...repository.pullRequests,
                              nameWithOwner: repository.nameWithOwner,
                              items: filterNotNull((repository.pullRequests.nodes ?? []).map(node => toItem(node))),
                          }
                        : null;
                }
                default:
                    return assertNever(section.section);
            }
        }

        /**
         * Asks GitHub what changed since the last check (a 304 is free) and reads again those of the section's kind whose
         * `updated_at` moved. The tab hidden on the way, it asks no more: what it has not read moved all the same, so
         * neither `since` nor the ETag advance, and the check is done again once the tab is shown.
         */
        async function check(section: BrowsedSectionState) {
            if (section.running > 0) {
                return;
            }

            section.checkCutShort = false;
            await attempt(section, async account => {
                checkAllowance('core');
                const startedAt = clock.now();
                const { owner, name } = parseRepositoryName(section.nameWithOwner);
                const result = await listRepositoryIssuesSince(account.rest, {
                    owner,
                    name,
                    since: section.since,
                    etag: section.etag,
                }).catch((error: unknown) => {
                    if (error instanceof GitHubApiError && error.status === 404) {
                        return null;
                    }

                    throw error;
                });
                if (!isWanted(section, account)) {
                    return;
                }

                if (!result) {
                    markNotShown(section);
                    return;
                }

                if (result.status === 304) {
                    section.checkedAt = clock.now();
                    return;
                }

                const changed: string[] = [];
                for (const hit of result.items) {
                    if (
                        hit.isPullRequest === (section.section === 'pullRequests') &&
                        items.getStored(hit.nodeId)?.updatedAt !== hit.updatedAt
                    ) {
                        changed.push(hit.nodeId);
                    }
                }

                for (const ids of splitIntoChunks(changed, NODES_BATCH_SIZE)) {
                    if (!canAsk()) {
                        section.checkCutShort = true;
                        return;
                    }

                    checkAllowance('graphql');
                    const { read, gone } = await readItemsByIds({ sdk: account.sdk, ids, logger });
                    if (!isWanted(section, account)) {
                        return;
                    }

                    items.upsertMany(read);
                    items.remove(gone);
                }

                section.etag = result.etag;
                section.since = new Date(startedAt - SINCE_SLACK_MS).toISOString();
                section.checkedAt = clock.now();
                logger.debug('Browsed section checked', {
                    repository: section.nameWithOwner,
                    section: section.section,
                    listed: result.items.length,
                    reread: changed.length,
                });
            });
        }

        /** Runs one read for the section: how it went is told to its freshness, and its timer set again. */
        async function attempt(section: BrowsedSectionState, read: (account: Account) => Promise<void>) {
            const account = accounts.current;
            if (!account) {
                return;
            }

            section.running++;
            triggerRef(sectionsRef);
            try {
                await read(account);
                if (isWanted(section, account)) {
                    section.failing = false;
                    section.pausedUntil = null;
                }
            } catch (error) {
                if (isWanted(section, account)) {
                    noteFailure(section, error);
                }
            } finally {
                section.running--;
                if (isWanted(section, account)) {
                    arm(section);
                }

                touch();
                triggerRef(sectionsRef);
            }
        }

        function noteFailure(section: BrowsedSectionState, error: unknown) {
            const repository = section.nameWithOwner;
            const now = clock.now();
            const pause =
                error instanceof SyncPausedError
                    ? error.pause
                    : getRefusalPause({
                          error,
                          limits: [rateLimits.get('core'), rateLimits.get('graphql')],
                          now,
                      });
            if (pause) {
                logger.warn('Reading a browsed repository waits for GitHub', {
                    repository,
                    bucket: pause.bucket,
                    pausedForMs: pause.until - now,
                });
                section.pausedUntil = pause.until;
                if (pause.bucket === null) {
                    slowDownUntil = Math.max(slowDownUntil, pause.until);
                }
            } else {
                logger.warn('Reading a browsed repository failed; retrying at the next interval', {
                    repository,
                    error,
                });
                section.failing = true;
            }
        }

        /** Throws a pause instead of asking GitHub while it asked to slow down, in any tab, or while `bucket` is used up. */
        function checkAllowance(bucket: string) {
            const now = clock.now();
            const { notice } = sync;
            const until = Math.max(slowDownUntil, notice?.kind === 'paused' ? notice.until : 0);
            if (until > now) {
                throw new SyncPausedError({ until, bucket: null });
            }

            const pause = getAllowancePause(rateLimits.get(bucket), now);
            if (pause) {
                throw new SyncPausedError(pause);
            }
        }

        /** No further checks until the section is shown anew; nothing of it counts as read. */
        function markNotShown(section: BrowsedSectionState) {
            logger.warn('A browsed repository is not shown by GitHub', {
                repository: section.nameWithOwner,
                section: section.section,
            });
            section.notShown = true;
            section.askedAt = clock.now();
            section.pages = createPages();
        }

        /** It has read pages, yet the store holds no row of its kind and repository: forgotten by a cleanup. */
        function hasLostRows(section: BrowsedSectionState) {
            if (!REPOSITORY_STATES.some(state => (section.pages[state].total ?? 0) > 0)) {
                return false;
            }

            const name = section.nameWithOwner.toLowerCase();
            const kind = getSectionItemKind(section.section);
            return !items.all.some(item => item.kind === kind && item.repository.nameWithOwner.toLowerCase() === name);
        }

        /**
         * GitHub's own name, as a page of the section answers it, an empty one too. When it is another than the section's
         * (a case difference, a rename) the hold on it is taken and the repository's sections moved to it before any status
         * says so, so the screen remounting under that address goes on with nothing lost. The hold is released when the
         * screen that asked is gone. Never from a row, which an issue transferred elsewhere would misname.
         */
        function settleName(section: BrowsedSectionState, actual: string) {
            settledNames.set(actual.toLowerCase(), actual);
            const asked = section.nameWithOwner;
            if (actual === asked) {
                return;
            }

            section.screenHolds.push(holds.hold(actual));
            const sections = sectionsRef.value;
            for (const name of SECTIONS) {
                const moved = sections.get(toKey(asked, name));
                if (moved) {
                    sections.delete(toKey(asked, name));
                    moved.nameWithOwner = actual;
                    sections.set(toLowerKey(actual.toLowerCase(), name), moved);
                }
            }

            settledNames.set(asked.toLowerCase(), actual);
        }

        /** This tab's hold of the name is over: an old address is forgotten, the repository's sections go with its own. */
        function forget(nameWithOwner: string) {
            const address = nameWithOwner.toLowerCase();
            const settled = settledNames.get(address);
            if (settled !== undefined && settled.toLowerCase() !== address) {
                settledNames.delete(address);
                triggerRef(sectionsRef);
                return;
            }

            for (const name of SECTIONS) {
                const section = sectionsRef.value.get(toLowerKey(address, name));
                if (section) {
                    dropSection(section);
                }
            }

            for (const [other, name] of settledNames) {
                if (name.toLowerCase() === address) {
                    settledNames.delete(other);
                }
            }

            triggerRef(sectionsRef);
        }

        /** Another account or none: nothing read for the one before stays. */
        function followAccount() {
            for (const section of sectionsRef.value.values()) {
                dropSection(section);
            }

            settledNames.clear();
            waitingFreshStart.clear();
            slowDownUntil = 0;
            touch();
            triggerRef(sectionsRef);
        }

        /** The tab was shown or hidden, the connection came or went, or the kept copy arrived. */
        function followPresence() {
            onlineRef.value = browser.isOnline();
            visibleRef.value = browser.isVisible();
            startFresh();
            for (const section of getShownSections()) {
                if (section.notShown) {
                    continue;
                }

                void refresh(section, BROWSE_POLL_MS);
            }

            touch();
        }

        function startFresh() {
            if (!copyLoaded.value || waitingFreshStart.size === 0) {
                return;
            }

            const ids: string[] = [];
            for (const item of items.all) {
                if (
                    waitingFreshStart.has(item.repository.nameWithOwner.toLowerCase()) &&
                    !trackedItems.isSynced(item)
                ) {
                    ids.push(item.id);
                }
            }

            waitingFreshStart.clear();
            if (ids.length > 0) {
                items.remove(ids);
            }
        }

        /** Moves `now` to the present, and again at the next moment a shown section's freshness turns by time alone. */
        function touch() {
            const now = clock.now();
            nowRef.value = now;
            cancelTouch?.();
            cancelTouch = null;
            if (!canAsk()) {
                return;
            }

            let next = Number.POSITIVE_INFINITY;
            for (const section of getShownSections()) {
                if (section.checkedAt !== null) {
                    const freshUntil = section.checkedAt + BROWSE_POLL_MS + FRESH_SLACK_MS + 1;
                    if (freshUntil > now) {
                        next = Math.min(next, freshUntil);
                    }
                }
            }

            if (next !== Number.POSITIVE_INFINITY) {
                cancelTouch = clock.schedule(touch, next - now);
            }
        }

        function canAsk() {
            return copyLoaded.value && browser.isVisible() && browser.isOnline();
        }

        /** Whether what `account` asked for the section may be kept: it is still signed in, and a screen shows it. */
        function isWanted(section: BrowsedSectionState, account: Account) {
            return (
                accounts.isCurrent(account) &&
                findSection(section.nameWithOwner, section.section) === section &&
                isShown(section)
            );
        }

        function isShown(section: BrowsedSectionState) {
            return getShownSections().has(section);
        }

        function getShownSections() {
            return new Set(filterNotNull([...shows].map(view => findSection(view.nameWithOwner, view.section))));
        }

        function getShownStates(section: BrowsedSectionState) {
            return [...shows]
                .filter(view => findSection(view.nameWithOwner, view.section) === section)
                .map(view => view.state);
        }

        function findSection(nameWithOwner: string, name: RepositoryItemSection) {
            return sectionsRef.value.get(toKey(nameWithOwner, name));
        }

        function addSection(nameWithOwner: string, name: RepositoryItemSection) {
            const section: BrowsedSectionState = {
                nameWithOwner,
                section: name,
                since: new Date(clock.now() - SINCE_SLACK_MS).toISOString(),
                etag: undefined,
                checkedAt: null,
                askedAt: null,
                checkCutShort: false,
                pages: createPages(),
                notShown: false,
                running: 0,
                failing: false,
                pausedUntil: null,
                cancelTimer: null,
                screenHolds: [],
            };
            sectionsRef.value.set(toKey(nameWithOwner, name), section);
            triggerRef(sectionsRef);
            return section;
        }

        function dropSection(section: BrowsedSectionState) {
            cancelTimer(section);
            releaseScreenHolds(section);
            sectionsRef.value.delete(toKey(section.nameWithOwner, section.section));
        }

        function cancelTimer(section: BrowsedSectionState) {
            section.cancelTimer?.();
            section.cancelTimer = null;
        }

        function releaseScreenHolds(section: BrowsedSectionState) {
            for (const release of section.screenHolds) {
                release();
            }

            section.screenHolds = [];
        }

        /** Where the section of the repository an address names is kept: under GitHub's name, once that is known. */
        function toKey(nameWithOwner: string, name: RepositoryItemSection) {
            const address = nameWithOwner.toLowerCase();
            return toLowerKey(settledNames.get(address)?.toLowerCase() ?? address, name);
        }
    },
});

function toLowerKey(lowerName: string, section: RepositoryItemSection) {
    return `${lowerName}:${section}`;
}

function createPages(): Record<RepositoryState, StatePages> {
    return {
        open: createStatePages(),
        closed: createStatePages(),
        all: createStatePages(),
    };
}

function createStatePages(): StatePages {
    return { cursor: null, total: null, reading: false };
}
