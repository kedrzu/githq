import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';
import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { readAsyncMerge } from '@githq/github/rest/readAsyncMerge.js';
import { requestAsyncMerge } from '@githq/github/rest/requestAsyncMerge.js';
import type { RequestAsyncMergeParams } from '@githq/github/rest/requestAsyncMerge.js';
import type { AsyncMergeAnswer } from '@githq/github/rest/sendAsyncMergeRequest.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import type { Edit, EditAnswer, EditFailureReason, EditVerdict } from '@/edits/EditTypes.js';
import { toEditFailureReason } from '@/edits/toEditFailureReason.js';
import { getItemReference } from '@/item/itemRoutes.js';
import type { ClockShape } from '@/services/Clock.js';
import type { ItemOverlayLayer } from '@/store/ItemOverlay.js';
import type { Item, PullRequestItem, PullRequestMergedAs } from '@/store/ItemTypes.js';
import { toPullRequestStatus } from '@/store/toItem.js';
import { isPresent } from '@/utils/isPresent.js';
import { pause } from '@/utils/pause.js';

import type { MergeAnswer, MergeLateEnd, MergeRequest } from './MergeTypes.js';

/** What {@link createMergeEdits} makes the merge of. */
export interface CreateMergeEditsParams {
    /** The pull request as shown: its head commit is the one the merge names. */
    readonly item: PullRequestItem;
    /**
     * The open pull requests of its stack before it, which the merge lands with it (stacked PRs D11): GitHub lands
     * every one below the one merged. None outside a stack's merge.
     */
    readonly members?: readonly PullRequestItem[];
    readonly request: MergeRequest;
    /** Time and timers: asking for the merge's result waits on them. */
    readonly clock: ClockShape;
    /** Told once how GitHub took the merge at first ({@link MergeAnswer}); not told when it was never sent. */
    readonly onAnswer: (answer: MergeAnswer) => void;
    /** Told how a merge GitHub accepted ended while it ran: merged, refused, or no answer in time. */
    readonly onLateEnd: (end: MergeLateEnd) => void;
    /**
     * Whether the merge panel shows the pull request: a refusal is then the panel's to show, and otherwise a failed
     * edit, so a panel closed before GitHub answered does not lose it.
     */
    readonly shown: () => boolean;
}

/** The first wait before asking how a merge GitHub accepted ended; each next one doubles, up to the longest. */
const FIRST_POLL_MS = 1000;
const LONGEST_POLL_MS = 5000;
/** How long the merge's result is asked for: past it, the regular sync decides (D3), and the panel says so (PM29). */
export const MERGE_TIME_LIMIT_MS = 2 * 60_000;

/**
 * The merge of a pull request as edits: its own, first, and one of each other pull request
 * the merge lands with it — a stack's earlier ones (stacked PRs D11). Each of those is drawn as being merged too, and
 * GitHub's word on the merge is all there is of them (D3): merged when it says merged; refused or not known, their
 * layer goes without a word, for a merge refused partway may have landed some — what is true shows once the stack is
 * read again.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createMergeEdits(params: CreateMergeEditsParams): Edit[] {
    const { members = [], request, clock } = params;
    const edit = createMergeEdit(params);
    const { send } = edit;
    if (members.length === 0 || !send) {
        return [edit];
    }

    const ended = createPromise<EditVerdict>();
    const top: Edit = {
        ...edit,
        send: async account => {
            let answer: EditAnswer;
            try {
                answer = await send(account);
            } catch (error) {
                ended.resolve({ kind: 'unknown' });
                throw error;
            }

            if (answer.kind !== 'following') {
                ended.resolve(answer);
                return answer;
            }

            const { follow } = answer;
            return {
                kind: 'following',
                follow: async () => {
                    const verdict = await follow().catch((error: unknown) => {
                        ended.resolve({ kind: 'unknown' });
                        throw error;
                    });
                    ended.resolve(verdict);
                    return verdict;
                },
            };
        },
    };

    return [top, ...members.map(member => createMemberEdit(member))];

    /**
     * Waits for GitHub's word on the merge outside the edits sent at once (`following`): it may take minutes, and
     * the merge itself must not wait behind it.
     */
    function createMemberEdit(member: PullRequestItem): Edit {
        return {
            itemId: member.id,
            reference: `${member.repository.nameWithOwner}#${member.number}`,
            subject: { kind: 'merged' },
            optimistic: getBeingMergedLayer(request.method),
            send: () =>
                Promise.resolve({
                    kind: 'following',
                    follow: async () => toMemberVerdict(await ended.promise),
                }),
        };
    }

    /**
     * Merged as the merge was: without a commit of its own to say, as GitHub's answer names only the top's. A top put
     * in a merge queue is confirmed with nothing merged: nor is any of these.
     */
    function toMemberVerdict(verdict: EditVerdict): EditVerdict {
        if (verdict.kind !== 'confirmed' || !isMerged(verdict.layer.item(params.item))) {
            return { kind: 'unknown' };
        }

        return { kind: 'confirmed', layer: getMergedLayer(clock.now()) };
    }
}

