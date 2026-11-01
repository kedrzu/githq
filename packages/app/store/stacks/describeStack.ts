import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

import type { PullRequestStack } from './groupStacks.js';

/** What a stack's entry shows (D4, D5, D7, D14, D15): its name, count, pips and state, for the UI to put in words. */
export interface StackDescription {
    readonly name: StackName;
    /** How many pull requests the stack holds. */
    readonly size: number;
    /** How many of them the copy holds; below {@link size} the entry reads "2 of 4 in githq". */
    readonly held: number;
    /** One per pull request, first to last (D6), a missing one included. */
    readonly pips: readonly StackPip[];
    readonly state: StackState;
    /** How many of its pull requests are merged — "1 landed · …" before the state while others are open. */
    readonly landed: number;
    /** The latest update of its pull requests (D15). */
    readonly updatedAt: string;
}

/** A stack's name (D4). */
export interface StackName {
    readonly title: string;
    /** The issue whose title it is; `null` when it is the first pull request's. */
    readonly issueId: string | null;
}

/** A pip of a stack's entry: a pull request in its own state, or a place the copy does not hold yet. */
export type StackPip = StackPullRequestPip | StackMissingPip;

/** A pull request of the stack, in its own state. */
export interface StackPullRequestPip {
    readonly kind: StackPullRequestPipKind;
    readonly pullRequest: PullRequestItem;
}

/** A place in the stack the copy does not hold a pull request for (D7). */
export interface StackMissingPip {
    readonly kind: 'missing';
    readonly position: number;
}

/**
 * The state of one pull request as its pip shows it — its own, not held back by earlier ones (D5):
 *
 * - `broken`: failing checks, conflicts or changes requested — something for its author;
 * - `moving`: checks running, or any open one of a stack that needs a rebase (D21);
 * - `waiting`: open and none of the others — waiting for a review, mostly; also every pip while the copy is
 *   incomplete (D7: pale, never ready).
 */
export type StackPullRequestPipKind = 'merged' | 'closed' | 'draft' | 'ready' | 'broken' | 'moving' | 'waiting';

/**
 * How a stack stands, the first that applies in this order. Merging is not covered yet (being merged, queued,
 * auto-merge, a merge stopped partway).
 */
export type StackState =
    | StackMergedState
    | StackIncompleteState
    | StackNeedsRebaseState
    | StackClosedInsideState
    | StackClosedState
    | StackReviewRequestedState
    | StackReadyState
    | StackHeldState;

/** Every pull request of the stack is merged. */
export interface StackMergedState {
    readonly kind: 'merged';
}

/** The copy holds fewer pull requests than the stack's size — never reads as ready while it does (D7). */
export interface StackIncompleteState {
    readonly kind: 'incomplete';
}

/**
 * An open pull request above the lowest open one is behind its base: GitHub refuses every merge until the stack
 * is rebased on github.com (D8). A moved base under the lowest open one alone does not block.
 */
export interface StackNeedsRebaseState {
    readonly kind: 'needsRebase';
    /** The first open pull request behind its base, above the lowest open one. */
    readonly behindNumber: number;
}

/** A pull request was closed without merging below open ones, which are stuck until the stack is linked again. */
export interface StackClosedInsideState {
    readonly kind: 'closedInside';
    /** The first closed pull request with open ones after it. */
    readonly closedNumber: number;
    /** How many open pull requests come after it. */
    readonly stuckCount: number;
}

/** Nothing is open and not everything was merged: the stack was given up. */
export interface StackClosedState {
    readonly kind: 'closed';
}

/** Someone else's stack with the viewer's review asked on some of its open pull requests (D7). */
export interface StackReviewRequestedState {
    readonly kind: 'reviewRequested';
    /** On how many open pull requests the viewer's review is asked. */
    readonly requestedCount: number;
    readonly openCount: number;
    /** How many open pull requests can merge, counted from the lowest open one ({@link StackHeldState.readyCount}). */
    readonly readyCount: number;
}

/** Every open pull request can merge. */
export interface StackReadyState {
    readonly kind: 'ready';
    readonly openCount: number;
}

/** Some open pull request cannot merge, and it holds back every one after it (D5): "2 of 4 ready, #36 blocks". */
export interface StackHeldState {
    readonly kind: 'held';
    /**
     * How many open pull requests can merge, counted from the lowest open one up to the first that cannot — a
     * pull request merges only together with everything before it.
     */
    readonly readyCount: number;
    readonly openCount: number;
    /** The first open pull request, from the lowest, that cannot merge. */
    readonly blocker: StackBlocker;
}

/**
 * The pull request that holds a stack back, and why as its pip shows it — what the sentence names (SP14): "#102 is a
 * draft", "#1216 checks running", "#97 waiting for review", otherwise "#1206 blocks".
 */
export interface StackBlocker {
    readonly number: number;
    readonly kind: StackPullRequestPipKind;
    /** A `waiting` one waits for a review; `waiting` for anything else only "blocks". */
    readonly waitingForReview: boolean;
}

/** What a stack is described from. */
export interface DescribeStackParams {
    readonly stack: PullRequestStack;
    /** The signed-in user's login: their own stack never reads as asking for their review. */
    readonly viewerLogin: string;
    /** An item of the local copy by id — the issues a stack closes, for its name. */
    readonly getItem: (id: string) => Item | undefined;
}

