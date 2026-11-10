import type { PullRequestReviewState } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { FailedComment } from '@/edits/CommentDrafts.js';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';
import type {
    ItemCheck,
    ItemComment,
    ItemDetail,
    ItemDetailReviewRequest,
    ItemReviewSummary,
    PullRequestDetail,
    ThreadCommit,
    ThreadCommitRef,
    ThreadEvent,
    ThreadReferencedCommit,
    ThreadRef,
} from '@/store/ItemDetailTypes.js';
import type { ItemLabel, ItemUser, PullRequestItem, PullRequestPendingReview } from '@/store/ItemTypes.js';

/** How long one person's events straight after each other share a line, from the first of them (F13). */
const BURST_MS = 10 * 60_000;
/**
 * The longest gap between one author's commits in a row that still makes them one push. An approximation: a pull
 * request's timeline tells when each commit was made (`committedDate`), not when, or in which push, it was pushed — so
 * commits made far apart are taken as pushed apart, and a day's work pushed at once shows as several pushes.
 */
const PUSH_GAP_MS = 60 * 60_000;
/** A thread folds once it has more items than this (F5), the description and the composer apart. */
const FOLD_OVER = 20;
/** How many of the first items stay above the fold. */
const KEEP_ABOVE = 2;
/** How many of the last items stay below it, at least — but none from before what the detail does not hold. */
const KEEP_BELOW = 5;
/** Fewer items than this to fold: nothing folds. */
const FOLD_AT_LEAST = 6;

/**
 * One entry of an item's thread after the description, as it is drawn (item-activity F5, F13, F14): a comment, a line of
 * one person's events, a push of commits, a pull request's failed checks, a review, a code comment, a comment GitHub did
 * not take, the viewer's draft review.
 */
export type ThreadItem =
    | { readonly kind: 'comment'; readonly id: string; readonly comment: ItemComment }
    | ThreadEventLine
    | ThreadPush
    | ThreadChecksFailed
    | ThreadReview
    | ThreadCodeComment
    | { readonly kind: 'failedComment'; readonly id: string; readonly failed: FailedComment }
    | ThreadPendingReview
    | ThreadFold;

/**
 * A submitted review (F14) with its summary and the threads it started — a thread is its first comment's review's, a
 * reply on another review's thread being a review of its own that started nothing. A dismissed one is a review too
 * (`DISMISSED`), and the dismissal follows it as an event.
 */
export interface ThreadReview {
    readonly kind: 'review';
    /** The review's id. */
    readonly id: string;
    readonly review: ItemReviewSummary;
    /** The threads it started still open, in GitHub's order. */
    readonly threads: readonly ReviewThread[];
    /** The threads it started that are resolved, in GitHub's order: drawn apart, folded. */
    readonly resolved: readonly ReviewThread[];
    /**
     * What a dismissed review was before ("requested changes · dismissed"), as its dismissal says; `null` when the
     * detail does not hold the dismissal, or the review was not dismissed.
     */
    readonly dismissedFrom: PullRequestReviewState | null;
}

/**
 * A comment on the code posted on its own, without a review (`Activity / Code comment`): GitHub makes it a review
 * `COMMENTED` with no text that started this one thread. Also a thread whose review the detail does not hold.
 */
export interface ThreadCodeComment {
    readonly kind: 'codeComment';
    /** The thread's id. */
    readonly id: string;
    readonly thread: ReviewThread;
}

/**
 * The viewer's own draft review (F14, `Activity / Review · pending`), last before the composer: GitHub shows a draft
 * to its author alone, and so does the thread — never one of anybody else's comments in it.
 */
export interface ThreadPendingReview {
    readonly kind: 'pendingReview';
    readonly id: 'pendingReview';
    /** What the row knows of it; `null` when only its comments tell of it yet. */
    readonly review: PullRequestPendingReview | null;
    /** The threads the draft starts; its replies on other threads stay in those. */
    readonly threads: readonly ReviewThread[];
}

/**
 * Events of one person straight after each other (a burst, F13) on one line: the parts in the order they first came,
 * objects of one kind merged into one part.
 */
export interface ThreadEventLine {
    readonly kind: 'events';
    /** The first event's id. */
    readonly id: string;
    /** `null`: an event no person made — a project workflow's Status change. Such a line has one part. */
    readonly actor: ItemUser | null;
    readonly parts: readonly ThreadEventPart[];
    /** When its newest event happened: the time it shows. */
    readonly updatedAt: string;
}

/**
 * What one or more events of a line did: the events of one kind with their objects merged (F13: "events of one kind
 * merge their objects"), or an event of its own.
 */
export type ThreadEventPart =
    | ThreadMergedPart<'labeled' | 'unlabeled', ItemLabel>
    /** `null` for a deleted account. */
    | ThreadMergedPart<'assigned' | 'unassigned', ItemUser | null>
    /** `reviewRequestedAgain`: of someone who reviewed it before ("asked sofiab for another review", F5). */
    | ThreadMergedPart<'reviewRequested' | 'reviewRequestedAgain' | 'reviewRequestRemoved', ItemDetailReviewRequest>
    | ThreadMergedPart<'crossReferenced' | 'subIssueAdded' | 'subIssueRemoved', ThreadRef>
    | ThreadMergedPart<'referenced', ThreadReferencedCommit>
    | { readonly kind: 'single'; readonly event: SingleThreadEvent };