/**
 * The merge of the pull request itself as an edit (merging D3, D5, D6). It draws the pull request as being merged
 * (`merging`) and nothing else: never merged until GitHub says so. It asks GitHub's asynchronous merge with the
 * head commit the user saw, and the commit's title and message only when the user edited them. On a merge queue's
 * branch the head commit goes alone: GitHub refuses a method or a text there, the queue has its own. GitHub's `merged`
 * confirms it, and so does `enqueued`, with the pull request as GitHub then holds it: in the queue, not merged. A
 * refusal is left to the merge panel to show (`quiet`) while the panel shows the pull request, and is a failed edit
 * otherwise; with no answer in time, or with the request itself unanswered, the layer goes without a word and the next
 * sync shows what GitHub holds.
 */
function createMergeEdit(params: CreateMergeEditsParams): Edit {
    const { item, request, clock, onAnswer, onLateEnd, shown } = params;
    const target = getItemReference(item);

    return {
        itemId: item.id,
        reference: `${item.repository.nameWithOwner}#${item.number}`,
        subject: { kind: 'merged' },
        optimistic: getBeingMergedLayer(request.method),
        send: async ({ rest, sdk }) => {
            let answer: AsyncMergeAnswer;
            try {
                answer = await requestAsyncMerge(
                    rest,
                    item.isMergeQueueEnabled
                        ? { ...target, sha: item.headRefOid }
                        : {
                              ...target,
                              mergeMethod: toRestMergeMethod(request.method),
                              sha: item.headRefOid,
                              ...(request.title === undefined ? {} : { commitTitle: request.title }),
                              ...(request.body === undefined ? {} : { commitMessage: request.body }),
                          },
                );
            } catch (error) {
                const reason = toEditFailureReason(error);
                onAnswer({ kind: 'refused', reason });
                // Unanswered, it may have reached GitHub all the same: neither refused nor failed — no failed edit,
                // and the next sync shows what GitHub holds (PM29).
                return reason.kind === 'offline' ? { kind: 'unknown' } : { kind: 'rejected', reason, quiet: shown() };
            }

            switch (answer.status) {
                case 'failed': {
                    const reason: EditFailureReason = { kind: 'refused', message: answer.message };
                    onAnswer({ kind: 'refused', reason });
                    return { kind: 'rejected', reason, quiet: shown() };
                }
                // Merged at once: GitHub answers so only for a pull request merged already (PM30).
                case 'merged':
                    onAnswer({ kind: 'merged' });
                    return merged(answer.sha);
                case 'enqueued':
                    onAnswer({ kind: 'accepted' });
                    return await readEnqueued(sdk);
                case 'pending':
                    onAnswer({ kind: 'accepted' });
                    return { kind: 'following', follow: () => follow(rest, sdk, answer.uuid) };
                default:
                    return assertNever(answer);
            }
        },
    };

    /**
     * Asks how the merge GitHub accepted ended, with growing waits, until it says or the time limit passes. A
     * request that fails meanwhile (offline, a 5xx) is asked again: the merge runs on GitHub regardless.
     */
    async function follow(rest: GitHubRestRequester, sdk: GitHubSdk, uuid: string): Promise<EditVerdict> {
        const deadline = clock.now() + MERGE_TIME_LIMIT_MS;
        let delay = FIRST_POLL_MS;
        while (clock.now() < deadline) {
            await pause(clock, Math.min(delay, deadline - clock.now()));
            delay = Math.min(delay * 2, LONGEST_POLL_MS);

            let answer: AsyncMergeAnswer;
            try {
                answer = await readAsyncMerge(rest, { ...target, uuid });
            } catch {
                continue;
            }

            switch (answer.status) {
                case 'merged':
                    onLateEnd({ kind: 'merged' });
                    return merged(answer.sha);
                case 'failed': {
                    const reason: EditFailureReason = { kind: 'refused', message: answer.message };
                    onLateEnd({ kind: 'refused', reason });
                    return { kind: 'rejected', reason, quiet: shown() };
                }
                case 'enqueued':
                    return await readEnqueued(sdk);
                case 'pending':
                    break;
                default:
                    return assertNever(answer);
            }
        }

        onLateEnd({ kind: 'unknown' });
        return { kind: 'unknown' };
    }

    /**
     * GitHub put it in the merge queue: the row confirmed with the status GitHub holds now, its place in the queue
     * among it. Left to the next sync when that could not be read.
     */
    async function readEnqueued(sdk: GitHubSdk): Promise<EditVerdict> {
        let nodes;
        try {
            ({ nodes } = await sdk.PullRequestStatuses({ ids: [item.id] }));
        } catch {
            return { kind: 'unknown' };
        }

        const node = nodes[0] ?? null;
        if (!isPresent(node)) {
            return { kind: 'unknown' };
        }

        const status = toPullRequestStatus(node);
        const { updatedAt } = node;
        return {
            kind: 'confirmed',
            layer: {
                item: current => (current.kind === 'pullRequest' ? { ...current, ...status } : current),
                supersededBy: stored => stored.updatedAt > updatedAt,
                confirmedAt: updatedAt,
            },
        };
    }

    /**
     * GitHub merged it. Drawn until GitHub's own copy says so: without GitHub's time of the merge, the row keeps no
     * confirmation mark, so any copy a sync reads takes the row's place, and an older one only shows under the layer.
     */
    function merged(sha: string): EditVerdict {
        return { kind: 'confirmed', layer: getMergedLayer(clock.now(), { method: request.method, sha }) };
    }
}

