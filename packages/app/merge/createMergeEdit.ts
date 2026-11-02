import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { readAsyncMerge } from '@githq/github/rest/readAsyncMerge.js';
import { requestAsyncMerge } from '@githq/github/rest/requestAsyncMerge.js';
import type { RequestAsyncMergeParams } from '@githq/github/rest/requestAsyncMerge.js';
import type { AsyncMergeAnswer } from '@githq/github/rest/sendAsyncMergeRequest.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { Edit, EditFailureReason, EditVerdict } from '@/edits/EditTypes.js';
import { toEditFailureReason } from '@/edits/toEditFailureReason.js';
import type { ClockShape } from '@/services/Clock.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';
import { pause } from '@/utils/pause.js';

import type { MergeAnswer, MergeRequest } from './MergeTypes.js';

/** What {@link createMergeEdit} makes the merge of. */
export interface CreateMergeEditParams {
    /** The pull request as shown: its head commit is the one the merge names. */
    readonly item: PullRequestItem;
    readonly request: MergeRequest;
    /** Time and timers: asking for the merge's result waits on them. */
    readonly clock: ClockShape;
    /** Told once how GitHub took the merge at first ({@link MergeAnswer}); not told when it was never sent. */
    readonly onAnswer: (answer: MergeAnswer) => void;
    /**
     * Whether the merge panel still shows what GitHub answers: a refusal at once is then the panel's to show, and
     * otherwise a failed edit, so a panel closed before GitHub answered does not lose it.
     */
    readonly shown: () => boolean;
}

/** The first wait before asking how a merge GitHub accepted ended; each next one doubles, up to the longest. */
const FIRST_POLL_MS = 1000;
const LONGEST_POLL_MS = 5000;
/** How long the merge's result is asked for: past it, the regular sync decides (D3). */
const MERGE_TIME_LIMIT_MS = 2 * 60_000;

/**
 * The merge of a pull request as an edit (merging D3, D5, D6). It draws the pull request as being merged
 * (`merging`) and nothing else: never merged until GitHub says so. It asks GitHub's asynchronous merge with the
 * head commit the user saw, and the commit's title and message only when the user edited them. GitHub's `merged`
 * confirms it; a refusal at once is left to the merge panel to show (`quiet`) while the panel still shows it, one
 * while it runs or after the panel closed is a failed edit; with no answer in time the layer goes without a word and
 * the next sync shows what GitHub holds.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createMergeEdit(params: CreateMergeEditParams): Edit {
    const { item, request, clock, onAnswer, shown } = params;
    const target = { ...parseRepositoryName(item.repository.nameWithOwner), number: item.number };

    return {
        itemId: item.id,
        reference: `${item.repository.nameWithOwner}#${item.number}`,
        subject: { kind: 'merged' },
        optimistic: {
            item: current => (current.kind === 'pullRequest' ? { ...current, merging: true } : current),
            // GitHub's own copy says it is merged.
            supersededBy: isMerged,
        },
        send: async ({ rest }) => {
            let answer: AsyncMergeAnswer;
            try {
                answer = await requestAsyncMerge(rest, {
                    ...target,
                    mergeMethod: toRestMergeMethod(request.method),
                    sha: item.headRefOid,
                    ...(request.title === undefined ? {} : { commitTitle: request.title }),
                    ...(request.body === undefined ? {} : { commitMessage: request.body }),
                });
            } catch (error) {
                const reason = toEditFailureReason(error);
                onAnswer({ kind: 'refused', reason });
                return { kind: 'rejected', reason, quiet: shown() };
            }

            switch (answer.status) {
                case 'failed': {
                    const reason: EditFailureReason = { kind: 'refused', message: answer.message };
                    onAnswer({ kind: 'refused', reason });
                    return { kind: 'rejected', reason, quiet: shown() };
                }
                case 'merged':
                    onAnswer({ kind: 'accepted' });
                    return merged(clock);
                case 'pending':
                    onAnswer({ kind: 'accepted' });
                    return await follow(rest, answer.uuid);
                default:
                    return assertNever(answer);
            }
        },
    };

    /**
     * Asks how the merge GitHub accepted ended, with growing waits, until it says or the time limit passes. A
     * request that fails meanwhile (offline, a 5xx) is asked again: the merge runs on GitHub regardless.
     */
    async function follow(rest: GitHubRestRequester, uuid: string): Promise<EditVerdict> {
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

            if (answer.status === 'merged') {
                return merged(clock);
            }

            if (answer.status === 'failed') {
                return { kind: 'rejected', reason: { kind: 'refused', message: answer.message } };
            }
        }

        return { kind: 'unknown' };
    }
}

/**
 * GitHub merged it. Drawn until GitHub's own copy says so: without GitHub's time of the merge, the row keeps no
 * confirmation mark, so any copy a sync reads takes the row's place, and an older one only shows under the layer.
 */
function merged(clock: ClockShape): EditVerdict {
    const now = new Date(clock.now()).toISOString();
    return {
        kind: 'confirmed',
        layer: {
            item: current =>
                current.kind === 'pullRequest'
                    ? { ...current, state: 'MERGED', merged: true, closedAt: current.closedAt ?? now }
                    : current,
            supersededBy: isMerged,
        },
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