/** The events of one kind of a line: their objects, each once, in the order they came. */
export interface ThreadMergedPart<TKind extends string, TObject> {
    readonly kind: TKind;
    readonly objects: readonly TObject[];
}

/**
 * An event that is a part of its own: of a kind whose objects do not merge, or a sub-issue or a commit the viewer
 * cannot see — nothing to tell it from another by.
 */
export type SingleThreadEvent = Exclude<
    ThreadEvent,
    { readonly kind: Exclude<MergingKind, 'subIssueAdded' | 'subIssueRemoved' | 'referenced'> | 'commit' }
>;

/**
 * One author's commits straight after each other, none more than an hour after the one before (`PUSH_GAP_MS`): GitHub
 * tells of each commit, not of the push that brought it.
 */
export interface ThreadPush {
    readonly kind: 'push';
    /** The first commit's id. */
    readonly id: string;
    /** Their author's GitHub account; `null` when the author's email belongs to none — then {@link authorName} speaks. */
    readonly actor: ItemUser | null;
    readonly authorName: string | null;
    /** Oldest first. */
    readonly commits: readonly ThreadCommit[];
    /** When its newest commit was made. */
    readonly updatedAt: string;
}

/** A pull request's newest commit's checks finished, at least one failed (F13, "CI, failures only"). No person. */
export interface ThreadChecksFailed {
    readonly kind: 'checksFailed';
    readonly id: string;
    readonly commit: ThreadCommitRef;
    /** How many of its checks failed. */
    readonly failedCount: number;
    /** The failed checks' names, each once. */
    readonly failed: readonly string[];
    /** How many checks ran on it. */
    readonly total: number;
    readonly updatedAt: string;
}

/**
 * The middle of a long thread, folded to one band (F5): what it hides, counted by group — those GitHub has and the
 * detail does not hold yet among them. Their sum is how many it hides.
 */
export interface ThreadFold {
    readonly kind: 'fold';
    readonly id: 'fold';
    /** The commits of the pushes it hides. */
    readonly commits: number;
    readonly comments: number;
    /** The events but commits; a line of one person's events counts once. */
    readonly otherEvents: number;
}

/** The parameters of {@link buildThread}. */
export interface BuildThreadParams {
    readonly detail: ItemDetail;
    /** The user's comments GitHub did not take, in the order they were written. */
    readonly failedComments?: readonly FailedComment[];
    /** The user showed the folded middle: nothing folds, unless the detail no longer holds all of it. */
    readonly unfolded?: boolean;
    /** The comments the user must see, never folded away: an editor open on them, an edit GitHub did not take. */
    readonly keepShown?: ReadonlySet<string>;
    /** A pull request's review threads, as code review reads and writes them (`ReviewFiles.openThreads`). */
    readonly reviewThreads?: readonly ReviewThread[];
    /** The viewer's draft review as the item's row knows it (`PullRequestItem.pendingReview`). */
    readonly pendingReview?: PullRequestPendingReview | null;
    /** Who is signed in: the only one whose draft review shows. Without one, no draft does. */
    readonly viewerLogin?: string | null;
}

type MergingKind = Exclude<ThreadEventPart['kind'], 'single'>;

/** An entry of the thread placed by its time, before the events are put into lines and the commits into pushes. */
type Timed =
    | { readonly at: number; readonly kind: 'event'; readonly event: Exclude<ThreadEvent, ThreadCommit> }
    | { readonly at: number; readonly kind: 'commit'; readonly commit: ThreadCommit }
    | { readonly at: number; readonly kind: 'item'; readonly item: ThreadItem };