/** Drawn as being merged until GitHub's own copy says it is merged. */
function getBeingMergedLayer(method: PullRequestMergeMethod): ItemOverlayLayer {
    return {
        item: current => (current.kind === 'pullRequest' ? { ...current, merging: method } : current),
        supersededBy: isMerged,
    };
}

/** Drawn as merged until GitHub's own copy says so; `mergedAs` for the one whose commit GitHub named. */
function getMergedLayer(at: number, mergedAs?: PullRequestMergedAs): ItemOverlayLayer {
    const now = new Date(at).toISOString();
    return {
        item: current =>
            current.kind === 'pullRequest'
                ? {
                      ...current,
                      state: 'MERGED',
                      merged: true,
                      closedAt: current.closedAt ?? now,
                      ...(mergedAs ? { mergedAs } : {}),
                  }
                : current,
        supersededBy: isMerged,
    };
}

function isMerged(item: Item) {
    return item.kind === 'pullRequest' && item.merged;
}

function toRestMergeMethod(method: PullRequestMergeMethod): RequestAsyncMergeParams['mergeMethod'] {
    switch (method) {
        case 'MERGE':
            return 'merge';
        case 'SQUASH':
            return 'squash';
        case 'REBASE':
            return 'rebase';
        default:
            return assertNever(method);
    }
}
