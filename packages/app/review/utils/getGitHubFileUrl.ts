/**
 * Where a file is on github.com's changed files page, whose anchors are `#diff-<sha256 of the path>`; the page itself
 * where the browser has no `crypto.subtle`, which is only in secure contexts.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export async function getGitHubFileUrl(filesUrl: string, path: string) {
    if (!('subtle' in crypto)) {
        return filesUrl;
    }

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path));
    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return `${filesUrl}#diff-${hex}`;
}