/**
 * An item's thread after the description as it is drawn, oldest first (item-activity F5, F13, F14): every comment, event
 * and review read, by time — one person's events within 10 minutes on one line, an add and a remove of the same thing
 * gone, one author's commits as one push, a pull request's failed checks once they finished, a review with the threads
 * it started, a code comment posted alone — then the user's comments on their way, then those GitHub did not take, then
 * the viewer's draft review. An event no person made is left out but a project workflow's Status change, and so is the
 * close GitHub gives with a merge, at its time: the merge says it all; and so is a review that says nothing and started
 * no thread, which GitHub makes of every reply.
 * A long middle folds to one band ({@link ThreadFold}, `foldThread`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildThread({
    detail,
    failedComments = [],
    unfolded = false,
    keepShown = new Set(),
    reviewThreads = [],
    pendingReview = null,
    viewerLogin = null,
}: BuildThreadParams): ThreadItem[] {
    const timed: Timed[] = [];
    const pending: ThreadItem[] = [];
    const seen = new Set<string>();
    for (const comment of [...detail.comments.first, ...detail.comments.nodes]) {
        if (seen.has(comment.id)) {
            continue;
        }

        seen.add(comment.id);
        const entry: ThreadItem = { kind: 'comment', id: comment.id, comment };
        // Not on GitHub yet: its time is this device's, after everything GitHub told.
        if (comment.id.startsWith('pending:')) {
            pending.push(entry);
        } else {
            timed.push({ at: Date.parse(comment.createdAt), kind: 'item', item: entry });
        }
    }

    const events = [...detail.events.oldest, ...detail.events.newest];
    // Whichever page each was read in.
    const mergedAt = new Set(events.flatMap(event => (event.kind === 'merged' ? [event.createdAt] : [])));
    for (const event of events) {
        const at = Date.parse(event.createdAt);
        if (event.kind === 'commit') {
            timed.push({ at, kind: 'commit', commit: event });
        } else if (isShown(event) && !(event.kind === 'closed' && mergedAt.has(event.createdAt))) {
            timed.push({ at, kind: 'event', event });
        }
    }

    // The head the detail read its checks with: the row held may have moved on to a newer push since.
    const checks =
        detail.kind === 'pullRequest' && detail.item.kind === 'pullRequest'
            ? getChecksFailed(detail.item, detail)
            : null;
    if (checks) {
        timed.push({ at: Date.parse(checks.updatedAt), kind: 'item', item: checks });
    }

    const summaries = detail.kind === 'pullRequest' ? detail.reviewSummaries : [];
    const dismissals = new Map(
        events.flatMap(event =>
            event.kind === 'reviewDismissed' && event.reviewId !== null ? [[event.reviewId, event.previousState]] : [],
        ),
    );
    const reviews = placeReviews({ summaries, reviewThreads, viewerLogin, dismissals });
    timed.push(...reviews.timed);
    const draft =
        viewerLogin !== null && (pendingReview !== null || reviews.draft.length > 0)
            ? ({
                  kind: 'pendingReview',
                  id: 'pendingReview',
                  review: pendingReview,
                  threads: reviews.draft,
              } satisfies ThreadPendingReview)
            : null;

    // Stable: what GitHub lists in one order at one time stays in it.
    const ordered = timed.toSorted((a, b) => a.at - b.at);
    const items = [
        ...groupTimed(ordered, getFirstReviews(summaries)),
        ...pending,
        ...failedComments.map((failed): ThreadItem => ({ kind: 'failedComment', id: `failed:${failed.id}`, failed })),
        ...(draft ? [draft] : []),
    ];
    const startedAt = new Map(ordered.map(entry => [getTimedId(entry), entry.at]));
    return foldThread(items, { detail, unfolded, keepShown, startedAt });
}

/** The parameters of {@link placeReviews}. */
interface PlaceReviewsParams {
    readonly summaries: readonly ItemReviewSummary[];
    readonly reviewThreads: readonly ReviewThread[];
    readonly viewerLogin: string | null;
    /** What each review dismissed was before, by the review's id. */
    readonly dismissals: ReadonlyMap<string, PullRequestReviewState>;
}

/** The reviews and code comments placed by time, and the threads the viewer's draft starts. */
interface PlacedReviews {
    readonly timed: readonly Timed[];
    readonly draft: readonly ReviewThread[];
}

/**
 * Each thread goes to the review its first comment came with; one of the viewer's draft to the draft. A review that
 * says nothing (`COMMENTED`, no text) is a code comment when it started one thread and nothing when it started none: a
 * reply's carrier. A comment of anybody's draft but the viewer's never shows — GitHub would not list one.
 */
function placeReviews({ summaries, reviewThreads, viewerLogin, dismissals }: PlaceReviewsParams): PlacedReviews {
    const held = new Set(summaries.map(review => review.id));
    const byReview = new Map<string, ReviewThread[]>();
    const alone: ReviewThread[] = [];
    const draft: ReviewThread[] = [];
    for (const read of reviewThreads) {
        const comments = read.comments.filter(
            comment => comment.state !== 'PENDING' || (viewerLogin !== null && comment.author?.login === viewerLogin),
        );
        const [first] = comments;
        if (!first) {
            continue;
        }

        const thread = comments.length === read.comments.length ? read : { ...read, comments };
        const reviewId = first.pullRequestReview?.id;
        if (first.state === 'PENDING') {
            draft.push(thread);
        } else if (reviewId !== undefined && held.has(reviewId)) {
            byReview.set(reviewId, [...(byReview.get(reviewId) ?? []), thread]);
        } else {
            alone.push(thread);
        }
    }

    const timed: Timed[] = [];
    for (const review of summaries) {
        const own = byReview.get(review.id) ?? [];
        const [only] = own;
        if (review.state === 'COMMENTED' && review.bodyHtml === '' && own.length <= 1) {
            if (only) {
                alone.push(only);
            }

            continue;
        }

        const item: ThreadReview = {
            kind: 'review',
            id: review.id,
            review,
            threads: own.filter(thread => !thread.isResolved),
            resolved: own.filter(thread => thread.isResolved),
            dismissedFrom: review.state === 'DISMISSED' ? (dismissals.get(review.id) ?? null) : null,
        };
        timed.push({ at: Date.parse(review.submittedAt), kind: 'item', item });
    }

    for (const thread of alone) {
        const [first] = thread.comments;
        if (first) {
            timed.push({
                at: Date.parse(first.createdAt),
                kind: 'item',
                item: { kind: 'codeComment', id: thread.id, thread },
            });
        }
    }

    return { timed, draft };
}

