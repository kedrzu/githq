import { assertNever } from '@nzyme/utils/assertNever.js';

import type { FailedComment } from '@/edits/CommentDrafts.js';
import type {
    ItemComment,
    ItemDetail,
    ItemDetailReviewRequest,
    ThreadCommit,
    ThreadCommitRef,
    ThreadEvent,
} from '@/store/ItemDetailTypes.js';
import type { Item, ItemLabel, ItemUser } from '@/store/ItemTypes.js';

/** How long one person's events straight after each other share a line, from the first of them (F13). */
const BURST_MS = 10 * 60_000;

/**
 * One entry of an item's thread, as it is drawn (item-activity F5, F13): the description, a comment, a line of one
 * person's events, a push of commits, a pull request's failed checks, a comment GitHub did not take.
 */
export type ThreadItem =
    | { readonly kind: 'description'; readonly id: string }
    | { readonly kind: 'comment'; readonly id: string; readonly comment: ItemComment }
    | ThreadEventLine
    | ThreadPush
    | ThreadChecksFailed
    | { readonly kind: 'failedComment'; readonly id: string; readonly failed: FailedComment };

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

/** What one or more events of a line did. */
export type ThreadEventPart =
    | { readonly kind: 'labeled' | 'unlabeled'; readonly labels: readonly ItemLabel[] }
    | {
          readonly kind: 'assigned' | 'unassigned';
          /** `null` for a deleted account. */
          readonly users: readonly (ItemUser | null)[];
      }
    | {
          readonly kind: 'reviewRequested' | 'reviewRequestRemoved';
          readonly reviewers: readonly ItemDetailReviewRequest[];
      }
    | { readonly kind: 'single'; readonly event: SingleThreadEvent };

/** An event that is a part of its own: its objects merge with no other's. */
export type SingleThreadEvent = Exclude<ThreadEvent, { readonly kind: MergingKind | 'commit' }>;

/** One author's commits straight after each other: GitHub tells of each commit, not of the push that brought it. */
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

/** The parameters of {@link buildThread}. */
export interface BuildThreadParams {
    readonly item: Item;
    readonly detail: ItemDetail;
    /** The user's comments GitHub did not take, in the order they were written. */
    readonly failedComments?: readonly FailedComment[];
}

type MergingKind = Exclude<ThreadEventPart['kind'], 'single'>;

/** An entry of the thread placed by its time, before the events are put into lines and the commits into pushes. */
type Timed =
    | { readonly at: number; readonly kind: 'event'; readonly event: Exclude<ThreadEvent, ThreadCommit> }
    | { readonly at: number; readonly kind: 'commit'; readonly commit: ThreadCommit }
    | { readonly at: number; readonly kind: 'item'; readonly item: ThreadItem };

/**
 * An item's thread as it is drawn, oldest first (item-activity F5, F13): the description, then every comment and event
 * read, by time — one person's events within 10 minutes on one line, an add and a remove of the same thing gone, one
 * author's commits as one push, a pull request's failed checks once they finished — then the user's comments on their
 * way, then those GitHub did not take. An event no person made is left out but a project workflow's Status change.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildThread({ item, detail, failedComments = [] }: BuildThreadParams): ThreadItem[] {
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

    for (const event of [...detail.events.oldest, ...detail.events.newest]) {
        const at = Date.parse(event.createdAt);
        if (event.kind === 'commit') {
            timed.push({ at, kind: 'commit', commit: event });
        } else if (isShown(event)) {
            timed.push({ at, kind: 'event', event });
        }
    }

    const checks = detail.kind === 'pullRequest' && item.kind === 'pullRequest' ? getChecksFailed(item, detail) : null;
    if (checks) {
        timed.push({ at: Date.parse(checks.updatedAt), kind: 'item', item: checks });
    }

    // Stable: what GitHub lists in one order at one time stays in it.
    const ordered = timed.toSorted((a, b) => a.at - b.at);
    return [
        { kind: 'description', id: 'description' },
        ...groupTimed(ordered),
        ...pending,
        ...failedComments.map((failed): ThreadItem => ({ kind: 'failedComment', id: `failed:${failed.id}`, failed })),
    ];
}

/** Never shown (F13): an automatic event with no person, but a project workflow's Status change. */
function isShown(event: Exclude<ThreadEvent, ThreadCommit>) {
    return event.actor !== null || (event.kind === 'projectStatusChanged' && event.wasAutomated);
}

