/**
 * GitHub's anchor of what the url points at, its fragment: `issuecomment-<id>` for a comment, `pullrequestreview-<id>`
 * for a review, `discussion_r<id>` for a comment on the code. `undefined` for a url with none — a comment on its way
 * to GitHub has the item's url.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getUrlAnchor(url: string) {
    const hash = url.indexOf('#');
    return hash === -1 || hash === url.length - 1 ? undefined : url.slice(hash + 1);
}