/** When each person first reviewed, by login (epoch ms): a request of them after it asks for another review. */
function getFirstReviews(summaries: readonly ItemReviewSummary[]): ReadonlyMap<string, number> {
    const first = new Map<string, number>();
    for (const review of summaries) {
        const login = review.author?.login;
        const at = Date.parse(review.submittedAt);
        if (login !== undefined && at < (first.get(login) ?? Infinity)) {
            first.set(login, at);
        }
    }

    return first;
}

/** What {@link foldThread} folds by. */
interface FoldParams {
    readonly detail: ItemDetail;
    readonly unfolded: boolean;
    readonly keepShown: ReadonlySet<string>;
    /** When each item's first comment, event or commit happened, by the item's id. */
    readonly startedAt: ReadonlyMap<string, number>;
}

/**
 * The F5 rule: more than 20 items fold — the first 2 stay above, and below stays everything from {@link getBelowStart};
 * fewer than 6 to fold and nothing folds. What GitHub has and the detail does not hold counts as folded, and folds
 * whatever the counts: it cannot be shown. Around it stays only what keeps the thread in time order once it is shown
 * ({@link getUnreadSpan}).
 */
function foldThread(
    items: readonly ThreadItem[],
    { detail, unfolded, keepShown, startedAt }: FoldParams,
): ThreadItem[] {
    const unread = countUnread(detail);
    const unreadCount = unread.commits + unread.comments + unread.otherEvents;
    if (unfolded && unreadCount === 0) {
        return [...items];
    }

    const span = getUnreadSpan(detail);
    const above = countAbove(items, span.from);
    const below = Math.max(above, getBelowStart({ items, above, keepShown, startedAt, unreadUntil: span.until }));
    const folded = items.slice(above, below);
    if (unreadCount === 0 && (items.length <= FOLD_OVER || folded.length < FOLD_AT_LEAST)) {
        return [...items];
    }

    const counts = countFolded(folded);
    const fold: ThreadFold = {
        kind: 'fold',
        id: 'fold',
        commits: counts.commits + unread.commits,
        comments: counts.comments + unread.comments,
        otherEvents: counts.otherEvents + unread.otherEvents,
    };
    return [...items.slice(0, above), fold, ...items.slice(below)];
}

/** When what the detail does not hold may have happened: after `from`, before `until` (epoch ms). */
interface UnreadSpan {
    readonly from: number;
    readonly until: number;
}

/**
 * The time the comments and the events not held lie in, both streams together: the comments' between the first ones
 * and the newest ones held, the events' between the oldest and the newest. An item placed by time beside both streams
 * stays above the fold only from before it and below only from after it — else showing the middle would put what it
 * hides on the wrong side of it.
 */
function getUnreadSpan({ comments, events }: ItemDetail): UnreadSpan {
    let from = Infinity;
    let until = -Infinity;
    if (comments.olderCursor !== null) {
        from = Math.min(from, getLatest(comments.first.map(comment => comment.createdAt)));
        until = Math.max(until, getEarliest(comments.nodes.map(comment => comment.createdAt)));
    }

    if (events.middle !== null) {
        from = Math.min(from, getLatest(events.oldest.map(event => event.createdAt)));
        until = Math.max(until, getEarliest(events.newest.map(event => event.createdAt)));
    }

    return { from, until };
}

/** The newest of the times, `-Infinity` for none: nothing held before the gap, it may start at the very first. */
function getLatest(times: readonly string[]) {
    return Math.max(-Infinity, ...times.map(time => Date.parse(time)));
}

/** The oldest of the times, `Infinity` for none: nothing held after the gap, it may reach the very last. */
function getEarliest(times: readonly string[]) {
    return Math.min(Infinity, ...times.map(time => Date.parse(time)));
}

/** The first items that stay above the fold: 2, but never one whose newest part happened after the unread may start. */
function countAbove(items: readonly ThreadItem[], unreadFrom: number) {
    let above = 0;
    for (const entry of items.slice(0, KEEP_ABOVE)) {
        if (getEndedAt(entry) > unreadFrom) {
            break;
        }

        above += 1;
    }

    return above;
}

/** The parameters of {@link getBelowStart}. */
interface BelowStartParams {
    readonly items: readonly ThreadItem[];
    readonly above: number;
    readonly keepShown: ReadonlySet<string>;
    readonly startedAt: ReadonlyMap<string, number>;
    /** Before when the unread may end ({@link UnreadSpan}). */
    readonly unreadUntil: number;
}