function groupTimed(ordered: readonly Timed[]): ThreadItem[] {
    const items: Building[] = [];
    let burst: Burst | null = null;
    let push: MutablePush | null = null;
    for (const entry of ordered) {
        if (entry.kind === 'event') {
            push = null;
            const { event } = entry;
            if (burst && continuesBurst(burst, event, entry.at)) {
                addToBurst(burst, event);
                continue;
            }

            burst = startBurst(event, entry.at);
            items.push(burst.line);
            continue;
        }

        burst = null;
        if (entry.kind === 'commit') {
            const { commit } = entry;
            if (push && getAuthorKey(push.commits[0]) === getAuthorKey(commit)) {
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
    | { readonly kind: 'labeled' | 'unlabeled'; labels: ItemLabel[] }
    | { readonly kind: 'assigned' | 'unassigned'; users: (ItemUser | null)[] }
    | { readonly kind: 'reviewRequested' | 'reviewRequestRemoved'; reviewers: ItemDetailReviewRequest[] }
    | { readonly kind: 'single'; readonly event: SingleThreadEvent };

interface MutablePush {
    readonly commits: ThreadCommit[];
}

/** An entry {@link groupTimed} still adds to as it goes. */
type Building = ThreadItem | BurstLine | { readonly kind: 'pushRef'; readonly push: MutablePush };

function finish(entry: Building): ThreadItem[] {
    switch (entry.kind) {
        case 'burst': {
            const parts = entry.parts.filter(part => !isEmptyPart(part));
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

function continuesBurst(burst: Burst, event: Exclude<ThreadEvent, ThreadCommit>, at: number) {
    const { actor } = burst.line;
    return actor !== null && event.actor?.login === actor.login && at - burst.at <= BURST_MS;
}

function startBurst(event: Exclude<ThreadEvent, ThreadCommit>, at: number): Burst {
    const burst: Burst = {
        line: { kind: 'burst', id: event.id, actor: event.actor, parts: [], updatedAt: event.createdAt },
        at,
    };
    addToBurst(burst, event);
    return burst;
}

/** The event joins the line: its objects go to the part of its kind, and an add and a remove of one thing cancel. */
function addToBurst({ line }: Burst, event: Exclude<ThreadEvent, ThreadCommit>) {
    line.updatedAt = event.createdAt;
    switch (event.kind) {
        case 'labeled':
        case 'unlabeled': {
            const opposite = event.kind === 'labeled' ? 'unlabeled' : 'labeled';
            const cancelled = findPart(line, opposite);
            if (cancelled && removeFrom(cancelled.labels, label => label.name === event.label.name)) {
                return;
            }

            const part = findPart(line, event.kind) ?? addPart(line, { kind: event.kind, labels: [] });
            if (!part.labels.some(label => label.name === event.label.name)) {
                part.labels.push(event.label);
            }

            return;
        }
        case 'assigned':
        case 'unassigned': {
            const login = event.assignee?.login;
            const opposite = event.kind === 'assigned' ? 'unassigned' : 'assigned';
            const cancelled = findPart(line, opposite);
            if (login && cancelled && removeFrom(cancelled.users, user => user?.login === login)) {
                return;
            }

            const part = findPart(line, event.kind) ?? addPart(line, { kind: event.kind, users: [] });
            if (!login || !part.users.some(user => user?.login === login)) {
                part.users.push(event.assignee);
            }

            return;
        }
        case 'reviewRequested':
        case 'reviewRequestRemoved': {
            const { reviewer } = event;
            // A reviewer GitHub no longer knows: nothing to name.
            if (!reviewer) {
                return;
            }

            const key = getReviewerKey(reviewer);
            const opposite = event.kind === 'reviewRequested' ? 'reviewRequestRemoved' : 'reviewRequested';
            const cancelled = findPart(line, opposite);
            if (cancelled && removeFrom(cancelled.reviewers, other => getReviewerKey(other) === key)) {
                return;
            }

            const part = findPart(line, event.kind) ?? addPart(line, { kind: event.kind, reviewers: [] });
            if (!part.reviewers.some(other => getReviewerKey(other) === key)) {
                part.reviewers.push(reviewer);
            }

            return;
        }
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

function isEmptyPart(part: MutablePart) {
    switch (part.kind) {
        case 'labeled':
        case 'unlabeled':
            return part.labels.length === 0;
        case 'assigned':
        case 'unassigned':
            return part.users.length === 0;
        case 'reviewRequested':
        case 'reviewRequestRemoved':
            return part.reviewers.length === 0;
        case 'single':
            return false;
        default:
            return assertNever(part);
    }
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
        case 'subIssueAdded':
            return event.issue && { undoneBy: 'subIssueRemoved', thing: event.issue.id };
        case 'subIssueRemoved':
            return event.issue && { undoneBy: 'subIssueAdded', thing: event.issue.id };
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
        case 'markedAsDuplicate':
            return event.canonical && { undoneBy: 'unmarkedAsDuplicate', thing: event.canonical.id };
        case 'unmarkedAsDuplicate':
            return event.canonical && { undoneBy: 'markedAsDuplicate', thing: event.canonical.id };
        case 'pinned':
            return { undoneBy: 'unpinned', thing: '' };
        case 'unpinned':
            return { undoneBy: 'pinned', thing: '' };
        case 'forcePushed':
        case 'renamed':
        case 'reviewDismissed':
        case 'readyForReview':
        case 'convertedToDraft':
        case 'baseChanged':
        case 'crossReferenced':
        case 'closed':
        case 'reopened':
        case 'merged':
        case 'headRefDeleted':
        case 'referenced':
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
function getAuthorKey(commit: ThreadCommit | undefined) {
    return commit?.actor?.login ?? `name:${commit?.authorName ?? ''}`;
}

/**
 * The failed checks of the pull request's newest commit, once every check on it finished (F13): none while one still
 * runs, or when none failed. It happened when the last of them finished.
 */
function getChecksFailed(
    item: Extract<Item, { readonly kind: 'pullRequest' }>,
    detail: Extract<ItemDetail, { readonly kind: 'pullRequest' }>,
): ThreadChecksFailed | null {
    const { checks } = detail;
    // GitHub cut the list: whether the rest finished is not known.
    if (checks.length < detail.checkCount || checks.some(check => check.state === 'pending')) {
        return null;
    }

    const failing = checks.filter(check => check.state === 'failing');
    if (failing.length === 0) {
        return null;
    }

    const times = checks.flatMap(check => {
        const at = check.completedAt ?? check.startedAt;
        return at === null ? [] : [at];
    });
    const head = detail.events.newest.toReversed().find((event): event is ThreadCommit => event.kind === 'commit');
    const abbreviatedOid = item.headRefOid.slice(0, 7);
    return {
        kind: 'checksFailed',
        id: `checks:${item.headRefOid}`,
        commit:
            head?.abbreviatedOid === abbreviatedOid
                ? { abbreviatedOid, url: head.url }
                : { abbreviatedOid, url: `${item.url}/commits/${item.headRefOid}` },
        failedCount: failing.length,
        failed: [...new Set(failing.map(check => check.name))],
        total: detail.checkCount,
        // No time told: after the newest commit, at least.
        updatedAt: times.toSorted().at(-1) ?? head?.createdAt ?? item.updatedAt,
    };
}
