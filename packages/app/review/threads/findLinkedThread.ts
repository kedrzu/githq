import { holdsAnchor } from '@/item/thread/holdsAnchor.js';

import type { ReviewFileListEnd, ReviewThreadsState } from '../ReviewFiles.js';
import type { ThreadPlacement } from './placeThreads.js';
import type { ReviewThread } from './ReviewThread.js';

/**
 * Where the thread an address names is: `waiting` while the threads or the list of files may yet bring it, `missing` once
 * they can't, `placed` under the file it shows in — its new path for a file renamed by the pull request.
 */
export type LinkedThread =
    | { readonly kind: 'waiting' }
    | { readonly kind: 'missing' }
    | { readonly kind: 'placed'; readonly path: string; readonly threadId: string };

export interface FindLinkedThreadParams {
    /** GitHub's anchor of one of its comments, `discussion_r<id>` ({@link parseThreadAnchor}). */
    readonly anchor: string;
    readonly threads: readonly ReviewThread[];
    readonly threadsState: ReviewThreadsState;
    /** The threads by the path of the file they show in (`ReviewThreadPlacements.byFile`). */
    readonly placements: ReadonlyMap<string, readonly ThreadPlacement[]>;
    readonly listEnd: ReviewFileListEnd;
}

/**
 * GitHub's anchor of a comment on the code an address's fragment names: `#discussion_r<id>`, as a comment's `url` has it,
 * or `#r<id>`, as GitHub's own page of the changed files does. `null` for any other fragment.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseThreadAnchor(hash: string) {
    const [, anchor, id] = /^#(?:(discussion_[\w-]+)|r(\d+))$/u.exec(hash) ?? [];
    return anchor ?? (id === undefined ? null : `discussion_r${id}`);
}

/**
 * Finds the thread holding the comment an address names among a review's threads, and the file it shows in. A thread not
 * placed yet waits for a list of files still growing, its file maybe on a page to come.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findLinkedThread({
    anchor,
    threads,
    threadsState,
    placements,
    listEnd,
}: FindLinkedThreadParams): LinkedThread {
    const thread = threads.find(other => holdsAnchor(other, anchor));
    if (!thread) {
        return threadsState.kind === 'loading' ? { kind: 'waiting' } : { kind: 'missing' };
    }

    for (const [path, placed] of placements) {
        if (placed.some(placement => placement.thread.id === thread.id)) {
            return { kind: 'placed', path, threadId: thread.id };
        }
    }

    return listEnd === 'growing' ? { kind: 'waiting' } : { kind: 'missing' };
}