/**
 * Where what stays below the fold starts (F5): the 5th item from the end, or later, where nothing before the unread
 * may end stays below; earlier at the first item, after the `above` ones, the user must see ({@link mustShow}) —
 * an editor never folds away, even out of time order — or the oldest review or code comment with a thread still
 * open ({@link hasOpenThread}). M5 adds the first item new since the user looked.
 */
function getBelowStart({ items, above, keepShown, startedAt, unreadUntil }: BelowStartParams) {
    const afterUnread = items.findIndex(entry => (startedAt.get(entry.id) ?? getEndedAt(entry)) >= unreadUntil);
    const kept = Math.max(items.length - KEEP_BELOW, afterUnread < 0 ? items.length : afterUnread);
    const firstShown = items.findIndex(
        (entry, index) => index >= above && (mustShow(entry, keepShown) || hasOpenThread(entry)),
    );
    return firstShown >= 0 ? Math.min(kept, firstShown) : kept;
}

/** A review or a code comment with a thread not resolved: someone may still be waiting on it. */
function hasOpenThread(entry: ThreadItem) {
    switch (entry.kind) {
        case 'review':
            return entry.threads.length > 0;
        case 'codeComment':
            return !entry.thread.isResolved;
        default:
            return false;
    }
}

/** When an item's newest part happened; the user's comments on their way and refused, after everything GitHub told. */
function getEndedAt(entry: ThreadItem) {
    switch (entry.kind) {
        case 'comment':
            return entry.id.startsWith('pending:') ? Infinity : Date.parse(entry.comment.createdAt);
        case 'events':
        case 'push':
        case 'checksFailed':
            return Date.parse(entry.updatedAt);
        case 'review':
            return Date.parse(entry.review.submittedAt);
        case 'codeComment':
            return Date.parse(entry.thread.comments[0]?.createdAt ?? '');
        case 'failedComment':
        case 'pendingReview':
        case 'fold':
            return Infinity;
        default:
            return assertNever(entry);
    }
}

function getTimedId(entry: Timed) {
    switch (entry.kind) {
        case 'event':
            return entry.event.id;
        case 'commit':
            return entry.commit.id;
        case 'item':
            return entry.item.id;
        default:
            return assertNever(entry);
    }
}

/**
 * Never folded away: the user's comment on its way or not taken, an edit of theirs in flight, open or refused, their
 * draft review.
 */
function mustShow(entry: ThreadItem, keepShown: ReadonlySet<string>) {
    switch (entry.kind) {
        case 'comment':
            return entry.comment.pendingBody !== undefined || keepShown.has(entry.id);
        case 'failedComment':
        case 'pendingReview':
            return true;
        default:
            return false;
    }
}

/** What the fold's groups count. */
interface FoldCounts {
    readonly commits: number;
    readonly comments: number;
    readonly otherEvents: number;
}

function countFolded(folded: readonly ThreadItem[]): FoldCounts {
    let commits = 0;
    let comments = 0;
    let otherEvents = 0;
    for (const entry of folded) {
        switch (entry.kind) {
            // F13: comments, reviews and code comments.
            case 'comment':
            case 'review':
            case 'codeComment':
            case 'pendingReview':
                comments += 1;
                break;
            case 'events':
            case 'checksFailed':
                otherEvents += 1;
                break;
            case 'push':
                commits += entry.commits.length;
                break;
            case 'failedComment':
            case 'fold':
                break;
            default:
                assertNever(entry);
        }
    }

    return { commits, comments, otherEvents };
}

/**
 * What GitHub counts in the thread and the detail does not hold: the comments before those read, the events' middle.
 * A merge's close held counts as held, though not drawn; one in the middle cannot be told from any other event.
 */
function countUnread(detail: ItemDetail): FoldCounts {
    const { comments, events } = detail;
    const heldComments = new Set([...comments.first, ...comments.nodes].map(comment => comment.id)).size;
    const heldEvents = [...new Map([...events.oldest, ...events.newest].map(event => [event.id, event])).values()];
    const heldCommits = heldEvents.filter(event => event.kind === 'commit').length;
    const heldOthers = heldEvents.length - heldCommits;

    return {
        comments: comments.olderCursor === null ? 0 : Math.max(0, comments.totalCount - heldComments),
        commits: events.middle === null ? 0 : Math.max(0, events.commitCount - heldCommits),
        otherEvents: events.middle === null ? 0 : Math.max(0, events.totalCount - events.commitCount - heldOthers),
    };
}

/** Never shown (F13): an automatic event with no person, but a project workflow's Status change. */
function isShown(event: Exclude<ThreadEvent, ThreadCommit>) {
    return event.actor !== null || (event.kind === 'projectStatusChanged' && event.wasAutomated);
}

/**
 * @param firstReviews When each person first reviewed ({@link getFirstReviews}).
 */