/**
 * What a stack's entry shows, worked out from its pull requests alone: GitHub's `mergeStateStatus` of a stacked
 * pull request does not account for earlier ones (checked live, 2026-11-01).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function describeStack(params: DescribeStackParams): StackDescription {
    const { stack } = params;
    const { members } = stack;
    const open = members.filter(isOpenPullRequest);
    const lowestOpen = open[0];
    const behind = open.find(pr => pr !== lowestOpen && pr.behindBase);
    const pips = getPips(stack, behind !== undefined);

    let updatedAt = '';
    for (const member of members) {
        if (member.updatedAt > updatedAt) {
            updatedAt = member.updatedAt;
        }
    }

    return {
        name: getStackName(params),
        size: stack.size,
        held: members.length,
        pips,
        state: getState(),
        landed: members.filter(isMerged).length,
        updatedAt,
    };

    function getState(): StackState {
        if (pips.some(pip => pip.kind === 'missing')) {
            return { kind: 'incomplete' };
        }

        if (members.every(isMerged)) {
            return { kind: 'merged' };
        }

        if (behind) {
            return { kind: 'needsRebase', behindNumber: behind.number };
        }

        const closedIndex = members.findIndex(
            (pr, index) => isClosed(pr) && members.slice(index + 1).some(isOpenPullRequest),
        );
        const closed = members[closedIndex];
        if (closed) {
            return {
                kind: 'closedInside',
                closedNumber: closed.number,
                stuckCount: members.slice(closedIndex + 1).filter(isOpenPullRequest).length,
            };
        }

        if (open.length === 0) {
            return { kind: 'closed' };
        }

        let readyCount = 0;
        for (const pr of open) {
            if (!canMerge(pr)) {
                break;
            }

            readyCount++;
        }

        const requestedCount = open.filter(pr => isReviewRequestedOf(pr, params.viewerLogin)).length;
        const viewerAuthors = members.some(pr => pr.author?.login === params.viewerLogin);
        if (requestedCount > 0 && !viewerAuthors) {
            return { kind: 'reviewRequested', requestedCount, openCount: open.length, readyCount };
        }

        const blocker = open[readyCount];
        if (!blocker) {
            return { kind: 'ready', openCount: open.length };
        }

        return {
            kind: 'held',
            readyCount,
            openCount: open.length,
            blocker: {
                number: blocker.number,
                kind: getPipKind(blocker),
                waitingForReview: getPullRequestStanding(blocker).waitingForReview,
            },
        };
    }
}

/**
 * The stack's name (D4): the title of the first issue in the copy that one of its pull requests closes — in
 * their order, each pull request's issues in theirs — otherwise its first pull request's title.
 */
function getStackName(params: DescribeStackParams): StackName {
    const { members } = params.stack;
    for (const member of members) {
        for (const issueId of member.closingIssueIds) {
            const issue = params.getItem(issueId);
            if (issue?.kind === 'issue') {
                return { title: issue.title, issueId: issue.id };
            }
        }
    }

    return { title: members[0]?.title ?? '', issueId: null };
}

/**
 * The pips of a stack, a missing one in each place the copy does not hold. While the copy is incomplete every pip is
 * pale — never green, never ready (D7, SP14); a stack needing a rebase has every open one amber (D21).
 */
function getPips(stack: PullRequestStack, needsRebase: boolean): StackPip[] {
    const pips: StackPip[] = [];
    let next = 1;
    for (const member of stack.members) {
        const position = member.stack?.position ?? next;
        while (next < position) {
            pips.push({ kind: 'missing', position: next++ });
        }

        pips.push({ kind: getPipKind(member), pullRequest: member });
        next = Math.max(next, position + 1);
    }

    while (next <= stack.size) {
        pips.push({ kind: 'missing', position: next++ });
    }

    if (pips.some(pip => pip.kind === 'missing')) {
        return pips.map((pip): StackPip => (pip.kind === 'missing' ? pip : { ...pip, kind: 'waiting' }));
    }

    if (needsRebase) {
        return pips.map((pip): StackPip =>
            pip.kind !== 'missing' && isOpenPullRequest(pip.pullRequest) ? { ...pip, kind: 'moving' } : pip,
        );
    }

    return pips;
}

/** A pull request's own state, as its pip shows it. */
function getPipKind(pr: PullRequestItem): StackPullRequestPipKind {
    if (isMerged(pr)) {
        return 'merged';
    }

    if (isClosed(pr)) {
        return 'closed';
    }

    if (pr.isDraft) {
        return 'draft';
    }

    if (canMerge(pr)) {
        return 'ready';
    }

    const standing = getPullRequestStanding(pr);
    if (standing.needsAuthor) {
        return 'broken';
    }

    if (standing.checksRunning) {
        return 'moving';
    }

    return 'waiting';
}

/** Open, not a draft, and GitHub lets it merge — as far as it alone goes (D5). */
function canMerge(pr: PullRequestItem): boolean {
    if (!isOpenPullRequest(pr) || pr.isDraft) {
        return false;
    }

    switch (pr.mergeStateStatus) {
        case 'CLEAN':
        case 'HAS_HOOKS':
        case 'UNSTABLE':
            return true;
        default:
            return false;
    }
}

function isReviewRequestedOf(pr: PullRequestItem, login: string): boolean {
    return pr.reviewRequests.some(request => request.kind === 'user' && request.login === login);
}

function isMerged(pr: PullRequestItem): boolean {
    return pr.merged || pr.state === 'MERGED';
}

function isClosed(pr: PullRequestItem): boolean {
    return pr.state === 'CLOSED' && !pr.merged;
}
