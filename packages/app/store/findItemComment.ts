import type { ItemComment, ItemComments } from './ItemDetailTypes.js';

/**
 * The comment `id` among those read of an item — its first ones or its newest — or `undefined` when it is not read.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findItemComment(comments: ItemComments, id: string): ItemComment | undefined {
    return comments.nodes.find(comment => comment.id === id) ?? comments.first.find(comment => comment.id === id);
}