function groupTimed(ordered: readonly Timed[], firstReviews: ReadonlyMap<string, number>): ThreadItem[] {
    const items: Building[] = [];
    let burst: Burst | null = null;
    let push: MutablePush | null = null;
    for (const entry of ordered) {
        if (entry.kind === 'event') {
            push = null;
            const { event } = entry;
            if (burst && continuesBurst({ burst, event, at: entry.at })) {
                addToBurst(burst, event);
                continue;
            }

            burst = startBurst({ event, at: entry.at, firstReviews });
            items.push(burst.line);
            continue;
        }

        burst = null;
        if (entry.kind === 'commit') {
            const { commit } = entry;
            const last = push?.commits.at(-1);
            if (
                push &&
                last &&
                getAuthorKey(last) === getAuthorKey(commit) &&
                entry.at - Date.parse(last.createdAt) <= PUSH_GAP_MS
            ) {
                push.commits.push(commit);
                continue;
            }

            push = { commits: [commit] };
            items.push({ kind: 'pushRef', push });
            continue;
        }

        push = null;
        items.push(entry.item);
    }

    return items.flatMap(finish);
}

/** A line being built, and when its first event happened. */
interface Burst {
    readonly line: BurstLine;
    readonly at: number;
    /** When each person first reviewed ({@link getFirstReviews}). */
    readonly firstReviews: ReadonlyMap<string, number>;
}

/** A line whose parts are still being merged; finished into a {@link ThreadEventLine}. */
interface BurstLine {
    readonly kind: 'burst';
    readonly id: string;
    readonly actor: ItemUser | null;
    readonly parts: MutablePart[];
    updatedAt: string;
}

type MutablePart =
    | MutableMergedPart<Exclude<ThreadEventPart, { readonly kind: 'single' }>>
    | Extract<ThreadEventPart, { readonly kind: 'single' }>;

/** A merged part still taking objects; one of {@link MergingPart} for each of {@link ThreadMergedPart}. */
type MutableMergedPart<TPart> =
    TPart extends ThreadMergedPart<infer TKind, infer TObject> ? MergingPart<TKind, TObject> : never;

/** The events of one kind of a line being built: each object with what tells it from the others of its kind. */
interface MergingPart<TKind extends string, TObject> {
    readonly kind: TKind;
    readonly entries: MergedEntry<TObject>[];
}

/** An object of a {@link MergingPart}; `key` `null`: nothing tells it from another (a deleted account). */
interface MergedEntry<TObject> {
    readonly key: string | null;
    readonly object: TObject;
}

interface MutablePush {
    readonly commits: ThreadCommit[];
}

/** An entry {@link groupTimed} still adds to as it goes. */
type Building = ThreadItem | BurstLine | { readonly kind: 'pushRef'; readonly push: MutablePush };

function finish(entry: Building): ThreadItem[] {
    switch (entry.kind) {
        case 'burst': {
            const parts = entry.parts.flatMap(toPart);
            return parts.length > 0
                ? [{ kind: 'events', id: entry.id, actor: entry.actor, parts, updatedAt: entry.updatedAt }]
                : [];
        }
        case 'pushRef': {
            const { commits } = entry.push;
            const [first] = commits;
            const last = commits.at(-1);
            return first && last
                ? [
                      {
                          kind: 'push',
                          id: first.id,
                          actor: first.actor,
                          authorName: first.authorName,
                          commits,
                          updatedAt: last.createdAt,
                      },
                  ]
                : [];
        }
        default:
            return [entry];
    }
}

/** The parameters of {@link continuesBurst}. */
interface ContinuesBurstParams {
    readonly burst: Burst;
    readonly event: Exclude<ThreadEvent, ThreadCommit>;
    /** When the event happened. */
    readonly at: number;
}

function continuesBurst({ burst, event, at }: ContinuesBurstParams) {
    const { actor } = burst.line;
    return actor !== null && event.actor?.login === actor.login && at - burst.at <= BURST_MS;
}

/** The parameters of {@link startBurst}. */
interface StartBurstParams {
    readonly event: Exclude<ThreadEvent, ThreadCommit>;
    /** When the event happened. */
    readonly at: number;
    readonly firstReviews: ReadonlyMap<string, number>;
}

function startBurst({ event, at, firstReviews }: StartBurstParams): Burst {
    const burst: Burst = {
        line: { kind: 'burst', id: event.id, actor: event.actor, parts: [], updatedAt: event.createdAt },
        at,
        firstReviews,
    };
    addToBurst(burst, event);
    return burst;
}

/** The event joins the line: its objects go to the part of its kind, and an add and a remove of one thing cancel. */
function addToBurst({ line, firstReviews }: Burst, event: Exclude<ThreadEvent, ThreadCommit>) {
    line.updatedAt = event.createdAt;
    switch (event.kind) {
        case 'labeled':
        case 'unlabeled':
            return mergeInto({
                part: findPart(line, event.kind) ?? addPart(line, { kind: event.kind, entries: [] }),
                opposite: findPart(line, event.kind === 'labeled' ? 'unlabeled' : 'labeled'),
                entry: { key: event.label.name, object: event.label },
            });
        case 'assigned':
        case 'unassigned':
            return mergeInto({
                part: findPart(line, event.kind) ?? addPart(line, { kind: event.kind, entries: [] }),
                opposite: findPart(line, event.kind === 'assigned' ? 'unassigned' : 'assigned'),
                // A deleted account: told from no other.
                entry: { key: event.assignee?.login ?? null, object: event.assignee },
            });
        case 'reviewRequested':
        case 'reviewRequestRemoved': {
            const { reviewer } = event;
            // A reviewer GitHub no longer knows: nothing to name.
            if (!reviewer) {
                return;
            }

            const key = getReviewerKey(reviewer);
            const reviewedAt = reviewer.kind === 'user' ? firstReviews.get(reviewer.user.login) : undefined;
            const kind =
                event.kind === 'reviewRequested' && reviewedAt !== undefined && reviewedAt < Date.parse(event.createdAt)
                    ? 'reviewRequestedAgain'
                    : event.kind;
            const opposites: (MergingPart<string, ItemDetailReviewRequest> | undefined)[] =
                kind === 'reviewRequestRemoved'
                    ? [findPart(line, 'reviewRequested'), findPart(line, 'reviewRequestedAgain')]
                    : [findPart(line, 'reviewRequestRemoved')];
            return mergeInto({
                part: findPart(line, kind) ?? addPart(line, { kind, entries: [] }),
                opposite: opposites.find(part => part?.entries.some(other => other.key === key)),
                entry: { key, object: reviewer },
            });
        }
        case 'crossReferenced':
            return mergeInto({
                part: findPart(line, event.kind) ?? addPart(line, { kind: event.kind, entries: [] }),
                entry: { key: event.source.id, object: event.source },
            });
        case 'subIssueAdded':
        case 'subIssueRemoved':
            if (!event.issue) {
                line.parts.push({ kind: 'single', event });
                return;
            }

            return mergeInto({
                part: findPart(line, event.kind) ?? addPart(line, { kind: event.kind, entries: [] }),
                opposite: findPart(line, event.kind === 'subIssueAdded' ? 'subIssueRemoved' : 'subIssueAdded'),
                entry: { key: event.issue.id, object: event.issue },
            });
        case 'referenced':
            if (!event.commit) {
                line.parts.push({ kind: 'single', event });
                return;
            }

            return mergeInto({
                part: findPart(line, event.kind) ?? addPart(line, { kind: event.kind, entries: [] }),
                entry: { key: event.commit.url, object: event.commit },
            });
        default: {
            const key = getUndoKey(event);
            const index = key === null ? -1 : line.parts.findIndex(part => isUndoneBy(part, key));
            if (index >= 0) {
                line.parts.splice(index, 1);
                return;
            }

            line.parts.push({ kind: 'single', event });
        }
    }
}

/** The parameters of {@link mergeInto}. */
interface MergeIntoParams<TObject> {
    readonly part: MergingPart<string, TObject>;
    /** The part of the kind that undoes it: an add's remove, a remove's add. */
    readonly opposite?: MergingPart<string, TObject>;
    readonly entry: MergedEntry<TObject>;
}

/**
 * The object joins the part of its kind, once; or, when the part of the opposite kind holds the same thing (an add and
 * a remove of it), leaves it there.
 */
function mergeInto<TObject>({ part, opposite, entry }: MergeIntoParams<TObject>) {
    const { key } = entry;
    if (key === null) {
        part.entries.push(entry);
        return;
    }

    if (opposite && removeFrom(opposite.entries, other => other.key === key)) {
        return;
    }

    if (!part.entries.some(other => other.key === key)) {
        part.entries.push(entry);
    }
}

function findPart<TKind extends MergingKind>(line: BurstLine, kind: TKind) {
    return line.parts.find((part): part is Extract<MutablePart, { readonly kind: TKind }> => part.kind === kind);
}

function addPart<TPart extends MutablePart>(line: BurstLine, part: TPart): TPart {
    line.parts.push(part);
    return part;
}

/** Takes the first entry `matches` out of `list`; whether there was one. */
function removeFrom<T>(list: T[], matches: (entry: T) => boolean) {
    const index = list.findIndex(matches);
    if (index < 0) {
        return false;
    }

    list.splice(index, 1);
    return true;
}

/** The part as the line shows it; none when every object of it was cancelled. */
function toPart(part: MutablePart): ThreadEventPart[] {
    switch (part.kind) {
        case 'labeled':
        case 'unlabeled':
            return toMergedPart(part);
        case 'assigned':
        case 'unassigned':
            return toMergedPart(part);
        case 'reviewRequested':
        case 'reviewRequestedAgain':
        case 'reviewRequestRemoved':
            return toMergedPart(part);
        case 'crossReferenced':
        case 'subIssueAdded':
        case 'subIssueRemoved':
            return toMergedPart(part);
        case 'referenced':
            return toMergedPart(part);
        case 'single':
            return [part];
        default:
            return assertNever(part);
    }
}

function toMergedPart<TKind extends string, TObject>(
    part: MergingPart<TKind, TObject>,
): ThreadMergedPart<TKind, TObject>[] {
    return part.entries.length > 0 ? [{ kind: part.kind, objects: part.entries.map(entry => entry.object) }] : [];
}

/** What an event adds or removes, and what undoes it. */
interface UndoKey {
    /** The kind of event that undoes it. */
    readonly undoneBy: SingleThreadEvent['kind'];
    /** What it added or removed. */
    readonly thing: string;
}

/** A part a later event of the line undoes: it is the opposite kind, of the same thing. */
function isUndoneBy(part: MutablePart, key: UndoKey) {
    if (part.kind !== 'single') {
        return false;
    }

    const own = getUndoKey(part.event);
    return own !== null && part.event.kind === key.undoneBy && own.thing === key.thing;
}

/**
 * For an add or a remove (F13: "an add and a remove of the same thing cancel out"): the kind that undoes it and what
 * it was of; `null` for an event nothing undoes.
 */
function getUndoKey(event: SingleThreadEvent): UndoKey | null {
    switch (event.kind) {
        case 'milestoned':
            return { undoneBy: 'demilestoned', thing: event.milestone };
        case 'demilestoned':
            return { undoneBy: 'milestoned', thing: event.milestone };
        case 'parentAdded':
            return event.issue && { undoneBy: 'parentRemoved', thing: event.issue.id };
        case 'parentRemoved':
            return event.issue && { undoneBy: 'parentAdded', thing: event.issue.id };
        case 'connected':
            return { undoneBy: 'disconnected', thing: event.ref.id };
        case 'disconnected':
            return { undoneBy: 'connected', thing: event.ref.id };
        case 'addedToProject':
            return event.project && { undoneBy: 'removedFromProject', thing: event.project.url };
        case 'removedFromProject':
            return event.project && { undoneBy: 'addedToProject', thing: event.project.url };
        case 'pinned':
            return { undoneBy: 'unpinned', thing: '' };
        case 'unpinned':
            return { undoneBy: 'pinned', thing: '' };
        // Single only when the viewer cannot see what it was of (`addToBurst`): nothing to cancel by.
        case 'subIssueAdded':
        case 'subIssueRemoved':
        case 'referenced':
        case 'forcePushed':
        case 'renamed':
        case 'reviewDismissed':
        case 'readyForReview':
        case 'convertedToDraft':
        case 'baseChanged':
        case 'closed':
        case 'reopened':
        case 'merged':
        case 'headRefDeleted':
        case 'issueTypeChanged':
        case 'projectStatusChanged':
        case 'transferred':
        case 'locked':
        case 'unlocked':
            return null;
        default:
            return assertNever(event);
    }
}

function getReviewerKey(reviewer: ItemDetailReviewRequest) {
    return reviewer.kind === 'user' ? `user:${reviewer.user.login}` : `team:${reviewer.slug}`;
}

/** One push is one author's: their account, else the name git records. */
function getAuthorKey(commit: ThreadCommit) {
    return commit.actor?.login ?? `name:${commit.authorName ?? ''}`;
}

/**
 * The failed checks of the pull request's newest commit, once every check on it finished (F13): none while one still
 * runs, or when none failed — each check by its newest run, a cancelled one no failure. It happened when the last of
 * them finished.
 */
function getChecksFailed(item: PullRequestItem, detail: PullRequestDetail): ThreadChecksFailed | null {
    // GitHub cut the list: whether the rest finished is not known.
    if (detail.checks.length < detail.checkCount) {
        return null;
    }

    const checks = getNewestRuns(detail.checks);
    if (checks.some(check => check.state === 'pending')) {
        return null;
    }

    const failing = checks.filter(check => check.state === 'failing' && !check.cancelled);
    if (failing.length === 0) {
        return null;
    }

    const times = checks.flatMap(check => {
        const at = check.completedAt ?? check.startedAt;
        return at === null ? [] : [at];
    });
    const head = detail.events.newest.toReversed().find((event): event is ThreadCommit => event.kind === 'commit');
    return {
        kind: 'checksFailed',
        id: `checks:${item.headRefOid}`,
        commit: { abbreviatedOid: item.headRefOid.slice(0, 7), url: `${item.url}/commits/${item.headRefOid}` },
        failedCount: failing.length,
        failed: [...new Set(failing.map(check => check.name))],
        total: checks.length,
        // No time told: after the newest commit, at least.
        updatedAt: times.toSorted().at(-1) ?? head?.createdAt ?? item.updatedAt,
    };
}

/**
 * Each check's newest run: GitHub lists every run on the commit, a run of its workflow again (a re-run, a newer push
 * of the same head) beside the one it replaced — healedcare/healed#586 held Build cancelled and Build passing.
 */
function getNewestRuns(checks: readonly ItemCheck[]): ItemCheck[] {
    const newest = new Map<string, ItemCheck>();
    for (const check of checks) {
        const key = `${check.kind}:${check.workflow ?? ''}:${check.name}`;
        const held = newest.get(key);
        if (!held || getStartedAt(check) >= getStartedAt(held)) {
            newest.set(key, check);
        }
    }

    return [...newest.values()];
}

function getStartedAt(check: ItemCheck) {
    return check.startedAt === null ? -Infinity : Date.parse(check.startedAt);
}
